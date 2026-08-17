/**
 * Shrinks a photo before it is sent for review. A phone camera hands back a 3–5MB
 * frame, which is a third larger again once base64'd into the request body, and
 * the reviewer patches an image at its native resolution — so every extra pixel
 * is upload time, visual tokens and latency.
 *
 * This runs after the blur gate, which measures the original bytes: re-encoding
 * changes sharpness, so the two must not be reordered.
 */

/**
 * Longest edge sent to the reviewer. 2048 keeps small print legible — a corroded
 * fitting, a label on a water heater — at roughly four times the visual tokens of
 * 1024. Lower it if review latency matters more than fine detail.
 */
export const MAX_UPLOAD_EDGE = 2048;

const JPEG_QUALITY = 0.82;

/**
 * @returns A JPEG no larger than `maxEdge` on its longest side, or the original
 * blob when it is already small enough, when it cannot be decoded, or when the
 * browser has no canvas. Falling back to the original is always safe — it costs
 * bandwidth, never correctness.
 */
export async function downscaleForUpload(
  blob: Blob,
  maxEdge: number = MAX_UPLOAD_EDGE,
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= maxEdge) return blob;

    const scale = maxEdge / longest;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.drawImage(bitmap, 0, 0, width, height);

    const resized = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    return resized ?? blob;
  } finally {
    bitmap.close();
  }
}
