/**
 * A blur check that runs on the device in a few milliseconds, before a photo is
 * worth sending anywhere. Variance of the Laplacian: a sharp image has strong
 * edges and so a wide spread of second-derivative values, a soft one does not.
 *
 * This is the cheap first gate. The reviewer scores blur too, but only after a
 * network round trip — catching the obvious cases here means the homeowner is
 * told to retake immediately instead of waiting on a model.
 */

/** Below this variance the photo is treated as too soft to be worth reviewing. */
export const BLUR_VARIANCE_FLOOR = 90;

/** Downscale before measuring: enough detail to judge, a fraction of the pixels. */
const SAMPLE_WIDTH = 480;

/**
 * @returns The Laplacian variance, or null when it could not be measured — an
 * unreadable blob, or a browser without canvas. Null means "don't gate on this",
 * never "blurry": a measurement we could not take must not reject a good photo.
 */
export async function measureSharpness(blob: Blob): Promise<number | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  try {
    const scale = Math.min(1, SAMPLE_WIDTH / bitmap.width);
    const width = Math.max(3, Math.round(bitmap.width * scale));
    const height = Math.max(3, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(bitmap, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);

    // Rec. 601 luma, one value per pixel.
    const grey = new Float32Array(width * height);
    for (let i = 0; i < grey.length; i++) {
      const p = i * 4;
      grey[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }

    // 4-neighbour Laplacian, skipping the border where the kernel doesn't fit.
    let sum = 0;
    let sumSquares = 0;
    let count = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const value =
          4 * grey[i] -
          grey[i - 1] -
          grey[i + 1] -
          grey[i - width] -
          grey[i + width];
        sum += value;
        sumSquares += value * value;
        count++;
      }
    }
    if (count === 0) return null;

    const mean = sum / count;
    return sumSquares / count - mean * mean;
  } finally {
    bitmap.close();
  }
}

/** True only when we measured the photo and it came back soft. */
export async function isTooBlurry(blob: Blob): Promise<boolean> {
  const variance = await measureSharpness(blob);
  return variance !== null && variance < BLUR_VARIANCE_FLOOR;
}
