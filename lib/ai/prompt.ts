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
- Confidence is always how likely it is that the thing is there, from 0 to 1 — never how sure you are of your own answer. An element you cannot find scores near 0, not near 1. Use the middle of the range — most real answers are not 0.1 or 0.95.
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
 * The same shape as `outputShape`, as a JSON Schema for the endpoint's guided
 * decoding. vLLM constrains generation to this grammar, which is what makes the
 * response shape guaranteed rather than requested: an enum cannot come back as
 * "too close" with a space, and an id cannot be invented, renamed or dropped.
 *
 * `outputShape` stays in the prompt as well — the grammar forces the shape, but
 * seeing the target still helps a small model fill it in sensibly.
 *
 * Deliberately limited to objects, arrays, enums, numbers and booleans: that is
 * the subset the constrained-decoding backend handles without complaint.
 */
export function outputSchema(task: TaskSeed) {
  // A single-value enum is how an id is pinned: the model can only emit this
  // exact string in this exact position.
  const fixed = (
    ids: string[],
    key: string,
    extra: Record<string, unknown>,
  ) => ({
    type: "array",
    minItems: ids.length,
    maxItems: ids.length,
    // `prefixItems` rather than an `items` array: it is the 2020-12 spelling of
    // a tuple, and the one the constrained-decoding backend understands.
    prefixItems: ids.map((id) => ({
      type: "object",
      properties: { [key]: { type: "string", enum: [id] }, ...extra },
      required: [key, ...Object.keys(extra)],
      additionalProperties: false,
    })),
  });

  // No numeric bounds: a grammar cannot enforce a range, and `parseResult`
  // already clamps to 0–1. Keywords the backend must ignore are worth omitting.
  const confidence = { type: "number" };

  return {
    type: "object",
    properties: {
      quality: {
        type: "object",
        properties: {
          blur: confidence,
          framing: { type: "string", enum: ["too_close", "ok", "too_far"] },
          exposure: { type: "string", enum: ["too_dark", "ok", "blown_out"] },
          subjectPresent: { type: "boolean" },
        },
        required: ["blur", "framing", "exposure", "subjectPresent"],
        additionalProperties: false,
      },
      elements: fixed(
        task.requiredElements.map((element) => element.id),
        "id",
        { visible: { type: "boolean" }, confidence },
      ),
      findings: fixed(task.checks.map((check) => check.id), "checkId", {
        present: { type: "boolean" },
        confidence,
        note: { type: "string" },
      }),
    },
    required: ["quality", "elements", "findings"],
    additionalProperties: false,
  };
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

Required elements — for each, is it visible in this frame? Confidence is how likely it is to be present, so score one you cannot find near 0.
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
