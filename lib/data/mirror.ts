/**
 * Copies every write to the insurer's database without changing the app.
 *
 * `withMirror` wraps the real repository: the browser adapter still runs first
 * and is still the only thing the caller waits on, so a Supabase outage cannot
 * slow down or break a homeowner mid-capture. The mirror POST is queued behind
 * it and never awaited.
 *
 * Writes are queued rather than fired in parallel because the mirror tables have
 * real foreign keys — an analysis references a capture, a capture references a
 * task. On the blur-gate path a capture and its analysis are saved microseconds
 * apart, so parallel requests would race and the second would be rejected.
 */

import type {
  InspectionRepository,
  AssessmentSeed,
  SaveAnalysisInput,
  SaveCaptureInput,
} from "./repository";
import type { AssessmentStatus, PhotoCapture, TaskStatus } from "./types";
import type {
  MirrorAnalysisPayload,
  MirrorAssessmentPayload,
  MirrorCapturePayload,
  MirrorResetPayload,
} from "./mirrorPayloads";

/** The tail of the queue. Every mirror write chains onto it, in call order. */
let pending: Promise<unknown> = Promise.resolve();

function send(path: string, init: RequestInit) {
  pending = pending
    .catch(() => undefined)
    .then(async () => {
      const response = await fetch(`/api/mirror/${path}`, init);
      // Both outcomes are logged, not just the failure: a mirror nobody waits on
      // is otherwise untestable, and this line is how you see a write land
      // without opening the Supabase table editor.
      const label = `%c[chrp-mirror]%c ${path} ${response.status}`;
      const style = response.ok ? "color:#0f7d80" : "color:#b3261e";
      console.log(label, `${style};font-weight:600`, "color:inherit");
      if (!response.ok) console.warn(await response.text());
    })
    .catch((error) => console.warn(`[chrp-mirror] ${path} failed`, error));
}

const json = (path: string, body: unknown, method = "POST") =>
  send(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/**
 * Task ids are `${assessmentId}:${slug}`, which is the only place the slug is
 * available at capture time — `SaveCaptureInput` does not carry it.
 */
function slugOf(capture: PhotoCapture): string {
  const prefix = `${capture.assessmentId}:`;
  return capture.taskId.startsWith(prefix)
    ? capture.taskId.slice(prefix.length)
    : capture.taskId;
}

function capturePayload(capture: PhotoCapture): MirrorCapturePayload {
  return {
    id: capture.id,
    taskId: capture.taskId,
    assessmentId: capture.assessmentId,
    taskSlug: slugOf(capture),
    mimeType: capture.mimeType,
    capturedAt: capture.capturedAt,
    isFollowUp: capture.isFollowUp,
  };
}

/**
 * Wraps the eight mutating methods. The read methods are passed straight
 * through — nothing in this app reads from the mirror.
 */
export function withMirror(repo: InspectionRepository): InspectionRepository {
  return {
    ...repo,

    async openAssessment(seed: AssessmentSeed) {
      const assessment = await repo.openAssessment(seed);
      const tasks = await repo.listTasks(assessment.id);
      // Sent in full on every page load, which doubles as a backfill: anything
      // written while the mirror was unreachable reappears on the next visit.
      json("assessment", { assessment, tasks } satisfies MirrorAssessmentPayload);
      return assessment;
    },

    async setAssessmentStatus(id: string, status: AssessmentStatus) {
      const assessment = await repo.setAssessmentStatus(id, status);
      json("assessment", { assessment } satisfies MirrorAssessmentPayload);
      return assessment;
    },

    async completeOnboarding(id: string) {
      const assessment = await repo.completeOnboarding(id);
      json("assessment", { assessment } satisfies MirrorAssessmentPayload);
      return assessment;
    },

    async setTaskStatus(id: string, status: TaskStatus) {
      const task = await repo.setTaskStatus(id, status);
      json("assessment", { tasks: [task] } satisfies MirrorAssessmentPayload);
      return task;
    },

    async setFollowUpPrompt(id: string, prompt: string | null) {
      const task = await repo.setFollowUpPrompt(id, prompt);
      json("assessment", { tasks: [task] } satisfies MirrorAssessmentPayload);
      return task;
    },

    async saveCapture(input: SaveCaptureInput) {
      const capture = await repo.saveCapture(input);
      const body = new FormData();
      body.append("capture", JSON.stringify(capturePayload(capture)));
      // The original blob, not the downscaled one the reviewer sees: the
      // insurer wants the full frame.
      if (input.blob) body.append("photo", input.blob);
      send("captures", { method: "POST", body });
      return capture;
    },

    async saveAnalysis(captureId: string, input: SaveAnalysisInput) {
      const analysis = await repo.saveAnalysis(captureId, input);
      json("analyses", { analysis } satisfies MirrorAnalysisPayload);
      return analysis;
    },

    async resetAssessment(assessmentId: string) {
      await repo.resetAssessment(assessmentId);
      // Capture ids are fresh uuids, so without this the insurer's copy keeps
      // every pre-reset attempt under a task that has since been re-seeded.
      json(
        "assessment",
        { assessmentId } satisfies MirrorResetPayload,
        "DELETE",
      );
    },
  };
}
