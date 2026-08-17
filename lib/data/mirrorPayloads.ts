/**
 * The wire shapes the mirror decorator posts and the mirror routes read.
 *
 * A shared type module rather than types declared on either side, so a change to
 * what the browser sends is a compile error in the route that receives it.
 */

import type { Assessment, PhotoAnalysis, PhotoTask } from "./types";

/**
 * Upsert of an assessment, its tasks, or both. Both halves are optional because
 * most writes touch only one — a task status change has no new assessment to
 * send, and sending a stale one would undo a concurrent update.
 */
export type MirrorAssessmentPayload = {
  assessment?: Assessment;
  tasks?: PhotoTask[];
};

/**
 * The capture row. Sent as a JSON part alongside the photo itself, because a
 * multipart body is the only way to carry both in one request.
 */
export type MirrorCapturePayload = {
  id: string;
  taskId: string;
  assessmentId: string;
  /** Not on `PhotoCapture` — derived from the task id, which encodes it. */
  taskSlug: string;
  mimeType: string;
  capturedAt: string;
  isFollowUp: boolean;
};

/**
 * The analysis row. `assessmentId` and the task slug are deliberately absent:
 * the route reads both off the capture row this one references, so they cannot
 * disagree with what was already mirrored.
 */
export type MirrorAnalysisPayload = {
  analysis: PhotoAnalysis;
};

export type MirrorResetPayload = {
  assessmentId: string;
};
