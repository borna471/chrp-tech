import type { TaskSeed } from "@/lib/tasks";
import type { Decision } from "./decide";
import { downscaleForUpload } from "./downscale";
import type { AnalyzePhotoRequest, AnalyzePhotoResult } from "./types";

/** sent as the `model` field in the real call. */
export const TARGET_MODEL = "Qwen/Qwen3-VL-4B-Instruct";

/**
 * A review that did not produce a result. returns raw response and whether the model is warming up.
 */
export class AnalysisError extends Error {
  readonly raw?: unknown;
  readonly warmingUp: boolean;

  constructor(
    message: string,
    options: { raw?: unknown; warmingUp?: boolean } = {},
  ) {
    super(message);
    this.name = "AnalysisError";
    this.raw = options.raw;
    this.warmingUp = options.warmingUp ?? false;
  }
}

/**
 * The one place the flow decides what a photo shows.
 *
 * The model is reached through our own route rather than directly: the endpoint
 * credentials stay server-side, and the prompt is assembled there from the task
 * slug, so nothing about what the reviewer is asked originates in the browser.
 */
export async function analyzePhoto(
  input: AnalyzePhotoRequest,
): Promise<AnalyzePhotoResult> {
  if (!input.blob) {
    throw new AnalysisError("There is no photo on file to review.");
  }

  const body = new FormData();
  body.append("photo", await downscaleForUpload(input.blob));
  body.append("taskSlug", input.task.slug);
  body.append("isFollowUp", String(input.isFollowUp));

  const response = await fetch(`/api/captures/${input.captureId}/analyze`, {
    method: "POST",
    body,
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    raw?: unknown;
  } | null;

  if (!response.ok) {
    throw new AnalysisError(
      payload?.error ?? `The reviewer answered ${response.status}.`,
      { raw: payload?.raw, warmingUp: response.status === 503 },
    );
  }

  return parseResult(payload, input.task);
}

/**
 * Validates a reviewer response
 */
export function parseResult(raw: unknown, task: TaskSeed): AnalyzePhotoResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Reviewer returned a non-object response.");
  }
  const body = raw as Record<string, unknown>;
  const quality = body.quality as Record<string, unknown> | undefined;
  if (!quality) throw new Error("Reviewer response is missing `quality`.");

  const number = (value: unknown, field: string) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`Reviewer response has a non-numeric \`${field}\`.`);
    }
    return Math.min(1, Math.max(0, value));
  };

  const byId = <T extends { id?: unknown; checkId?: unknown }>(
    list: unknown,
    field: string,
  ): T[] => {
    if (!Array.isArray(list)) {
      throw new Error(`Reviewer response has a non-array \`${field}\`.`);
    }
    return list as T[];
  };

  const elements = byId<{ id: string; visible: unknown; confidence: unknown }>(
    body.elements,
    "elements",
  )
    // filtering elements by ID that are not required for the current task
    .filter((item) => task.requiredElements.some((e) => e.id === item.id))
    .map((item) => ({
      id: item.id,
      visible: Boolean(item.visible),
      confidence: number(item.confidence, `elements.${item.id}.confidence`),
    }));

  const findings = byId<{
    checkId: string;
    present: unknown;
    confidence: unknown;
    note: unknown;
  }>(body.findings, "findings")
    .filter((item) => task.checks.some((c) => c.id === item.checkId))
    .map((item) => ({
      checkId: item.checkId,
      present: Boolean(item.present),
      confidence: number(item.confidence, `findings.${item.checkId}.confidence`),
      note: typeof item.note === "string" ? item.note : "",
    }));

  return {
    quality: {
      blur: number(quality.blur, "quality.blur"),
      framing:
        quality.framing === "too_close" || quality.framing === "too_far"
          ? quality.framing
          : "ok",
      exposure:
        quality.exposure === "too_dark" || quality.exposure === "blown_out"
          ? quality.exposure
          : "ok",
      subjectPresent: Boolean(quality.subjectPresent),
    },
    elements,
    findings,
    model: typeof body.model === "string" ? body.model : TARGET_MODEL,
    elapsedMs: typeof body.elapsedMs === "number" ? body.elapsedMs : 0,
  };
}

/**
 * Logs the analysis result
 */
export function logAnalysis(
  task: TaskSeed,
  attempt: number,
  result: AnalyzePhotoResult,
  decision: Decision,
) {
  const summary =
    decision.action === "retake"
      ? `retake (${decision.reason})`
      : decision.action === "close_up"
        ? `close-up (${decision.checkId})`
        : "accepted";

  console.groupCollapsed(
    `%c[chrp-ai]%c ${task.slug} · attempt ${attempt} · ${summary} · ${result.elapsedMs}ms`,
    "color:#0f7d80;font-weight:600",
    "color:inherit",
  );
  console.log("model", result.model);
  console.log("decision", decision);
  console.log("quality", result.quality);
  console.table(result.elements);
  console.table(
    result.findings.map((finding) => ({
      ...finding,
      severity: task.checks.find((c) => c.id === finding.checkId)?.severity,
    })),
  );
  console.groupEnd();
}

/** Logs the analysis failure */
export function logAnalysisFailure(
  task: TaskSeed,
  attempt: number,
  error: unknown,
  raw?: unknown,
) {
  console.groupCollapsed(
    `%c[chrp-ai]%c ${task.slug} · attempt ${attempt} · FAILED`,
    "color:#b3261e;font-weight:600",
    "color:inherit",
  );
  console.error(error);
  if (raw !== undefined) console.log("raw response", raw);
  console.groupEnd();
}
