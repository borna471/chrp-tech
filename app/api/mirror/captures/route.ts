/**
 * Mirrors one capture — the row and the photo behind it — to Supabase.
 *
 * The photo is uploaded before the row is written so `storage_path` is correct
 * the moment the dashboard can see the capture. An upload that fails still
 * writes the row with a null path: knowing an attempt happened matters more
 * than the image, and the row is what carries the retake count.
 */

import { CAPTURE_BUCKET, getSupabase } from "@/lib/server/supabase";
import type { MirrorCapturePayload } from "@/lib/data/mirrorPayloads";
import { mirrorFailure } from "../failure";

export const runtime = "nodejs";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (error) {
    return mirrorFailure("captures", error);
  }

  const form = await request.formData();
  const raw = form.get("capture");
  if (typeof raw !== "string") {
    return mirrorFailure("captures", new Error("No capture payload attached."));
  }
  const capture = JSON.parse(raw) as MirrorCapturePayload;
  const photo = form.get("photo");

  let storagePath: string | null = null;
  if (photo instanceof Blob && photo.size > 0) {
    const extension = EXTENSIONS[capture.mimeType] ?? "bin";
    const path = `${capture.assessmentId}/${capture.taskSlug}/${capture.id}.${extension}`;
    const { error } = await supabase.storage
      .from(CAPTURE_BUCKET)
      .upload(path, photo, {
        contentType: capture.mimeType,
        // Upsert so a re-mirror of the same capture id replaces the object
        // rather than erroring, which is what makes the whole mirror idempotent.
        upsert: true,
      });
    if (error) {
      console.error(`[chrp-mirror] captures upload failed for ${path}`, error);
    } else {
      storagePath = path;
    }
  }

  const { error } = await supabase.from("photo_captures").upsert({
    id: capture.id,
    task_id: capture.taskId,
    assessment_id: capture.assessmentId,
    task_slug: capture.taskSlug,
    mime_type: capture.mimeType,
    captured_at: capture.capturedAt,
    is_follow_up: capture.isFollowUp,
    storage_path: storagePath,
    mirrored_at: new Date().toISOString(),
  });
  if (error) return mirrorFailure("captures", error);

  return Response.json({ ok: true, storagePath });
}
