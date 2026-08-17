import rawTasks from "@/content/photo-tasks.json";

/**
 * The photo list is content, not code: it lives in `content/photo-tasks.json` so
 * it can be reworded without touching the app. See `content/README.md` for the
 * field-by-field guide. This module loads that file, checks it, and hands the app
 * the shapes it expects.
 */
export type Severity = "advisory" | "attention" | "urgent";

const SEVERITIES: Severity[] = ["advisory", "attention", "urgent"];

/** Something that must be visible for the photo to count. Drives retakes. */
export type RequiredElement = {
  id: string;
  description: string;
};

/** A condition the reviewer looks for. Drives the insurer-facing findings. */
export type TaskCheck = {
  id: string;
  lookFor: string;
  severity: Severity;
  /** Set when an uncertain finding here is worth a second, closer photo. */
  closeUpPrompt: string | null;
};

export type TaskSeed = {
  slug: string;
  name: string;
  zone: string;
  risk: string;
  instruction: string;
  tips: string[];
  requiredElements: RequiredElement[];
  checks: TaskCheck[];
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

function requireList(value: unknown, index: number, field: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(index, `needs at least one entry in "${field}"`);
  }
  return value;
}

/**
 * Ids are how a reviewer's answer is matched back to the element or check it
 * refers to, so a duplicate would silently overwrite a result rather than error.
 */
function requireId(
  value: unknown,
  index: number,
  field: string,
  seen: Set<string>,
): string {
  const id = requireText(value, index, field);
  if (seen.has(id)) fail(index, `repeats the id "${id}" in "${field}"`);
  seen.add(id);
  return id;
}

function parseRequiredElements(value: unknown, index: number): RequiredElement[] {
  const seen = new Set<string>();
  return requireList(value, index, "requiredElements").map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      fail(index, `has a requiredElements[${i}] that is not an object`);
    }
    const item = entry as Record<string, unknown>;
    return {
      id: requireId(item.id, index, `requiredElements[${i}].id`, seen),
      description: requireText(
        item.description,
        index,
        `requiredElements[${i}].description`,
      ),
    };
  });
}

function parseChecks(value: unknown, index: number): TaskCheck[] {
  const seen = new Set<string>();
  return requireList(value, index, "checks").map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      fail(index, `has a checks[${i}] that is not an object`);
    }
    const item = entry as Record<string, unknown>;
    const severity = requireText(item.severity, index, `checks[${i}].severity`);
    if (!SEVERITIES.includes(severity as Severity)) {
      fail(
        index,
        `has checks[${i}].severity "${severity}" — expected ${SEVERITIES.join(", ")}`,
      );
    }
    return {
      id: requireId(item.id, index, `checks[${i}].id`, seen),
      lookFor: requireText(item.lookFor, index, `checks[${i}].lookFor`),
      severity: severity as Severity,
      closeUpPrompt:
        typeof item.closeUpPrompt === "string" ? item.closeUpPrompt : null,
    };
  });
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

    return {
      slug,
      name: requireText(item.name, index, "name"),
      zone: requireText(item.zone, index, "zone"),
      risk: requireText(item.risk, index, "risk"),
      instruction: requireText(item.instruction, index, "instruction"),
      tips: requireList(item.tips, index, "tips").map((tip, tipIndex) =>
        requireText(tip, index, `tips[${tipIndex}]`),
      ),
      requiredElements: parseRequiredElements(item.requiredElements, index),
      checks: parseChecks(item.checks, index),
    };
  });
}

export const TASK_SEEDS: TaskSeed[] = parseTaskSeeds(rawTasks as unknown);

const SEEDS_BY_SLUG = new Map(TASK_SEEDS.map((seed) => [seed.slug, seed]));

/**
 * The content behind a stored task. `requiredElements` and `checks` are prompt
 * material that only the reviewer needs, so they stay in content and are looked
 * up by slug rather than copied onto every stored row where they would go stale.
 */
export function seedForSlug(slug: string): TaskSeed | null {
  return SEEDS_BY_SLUG.get(slug) ?? null;
}

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
