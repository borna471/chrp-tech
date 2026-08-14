import rawTasks from "@/content/photo-tasks.json";

/**
 * The photo list is content, not code: it lives in `content/photo-tasks.json` so
 * it can be reworded without touching the app. See `content/README.md` for the
 * field-by-field guide. This module loads that file, checks it, and hands the app
 * the shapes it expects.
 */
export type TaskSeed = {
  slug: string;
  name: string;
  zone: string;
  risk: string;
  instruction: string;
  tips: string[];
  followUpPrompt: string | null;
};

function fail(index: number, problem: string): never {
  throw new Error(
    `content/photo-tasks.json: item ${index + 1} ${problem}. See content/README.md.`,
  );
}

function requireText(value: unknown, index: number, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(index, `is missing "${field}"`);
  }
  return value;
}

function parseTaskSeeds(input: unknown): TaskSeed[] {
  if (!Array.isArray(input)) {
    throw new Error("content/photo-tasks.json must contain a JSON array.");
  }

  const seen = new Set<string>();
  return input.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) fail(index, "is not an object");
    const item = entry as Record<string, unknown>;

    const slug = requireText(item.slug, index, "slug");
    if (seen.has(slug)) fail(index, `repeats the slug "${slug}"`);
    seen.add(slug);

    if (!Array.isArray(item.tips) || item.tips.length === 0) {
      fail(index, `("${slug}") needs at least one entry in "tips"`);
    }

    return {
      slug,
      name: requireText(item.name, index, "name"),
      zone: requireText(item.zone, index, "zone"),
      risk: requireText(item.risk, index, "risk"),
      instruction: requireText(item.instruction, index, "instruction"),
      tips: item.tips.map((tip, tipIndex) =>
        requireText(tip, index, `tips[${tipIndex}]`),
      ),
      followUpPrompt:
        typeof item.followUpPrompt === "string" ? item.followUpPrompt : null,
    };
  });
}

export const TASK_SEEDS: TaskSeed[] = parseTaskSeeds(rawTasks as unknown);

/** Tasks the reviewer asks a close-up for, keyed by task slug. */
export const FOLLOW_UP_PROMPTS: Record<string, string> = Object.fromEntries(
  TASK_SEEDS.filter((seed) => seed.followUpPrompt !== null).map((seed) => [
    seed.slug,
    seed.followUpPrompt as string,
  ]),
);

/** What the capture screen shows instead of the task's own tips on a follow-up. */
export const FOLLOW_UP_TIPS = [
  "Fill the frame with the spot",
  "Hold steady, tap to focus",
  "Turn on your flash if it's dark",
];

/** Demo staging, not content: which items open as already captured. */
export const DEMO_COMPLETED_SLUGS = [
  "vegetation-fire-exposure",
  "roof-eaves-and-vents",
  "electrical-panel",
];
