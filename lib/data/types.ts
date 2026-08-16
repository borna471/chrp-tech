/**
 * Domain entities for a home photo assessment. These are named for the domain
 * rather than for where they currently live — the browser adapter stores them in
 * localStorage/IndexedDB today, and `prisma/schema.prisma` mirrors them as the
 * tables a server adapter will read.
 */

export type AssessmentStatus = "open" | "complete";
export type TaskStatus = "pending" | "done" | "skipped";
export type AnalysisVerdict = "accepted" | "follow_up";

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

export type PhotoAnalysis = {
  id: string;
  captureId: string;
  verdict: AnalysisVerdict;
  message: string;
  /** Which reviewer produced this — the mock identifies itself as "mock". */
  model: string;
  analyzedAt: string;
};
