/**
 * Mirrors an assessment and its photo tasks to Supabase.
 *
 * POST is an upsert, so the same body can be sent on every page load — that is
 * what backfills anything captured while the mirror was down. DELETE clears the
 * captures under an assessment, which is how "start over" reaches the insurer's
 * copy; without it the reset would leave orphaned attempts behind, because
 * capture ids are fresh uuids while task ids are deterministic and overwrite.
 */

import { CAPTURE_BUCKET, getSupabase } from "@/lib/server/supabase";
import type {
  MirrorAssessmentPayload,
  MirrorResetPayload,
} from "@/lib/data/mirrorPayloads";
import { mirrorFailure } from "../failure";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (error) {
    return mirrorFailure("assessment", error);
  }

  const { assessment, tasks } = (await request.json()) as MirrorAssessmentPayload;

  if (assessment) {
    const { error: assessmentError } = await supabase.from("assessments").upsert({
      id: assessment.id,
      policy_ref: assessment.policyRef,
      home_address: assessment.homeAddress,
      homeowner_first_name: assessment.homeownerFirstName,
      status: assessment.status,
      onboarding_completed_at: assessment.onboardingCompletedAt,
      // The moment the status flipped is the closest thing we have to a submit
      // time, and it is what the dashboard sorts its queue by.
      submitted_at:
        assessment.status === "complete" ? assessment.updatedAt : null,
      created_at: assessment.createdAt,
      updated_at: assessment.updatedAt,
      mirrored_at: new Date().toISOString(),
    });
    if (assessmentError) return mirrorFailure("assessment", assessmentError);
  }

  if (tasks && tasks.length > 0) {
    const { error: tasksError } = await supabase.from("photo_tasks").upsert(
      tasks.map((task) => ({
        id: task.id,
        assessment_id: task.assessmentId,
        slug: task.slug,
        name: task.name,
        zone: task.zone,
        risk: task.risk,
        instruction: task.instruction,
        tips: task.tips,
        order: task.order,
        status: task.status,
        follow_up_prompt: task.followUpPrompt,
        mirrored_at: new Date().toISOString(),
      })),
    );
    if (tasksError) return mirrorFailure("assessment.tasks", tasksError);
  }

  return Response.json({ ok: true, tasks: tasks?.length ?? 0 });
}

export async function DELETE(request: Request) {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (error) {
    return mirrorFailure("assessment", error);
  }

  const { assessmentId } = (await request.json()) as MirrorResetPayload;

  // Analyses and findings go with them on cascade; the assessment and its tasks
  // survive, which matches what the homeowner sees after a reset.
  const { error } = await supabase
    .from("photo_captures")
    .delete()
    .eq("assessment_id", assessmentId);
  if (error) return mirrorFailure("assessment.reset", error);

  const { data: objects } = await supabase.storage
    .from(CAPTURE_BUCKET)
    .list(assessmentId, { limit: 1000 });
  // Storage has no cascade, so orphaned photos would otherwise outlive the rows
  // that point at them.
  if (objects?.length) {
    const folders = objects.map((entry) => `${assessmentId}/${entry.name}`);
    const nested = await Promise.all(
      folders.map(async (folder) => {
        const { data } = await supabase.storage
          .from(CAPTURE_BUCKET)
          .list(folder, { limit: 1000 });
        return (data ?? []).map((file) => `${folder}/${file.name}`);
      }),
    );
    const paths = nested.flat();
    if (paths.length > 0) {
      await supabase.storage.from(CAPTURE_BUCKET).remove(paths);
    }
  }

  return Response.json({ ok: true });
}
