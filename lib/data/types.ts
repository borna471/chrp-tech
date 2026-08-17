/**
 * Domain entities for a home photo assessment. These are named for the domain
 * rather than for where they currently live — the browser adapter stores them in
 * localStorage/IndexedDB today, and `prisma/schema.prisma` mirrors them as the
 * tables a server adapter will read.
 */

import type { ElementObservation, PhotoQuality } from "@/lib/ai/types";

export type AssessmentStatus = "open" | "complete";
export type TaskStatus = "pending" | "done" | "skipped";
/** What the app did with a capture, decided by `lib/ai/decide.ts`. */
export type AnalysisAction = "accepted" | "retake" | "close_up";

export type Assessment = {
  id: string;
  policyRef: string;
  homeAddress: string;
  homeownerFirstName: string;
  status: AssessmentStatus;
  /** Set once the homeowner has confirmed the property and accepted the terms. */
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PhotoTask = {
  id: string;
  assessmentId: string;
  slug: string;
  name: string;
  zone: string;
  /** What the insurer is looking for here: "Water", "Fire" or "Water & fire". */
  risk: string;
  instruction: string;
  tips: string[];
  order: number;
  status: TaskStatus;
  /** Set once the reviewer has asked for a close-up of this task. */
  followUpPrompt: string | null;
};

export type PhotoCapture = {
  id: string;
  taskId: string;
  assessmentId: string;
  mimeType: string;
  capturedAt: string;
  isFollowUp: boolean;
  /**
   * Where the bytes live: an IndexedDB key now, an object-storage URL later.
   * Null for the demo's auto-shot, which stands in for a photo the homeowner
   * never actually took — the striped placeholder in the capture screen.
   */
  storageKey: string | null;
  analysisId: string | null;
};

/**
 * What the reviewer found for one of the task's checks. This is the record the
 * insurer acts on — the reason the assessment exists — so it is stored per
 * finding rather than buried in a blob, and mirrors its own table in Prisma.
 */
export type StoredFinding = {
  checkId: string;
  present: boolean;
  confidence: number;
  /** The reviewer's own words. Internal to the assessment team. */
  note: string;
  severity: string;
};

export type PhotoAnalysis = {
  id: string;
  captureId: string;
  /** What the app did with the photo. */
  action: AnalysisAction;
  /** Homeowner-facing copy, shown verbatim in the result card. */
  message: string;
  /** Why a retake was asked for, when one was. */
  reason: string | null;
  /** Is the photo usable: blur, framing, exposure, subject present. */
  quality: PhotoQuality;
  /** Which of the task's required elements were in frame. */
  elements: ElementObservation[];
  findings: StoredFinding[];
  /** Set when the attempt cap was hit — a person should look at this one. */
  needsHumanReview: boolean;
  /** Which reviewer produced this — the mock identifies itself as "mock". */
  model: string;
  elapsedMs: number;
  analyzedAt: string;
};
