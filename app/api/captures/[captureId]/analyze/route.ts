/**
 * Reviews one photo against one task, by calling the hosted vision model.
 *
 * This exists so the endpoint credentials never reach the browser. It is also
 * why the client sends a task *slug* rather than a prompt: the prompt is
 * assembled here from `content/photo-tasks.json`, so the only thing a caller can
 * influence is the pixels.
 */

import { TARGET_MODEL } from "@/lib/ai/analyzePhoto";
import { SYSTEM_PROMPT, buildUserPrompt, outputSchema } from "@/lib/ai/prompt";
import { seedForSlug } from "@/lib/tasks";

export const runtime = "nodejs";

/**
 * A 4B reading a 2048px frame measured 12–14s, which is longer than the function
 * limits this app was written against. Pinned just above `UPSTREAM_TIMEOUT_MS` so
 * the route's own timeout is what fails, with a message a homeowner can act on,
 * rather than the platform killing the request first.
 */
export const maxDuration = 60;

/** Long enough for a 4B to read a 2048px frame, short enough to fail visibly. */
const UPSTREAM_TIMEOUT_MS = 45_000;

/** Worst task is 3 elements and 5 checks — roughly 500 tokens with notes. */
const MAX_TOKENS = 1024;

const WARMING_UP =
  "The reviewer is starting up. Give it a minute and try again.";

const fail = (status: number, error: string, raw?: string) =>
  Response.json({ error, ...(raw === undefined ? {} : { raw }) }, { status });

/**
 * Pulls the JSON object out of a completion. Guided decoding should make every
 * branch past `JSON.parse` dead — it is kept because the fallback path, where a
 * model wraps its answer in a fence or a sentence, is otherwise a total failure
 * for a response that was actually correct.
 */
function extractJson(text: string): unknown {
  const unfenced = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ captureId: string }> },
) {
  const { captureId } = await params;

  const form = await request.formData();
  const photo = form.get("photo");
  const taskSlug = String(form.get("taskSlug") ?? "");
  const isFollowUp = form.get("isFollowUp") === "true";

  if (!(photo instanceof Blob) || photo.size === 0) {
    return fail(400, "No photo was attached to the review request.");
  }
  const task = seedForSlug(taskSlug);
  if (!task) return fail(400, `Unknown task slug "${taskSlug}".`);

  const endpoint = process.env.HF_ENDPOINT_URL;
  const token = process.env.HF_TOKEN;
  // A missing variable is named rather than swallowed — the alternative is an
  // opaque 401 from the endpoint that looks like a model problem.
  if (!endpoint) return fail(500, "HF_ENDPOINT_URL is not set.");
  if (!token) return fail(500, "HF_TOKEN is not set.");

  const base64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  const dataUri = `data:${photo.type || "image/jpeg"};base64,${base64}`;

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${endpoint.replace(/\/+$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      body: JSON.stringify({
        model: TARGET_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0,
        // Constrains generation to the task's exact shape, so the ids and enums
        // downstream code depends on cannot come back malformed.
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "photo_review",
            strict: true,
            schema: outputSchema(task),
          },
        },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUri } },
              { type: "text", text: buildUserPrompt(task, isFollowUp) },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error(`[chrp-ai] ${captureId} ${taskSlug} upstream unreachable`, error);
    return fail(
      502,
      timedOut
        ? "The reviewer took too long to answer."
        : "Could not reach the reviewer.",
    );
  }

  const elapsedMs = Date.now() - startedAt;

  if (!response.ok) {
    const detail = await response.text();
    console.error(
      `[chrp-ai] ${captureId} ${taskSlug} upstream ${response.status} in ${elapsedMs}ms`,
      detail,
    );
    // An endpoint scaled to zero answers 503 for the minute or two it takes to
    // boot, which is a wait rather than a fault and reads differently to a
    // homeowner.
    if (response.status === 503) return fail(503, WARMING_UP);
    return fail(502, `The reviewer answered ${response.status}.`, detail);
  }

  const completion = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = completion.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(text);

  if (typeof parsed !== "object" || parsed === null) {
    console.error(
      `[chrp-ai] ${captureId} ${taskSlug} unparseable in ${elapsedMs}ms`,
      text,
    );
    return fail(502, "The reviewer did not answer in JSON.", text);
  }

  console.log(
    `[chrp-ai] ${captureId} ${taskSlug} ok in ${elapsedMs}ms (${photo.size} bytes)`,
  );
  return Response.json({ ...parsed, model: TARGET_MODEL, elapsedMs });
}
