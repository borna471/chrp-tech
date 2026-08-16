import type {
  Assessment,
  AssessmentStatus,
  AnalysisVerdict,
  PhotoAnalysis,
  PhotoCapture,
  PhotoTask,
  TaskStatus,
} from "./types";

export type AssessmentSeed = {
  id: string;
  policyRef: string;
  homeAddress: string;
  homeownerFirstName: string;
};

export type SaveCaptureInput = {
  taskId: string;
  assessmentId: string;
  isFollowUp: boolean;
  /** Null when the demo auto-shot stands in for a photo. */
  blob: Blob | null;
};

export type SaveAnalysisInput = {
  verdict: AnalysisVerdict;
  message: string;
  model: string;
};

/**
 * The persistence seam. Every method is async so a server-backed adapter — one
 * that talks to Postgres through Prisma, or to route handlers over fetch — can
 * replace the browser adapter without any caller changing.
 */
export interface InspectionRepository {
  /** Loads the assessment, creating it and its photo tasks from seed on first open. */
  openAssessment(seed: AssessmentSeed): Promise<Assessment>;
  setAssessmentStatus(
    assessmentId: string,
    status: AssessmentStatus,
  ): Promise<Assessment>;
  /** Marks onboarding done, so a returning homeowner is not walked through it twice. */
  completeOnboarding(assessmentId: string): Promise<Assessment>;

  listTasks(assessmentId: string): Promise<PhotoTask[]>;
  setTaskStatus(taskId: string, status: TaskStatus): Promise<PhotoTask>;
  setFollowUpPrompt(taskId: string, prompt: string | null): Promise<PhotoTask>;

  saveCapture(input: SaveCaptureInput): Promise<PhotoCapture>;
  getLatestCapture(taskId: string): Promise<PhotoCapture | null>;
  getCaptureBlob(storageKey: string): Promise<Blob | null>;

  saveAnalysis(
    captureId: string,
    input: SaveAnalysisInput,
  ): Promise<PhotoAnalysis>;

  /** Drops every task, capture and analysis, back to a freshly seeded assessment. */
  resetAssessment(assessmentId: string): Promise<void>;
}
