/**
 * Mirrors one analysis and its findings to Supabase.
 *
 * The task slug and assessment id are read off the capture row rather than sent
 * by the client, so they cannot disagree with what was already mirrored. That
 * slug is then used to resolve the human-readable half of the reviewer's answer
 * — a check's `lookFor` and an element's `description` — into the stored rows,
 * so the dashboard can render them without importing anything from this app.
 */

import { getSupabase } from "@/lib/server/supabase";
import type { MirrorAnalysisPayload } from "@/lib/data/mirrorPayloads";
import { seedForSlug } from "@/lib/tasks";
import { mirrorFailure } from "../failure";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (error) {
    return mirrorFailure("analyses", error);
  }

  const { analysis } = (await request.json()) as MirrorAnalysisPayload;

  const { data: capture, error: captureError } = await supabase
    .from("photo_captures")
    .select("assessment_id, task_slug")
    .eq("id", analysis.captureId)
    .maybeSingle();
  if (captureError) return mirrorFailure("analyses", captureError);
  if (!capture) {
    // The capture mirror is queued ahead of this one, so a miss means that write
    // failed rather than that it is still in flight.
    return mirrorFailure(
      "analyses",
      new Error(`No mirrored capture ${analysis.captureId} to attach to.`),
    );
  }

  const seed = seedForSlug(capture.task_slug);
  const describe = (id: string) =>
    seed?.requiredElements.find((element) => element.id === id)?.description ??
    "";
  const lookFor = (checkId: string) =>
    seed?.checks.find((check) => check.id === checkId)?.lookFor ?? "";

  const { error: analysisError } = await supabase.from("photo_analyses").upsert({
    id: analysis.id,
    capture_id: analysis.captureId,
    assessment_id: capture.assessment_id,
    action: analysis.action,
    message: analysis.message,
    reason: analysis.reason,
    blur: analysis.quality.blur,
    framing: analysis.quality.framing,
    exposure: analysis.quality.exposure,
    subject_present: analysis.quality.subjectPresent,
    elements: analysis.elements.map((element) => ({
      ...element,
      description: describe(element.id),
    })),
    needs_human_review: analysis.needsHumanReview,
    model: analysis.model,
    elapsed_ms: analysis.elapsedMs,
    analyzed_at: analysis.analyzedAt,
    mirrored_at: new Date().toISOString(),
  });
  if (analysisError) return mirrorFailure("analyses", analysisError);

  if (analysis.findings.length > 0) {
    const { error: findingsError } = await supabase
      .from("photo_findings")
      .upsert(
        analysis.findings.map((finding) => ({
          analysis_id: analysis.id,
          check_id: finding.checkId,
          present: finding.present,
          confidence: finding.confidence,
          note: finding.note,
          severity: finding.severity,
          look_for: lookFor(finding.checkId),
        })),
      );
    if (findingsError) return mirrorFailure("analyses.findings", findingsError);
  }

  return Response.json({ ok: true, findings: analysis.findings.length });
}
