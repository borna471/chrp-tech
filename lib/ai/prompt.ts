import type { TaskSeed } from "@/lib/tasks";

/**
 * The prompt sent to the vision model, in two halves: a fixed system prompt that
 * never varies, and a per-task half assembled from `content/photo-tasks.json`.
 *
 * The calibration rules in the system prompt are written for a small model. Each
 * one exists because the opposite failure is the common one: an 8B model asked
 * about damage will tend to report damage, will guess at things it cannot make
 * out, and will drop a condition it is unsure about rather than scoring it low.
 */
export const SYSTEM_PROMPT = `You are a risk assessment professional reviewing a photograph taken by a homeowner for a home insurance assessment. You report what is visible in the image. You do not diagnose, advise, or draw conclusions — a human assessor does that from your report.

Rules:
- Report only what you can see in this image. Never infer from what is usually true of homes like this one.
- If you cannot see something clearly enough to be sure, say it is not visible. Do not guess.
- If you think a condition may be present but are not certain, report it as present with a low confidence score. Do not omit it, and do not round it up to certain.
- Confidence is how sure you are of your own answer, from 0 to 1. Use the middle of the range — most real answers are not 0.1 or 0.95.
- Judge framing against what the instruction asked for. A photo asked to be wide is not "too close" because a detail is large; a photo asked to be a close-up is not "too far" because it fills the frame.
- Your notes are read by an assessor, not the homeowner. Describe what you see in one short factual sentence.

Reply with JSON only. No commentary, no markdown fences.`;

const QUALITY_BLOCK = `Quality — judge the photograph itself:
- blur: 0 for sharp, 1 for unusably soft.
- framing: "too_close", "ok", or "too_far", relative to the instruction above.
- exposure: "too_dark", "ok", or "blown_out".
- subjectPresent: true only if the subject named in the instruction is actually in this frame.`;

function numbered(items: { id: string; text: string }[]): string {
  return items
    .map((item, index) => `${index + 1}. [${item.id}] ${item.text}`)
    .join("\n");
}

function outputShape(task: TaskSeed): string {
  const elements = task.requiredElements
    .map((element) => `    { "id": "${element.id}", "visible": bool, "confidence": 0-1 }`)
    .join(",\n");
  const findings = task.checks
    .map(
      (check) =>
        `    { "checkId": "${check.id}", "present": bool, "confidence": 0-1, "note": "one short sentence" }`,
    )
    .join(",\n");

  return `{
  "quality": { "blur": 0-1, "framing": "too_close|ok|too_far", "exposure": "too_dark|ok|blown_out", "subjectPresent": bool },
  "elements": [
${elements}
  ],
  "findings": [
${findings}
  ]
}`;
}

/**
 * The per-photo half of the prompt. On a follow-up the framing guidance is
 * inverted — otherwise the reviewer marks a requested close-up "too_close" and
 * the homeowner is sent round in a circle.
 */
export function buildUserPrompt(task: TaskSeed, isFollowUp: boolean): string {
  const intent = isFollowUp
    ? `This is a close-up/zoomed shot the assessor asked for, following an earlier wide/narrow shot of ${task.name.toLowerCase()}. Expect it to fill the frame — that is correct here, not "too_close" or "too_far". Judge whether the detail is legible.`
    : `The homeowner was asked: "${task.instruction}"`;

  return `${intent}

${QUALITY_BLOCK}

Required elements — for each, is it visible in this frame?
${numbered(
  task.requiredElements.map((element) => ({
    id: element.id,
    text: element.description,
  })),
)}

Checks — for each, is this condition visible in this frame?
${numbered(task.checks.map((check) => ({ id: check.id, text: check.lookFor })))}

Reply with exactly this shape, keeping every id:
${outputShape(task)}`;
}
