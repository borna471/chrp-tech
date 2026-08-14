import { FOLLOW_UP_PROMPTS } from "@/lib/tasks";
import type { AnalyzePhotoRequest, AnalyzePhotoResult } from "./types";

/** How long the mock reviewer "thinks" — matches the pacing of the design. */
const MOCK_LATENCY_MS = 1700;

export const MOCK_MODEL = "mock";

/**
 * The one place the flow decides whether a photo passed review.
 *
 * TODO(ai): replace the mock body below with the real call. The external vision
 * model must not be reached from the browser — the API key stays server-side —
 * so this becomes:
 *
 *   const body = new FormData();
 *   body.append("photo", input.blob!);
 *   body.append("taskSlug", input.taskSlug);
 *   body.append("isFollowUp", String(input.isFollowUp));
 *   const response = await fetch(`/api/captures/${input.captureId}/analyze`, {
 *     method: "POST",
 *     body,
 *   });
 *   if (!response.ok) throw new Error(`Analysis failed: ${response.status}`);
 *   return (await response.json()) as AnalyzePhotoResult;
 *
 * with a route handler at app/api/captures/[captureId]/analyze/route.ts that
 * prompts the model with `instruction` plus the task's tips and returns this
 * same AnalyzePhotoResult shape. Callers already await this and already handle
 * rejection, so nothing outside this file changes.
 */
export async function analyzePhoto(
  input: AnalyzePhotoRequest,
): Promise<AnalyzePhotoResult> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  const followUp = FOLLOW_UP_PROMPTS[input.taskSlug];
  if (followUp && !input.isFollowUp) {
    return { verdict: "follow_up", message: followUp, model: MOCK_MODEL };
  }

  return {
    verdict: "accepted",
    message: `Clear shot. Everything we needed for ${input.taskName.toLowerCase()} is visible.`,
    model: MOCK_MODEL,
  };
}
