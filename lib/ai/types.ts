import type { AnalysisVerdict } from "@/lib/data/types";

export type AnalyzePhotoRequest = {
  captureId: string;
  taskSlug: string;
  taskName: string;
  zone: string;
  /** What the homeowner was asked to photograph. */
  instruction: string;
  /** True when this is the close-up the reviewer asked for, not the first shot. */
  isFollowUp: boolean;
  /** Null for the demo's stand-in capture, which has no bytes. */
  blob: Blob | null;
};

export type AnalyzePhotoResult = {
  verdict: AnalysisVerdict;
  /** Homeowner-facing copy, shown verbatim in the result card. */
  message: string;
  /** Identifies the reviewer that produced this result. */
  model: string;
};
