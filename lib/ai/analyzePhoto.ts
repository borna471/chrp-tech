import type { TaskSeed } from "@/lib/tasks";
import type { Decision } from "./decide";
import type { AnalyzePhotoRequest, AnalyzePhotoResult } from "./types";

/** The model this is built against; sent as the `model` field in the real call. */
export const TARGET_MODEL = "Qwen/Qwen3-VL-4B-Instruct";

/**
 * The one place the flow decides what a photo shows.
 *
 * TODO(ai): replace the throw below with the real call. The model must not be
 * reached from the browser — the API key stays server-side — so this becomes:
 *
 *   const body = new FormData();
 *   body.append("photo", input.blob!);
 *   body.append("taskSlug", input.task.slug);
 *   body.append("isFollowUp", String(input.isFollowUp));
 *   const response = await fetch(`/api/captures/${input.captureId}/analyze`, {
 *     method: "POST",
 *     body,
 *   });
 *   if (!response.ok) throw new Error(`Analysis failed: ${response.status}`);
 *   return parseResult(await response.json(), input.task);
 *
 * with a route handler at app/api/captures/[captureId]/analyze/route.ts that
 * posts SYSTEM_PROMPT plus buildUserPrompt(task, isFollowUp) and the image to
 * the OpenAI-compatible endpoint, asking for the JSON shape in `prompt.ts`.
 * Callers already await this and already handle rejection, so nothing outside
 * this file changes — `parseResult` below validates the response before anything
 * downstream trusts it.
 */
export async function analyzePhoto(
  input: AnalyzePhotoRequest,
): Promise<AnalyzePhotoResult> {
  void input;
  // Until the route handler lands, every capture resolves to the error card,
  // whose "Try again" re-runs this. The blur gate still works — it never gets here.
  throw new Error("analyzePhoto: reviewer not wired up yet — see TODO(ai) above.");
}

/**
 * Validates a reviewer response before anything downstream trusts it. A real
 * model returns text, and a small one will sometimes return text that is nearly
 * the right shape — so this throws rather than coercing, and the caller's error
 * state offers a retry.
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
    // Ids the task doesn't define are dropped rather than trusted — a small model
    // will occasionally invent one, and it must not reach the decision rules.
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
 * One collapsed group per capture. Collapsed so a twenty-photo walk stays
 * readable, complete so any single capture can be expanded and copied out whole.
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

/** The failure path still logs — a bad response is the thing worth seeing raw. */
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
