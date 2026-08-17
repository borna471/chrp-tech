import type { TaskSeed } from "@/lib/tasks";

/**
 * What the reviewer is asked about one photo. The task carries its own
 * requiredElements and checks, so the prompt is assembled from content rather
 * than hardcoded per slug.
 */
export type AnalyzePhotoRequest = {
  captureId: string;
  task: TaskSeed;
  /** True when this is the close-up the reviewer asked for, not the first shot. */
  isFollowUp: boolean;
  /** Null for the demo's stand-in capture, which has no bytes. */
  blob: Blob | null;
};

export type Framing = "too_close" | "ok" | "too_far";
export type Exposure = "too_dark" | "ok" | "blown_out";

/** Is the photo usable at all? The same four questions on every task. */
export type PhotoQuality = {
  /** 0 is sharp, 1 is unusable. */
  blur: number;
  framing: Framing;
  exposure: Exposure;
  /** False when the frame shows something else entirely — a floor, a ceiling, a thumb. */
  subjectPresent: boolean;
};

/** Whether one of the task's requiredElements is actually in frame. */
export type ElementObservation = {
  id: string;
  visible: boolean;
  /** 0–1. How sure the reviewer is of `visible`, either way. */
  confidence: number;
};

/** What one of the task's checks turned up. Insurer-facing. */
export type Finding = {
  checkId: string;
  present: boolean;
  /** 0–1. Low confidence is what triggers a close-up rather than a conclusion. */
  confidence: number;
  /** The reviewer's own words. Internal — never shown to the homeowner. */
  note: string;
};

/**
 * The reviewer reports observations only — it never returns a verdict. Turning
 * these into an action is `decide()`, so the thresholds live in code where they
 * can be tuned and read, rather than inside a prompt.
 */
export type AnalyzePhotoResult = {
  quality: PhotoQuality;
  elements: ElementObservation[];
  findings: Finding[];
  /** Identifies the reviewer that produced this result. */
  model: string;
  /** Wall-clock time the review took, for the debug panel and logs. */
  elapsedMs: number;
};
