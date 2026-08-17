import type { TaskCheck, TaskSeed } from "@/lib/tasks";
import type { AnalyzePhotoResult } from "./types";

/**
 * The one place a capture's outcome is chosen.
 *
 * The reviewer reports observations; this turns them into an action. Keeping the
 * decision here rather than asking the model for a verdict means the behaviour
 * can be read at a glance, tuned by changing a number, and exercised without a
 * model call — which matters with a small model whose verdicts would otherwise
 * be an opaque, untunable black box.
 */

/** Every threshold in one place. Tuning against real photos happens here. */
export const THRESHOLDS = {
  /** Above this, the photo is too soft to review. */
  blurMax: 0.55,
  /** How sure the reviewer must be before a missing element forces a retake. */
  missingElementConfidence: 0.6,
  /**
   * A finding inside this band is a maybe: enough to be worth a closer look,
   * not enough to record as seen. Outside it we either believe it or we don't.
   */
  uncertainFinding: { min: 0.35, max: 0.75 },
  /**
   * After this many attempts the photo is accepted regardless and flagged for a
   * person. A homeowner must never be trapped in a retake loop by a model error.
   */
  maxAttempts: 2,
} as const;

export type RetakeReason =
  | "blurry"
  | "too_dark"
  | "blown_out"
  | "too_close"
  | "too_far"
  | "wrong_subject"
  | "missing_element";

export type Decision =
  | { action: "accepted"; message: string; needsHumanReview: boolean }
  | { action: "retake"; reason: RetakeReason; message: string }
  | { action: "close_up"; checkId: string; message: string };
  
const ACCEPTED = (name: string): Decision => ({
  action: "accepted",
  message: `Clear shot. Everything we needed for ${name.toLowerCase()} is visible.`,
  needsHumanReview: false,
});

const retake = (reason: RetakeReason, message: string): Decision => ({
  action: "retake",
  reason,
  message,
});

/** Rules 1–4: the photo itself, before anything in it is considered. */
function judgeQuality(result: AnalyzePhotoResult): Decision | null {
  const { blur, exposure, framing } = result.quality;

  if (blur > THRESHOLDS.blurMax) {
    return retake(
      "blurry",
      "That one came out unclear. Wipe the lens, hold steady, and take it again.",
    );
  }
  if (exposure === "too_dark") {
    return retake(
      "too_dark",
      "It's too dark to make out. Turn on your flash or a light and try again.",
    );
  }
  if (exposure === "blown_out") {
    return retake(
      "blown_out",
      "The light has washed that one out. Try again without the flash pointing straight at it.",
    );
  }
  if (framing === "too_close") {
    return retake(
      "too_close",
      "That's a little close. Step back and take it wider so we can see the whole area.",
    );
  }
  if (framing === "too_far") {
    return retake(
      "too_far",
      "That's a little far off. Move closer so the detail is readable.",
    );
  }
  return null;
}

/** Rule 5: is what we asked for actually in the frame? */
function judgeSubject(
  result: AnalyzePhotoResult,
  task: TaskSeed,
): Decision | null {
  if (!result.quality.subjectPresent) {
    return retake(
      "wrong_subject",
      `We couldn't find ${task.name.toLowerCase()} in that shot. ${task.instruction}`,
    );
  }

  const missing = result.elements.find(
    (element) =>
      !element.visible &&
      element.confidence >= THRESHOLDS.missingElementConfidence,
  );
  if (!missing) return null;

  const element = task.requiredElements.find((item) => item.id === missing.id);
  // An id the task doesn't define means the reviewer answered off-script; that
  // is a prompt bug, not a homeowner problem, so it must not force a retake.
  if (!element) return null;

  // The description is quoted as written — lowercasing it to fit a sentence
  // mangles the terms that matter most ("P-trap", "T&P valve").
  return retake(
    "missing_element",
    `We still need this in frame — ${element.description}. Take it again with that included.`,
  );
}

/** Rule 6: a maybe worth a second, closer photo. */
function judgeFindings(
  result: AnalyzePhotoResult,
  checksById: Map<string, TaskCheck>,
): Decision | null {
  for (const finding of result.findings) {
    if (!finding.present) continue;
    const { min, max } = THRESHOLDS.uncertainFinding;
    if (finding.confidence < min || finding.confidence > max) continue;

    const check = checksById.get(finding.checkId);
    if (!check?.closeUpPrompt) continue;

    return {
      action: "close_up",
      checkId: check.id,
      message: check.closeUpPrompt,
    };
  }
  return null;
}

/**
 * @param attemptCount How many photos have already been stored for this task,
 * including the one being judged.
 */
export function decide(
  result: AnalyzePhotoResult,
  task: TaskSeed,
  attemptCount: number,
): Decision {
  // Rule 0 outranks every quality check: past the cap we take what we are given
  // and let a person sort it out.
  if (attemptCount > THRESHOLDS.maxAttempts) {
    return {
      action: "accepted",
      message: `Thanks — we've got what we need for ${task.name.toLowerCase()}.`,
      needsHumanReview: true,
    };
  }

  const checksById = new Map(task.checks.map((check) => [check.id, check]));

  return (
    judgeQuality(result) ??
    judgeSubject(result, task) ??
    judgeFindings(result, checksById) ??
    ACCEPTED(task.name)
  );
}

/** Findings worth storing as seen, rather than as a maybe. */
export function confirmedFindings(result: AnalyzePhotoResult) {
  return result.findings.filter(
    (finding) =>
      finding.present && finding.confidence > THRESHOLDS.uncertainFinding.max,
  );
}
