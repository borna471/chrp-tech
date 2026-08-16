import { DEMO_COMPLETED_SLUGS, TASK_SEEDS } from "@/lib/tasks";
import type {
  AssessmentSeed,
  InspectionRepository,
  SaveAnalysisInput,
  SaveCaptureInput,
} from "./repository";
import type {
  Assessment,
  AssessmentStatus,
  PhotoAnalysis,
  PhotoCapture,
  PhotoTask,
  TaskStatus,
} from "./types";

const RECORDS_KEY = "chrp.assessment.v1";
const BLOB_DB_NAME = "chrp-captures";
const BLOB_STORE = "blobs";

/**
 * Records mirror the relational model in `prisma/schema.prisma`: rows keyed by
 * id, with foreign keys rather than nesting, so a server adapter returns the
 * same shapes from real tables.
 */
type Records = {
  assessments: Record<string, Assessment>;
  tasks: Record<string, PhotoTask>;
  captures: Record<string, PhotoCapture>;
  analyses: Record<string, PhotoAnalysis>;
};

const emptyRecords = (): Records => ({
  assessments: {},
  tasks: {},
  captures: {},
  analyses: {},
});

function readRecords(): Records {
  const raw = window.localStorage.getItem(RECORDS_KEY);
  if (!raw) return emptyRecords();
  try {
    return { ...emptyRecords(), ...(JSON.parse(raw) as Records) };
  } catch {
    // A corrupt or stale-shaped payload is not worth recovering in a demo —
    // start clean rather than crashing the flow on load.
    return emptyRecords();
  }
}

function writeRecords(records: Records) {
  window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function openBlobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(BLOB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BLOB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function blobTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openBlobDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(BLOB_STORE, mode).objectStore(BLOB_STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

const taskId = (assessmentId: string, slug: string) => `${assessmentId}:${slug}`;
const newId = () => window.crypto.randomUUID();
const now = () => new Date().toISOString();

function seedTasks(assessmentId: string): PhotoTask[] {
  return TASK_SEEDS.map((seed, index) => ({
    id: taskId(assessmentId, seed.slug),
    assessmentId,
    slug: seed.slug,
    name: seed.name,
    zone: seed.zone,
    risk: seed.risk,
    instruction: seed.instruction,
    tips: seed.tips,
    order: index,
    status: DEMO_COMPLETED_SLUGS.includes(seed.slug)
      ? ("done" as TaskStatus)
      : ("pending" as TaskStatus),
    followUpPrompt: null,
  }));
}

function requireTask(records: Records, id: string): PhotoTask {
  const task = records.tasks[id];
  if (!task) throw new Error(`Unknown photo task: ${id}`);
  return task;
}

/**
 * Brings an already-open assessment back in line with content/photo-tasks.json:
 * reworded items update in place, new items appear, removed items and their
 * photos go. Progress on surviving items is kept — editing an instruction must
 * not cost a homeowner the photos they have already sent.
 */
async function syncTasksToSeeds(records: Records, assessmentId: string) {
  const seeds = new Map(TASK_SEEDS.map((seed) => [seed.slug, seed]));

  for (const task of Object.values(records.tasks)) {
    if (task.assessmentId !== assessmentId) continue;
    const seed = seeds.get(task.slug);
    if (!seed) {
      await dropTask(records, task.id);
      continue;
    }
    records.tasks[task.id] = {
      ...task,
      name: seed.name,
      zone: seed.zone,
      risk: seed.risk,
      instruction: seed.instruction,
      tips: seed.tips,
      order: TASK_SEEDS.indexOf(seed),
    };
  }

  for (const task of seedTasks(assessmentId)) {
    if (!records.tasks[task.id]) records.tasks[task.id] = task;
  }
}

async function dropTask(records: Records, id: string) {
  for (const capture of Object.values(records.captures)) {
    if (capture.taskId !== id) continue;
    if (capture.storageKey) {
      await blobTransaction("readwrite", (store) =>
        store.delete(capture.storageKey as string),
      );
    }
    if (capture.analysisId) delete records.analyses[capture.analysisId];
    delete records.captures[capture.id];
  }
  delete records.tasks[id];
}

/**
 * Stores records in localStorage and photo bytes in IndexedDB. This is the only
 * adapter today; swapping in a server-backed one is a change to
 * `lib/data/index.ts` alone.
 */
export const browserRepository: InspectionRepository = {
  async openAssessment(seed: AssessmentSeed): Promise<Assessment> {
    const records = readRecords();
    const existing = records.assessments[seed.id];
    if (existing) {
      await syncTasksToSeeds(records, existing.id);
      writeRecords(records);
      return existing;
    }

    const timestamp = now();
    const assessment: Assessment = {
      id: seed.id,
      policyRef: seed.policyRef,
      homeAddress: seed.homeAddress,
      homeownerFirstName: seed.homeownerFirstName,
      status: "open",
      onboardingCompletedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    records.assessments[assessment.id] = assessment;
    for (const task of seedTasks(assessment.id)) records.tasks[task.id] = task;
    writeRecords(records);
    return assessment;
  },

  async setAssessmentStatus(
    assessmentId: string,
    status: AssessmentStatus,
  ): Promise<Assessment> {
    const records = readRecords();
    const assessment = records.assessments[assessmentId];
    if (!assessment) throw new Error(`Unknown assessment: ${assessmentId}`);
    const updated = { ...assessment, status, updatedAt: now() };
    records.assessments[assessmentId] = updated;
    writeRecords(records);
    return updated;
  },

  async completeOnboarding(assessmentId: string): Promise<Assessment> {
    const records = readRecords();
    const assessment = records.assessments[assessmentId];
    if (!assessment) throw new Error(`Unknown assessment: ${assessmentId}`);
    const timestamp = now();
    const updated = {
      ...assessment,
      onboardingCompletedAt: timestamp,
      updatedAt: timestamp,
    };
    records.assessments[assessmentId] = updated;
    writeRecords(records);
    return updated;
  },

  async listTasks(assessmentId: string): Promise<PhotoTask[]> {
    const records = readRecords();
    return Object.values(records.tasks)
      .filter((task) => task.assessmentId === assessmentId)
      .sort((a, b) => a.order - b.order);
  },

  async setTaskStatus(id: string, status: TaskStatus): Promise<PhotoTask> {
    const records = readRecords();
    const updated = { ...requireTask(records, id), status };
    records.tasks[id] = updated;
    writeRecords(records);
    return updated;
  },

  async setFollowUpPrompt(id: string, prompt: string | null): Promise<PhotoTask> {
    const records = readRecords();
    const updated = { ...requireTask(records, id), followUpPrompt: prompt };
    records.tasks[id] = updated;
    writeRecords(records);
    return updated;
  },

  async saveCapture(input: SaveCaptureInput): Promise<PhotoCapture> {
    const id = newId();
    let storageKey: string | null = null;
    if (input.blob) {
      storageKey = `capture/${id}`;
      await blobTransaction("readwrite", (store) =>
        store.put(input.blob as Blob, storageKey as string),
      );
    }

    const capture: PhotoCapture = {
      id,
      taskId: input.taskId,
      assessmentId: input.assessmentId,
      mimeType: input.blob?.type || "application/octet-stream",
      capturedAt: now(),
      isFollowUp: input.isFollowUp,
      storageKey,
      analysisId: null,
    };
    const records = readRecords();
    records.captures[id] = capture;
    writeRecords(records);
    return capture;
  },

  async getLatestCapture(id: string): Promise<PhotoCapture | null> {
    const records = readRecords();
    const captures = Object.values(records.captures)
      .filter((capture) => capture.taskId === id)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    return captures.at(-1) ?? null;
  },

  async getCaptureBlob(storageKey: string): Promise<Blob | null> {
    const stored = await blobTransaction<Blob | undefined>("readonly", (store) =>
      store.get(storageKey),
    );
    return stored ?? null;
  },

  async saveAnalysis(
    captureId: string,
    input: SaveAnalysisInput,
  ): Promise<PhotoAnalysis> {
    const records = readRecords();
    const capture = records.captures[captureId];
    if (!capture) throw new Error(`Unknown capture: ${captureId}`);

    const analysis: PhotoAnalysis = {
      id: newId(),
      captureId,
      verdict: input.verdict,
      message: input.message,
      model: input.model,
      analyzedAt: now(),
    };
    records.analyses[analysis.id] = analysis;
    records.captures[captureId] = { ...capture, analysisId: analysis.id };
    writeRecords(records);
    return analysis;
  },

  async resetAssessment(assessmentId: string): Promise<void> {
    const records = readRecords();
    for (const capture of Object.values(records.captures)) {
      if (capture.assessmentId !== assessmentId) continue;
      if (capture.storageKey) {
        await blobTransaction("readwrite", (store) =>
          store.delete(capture.storageKey as string),
        );
      }
      delete records.analyses[capture.analysisId ?? ""];
      delete records.captures[capture.id];
    }
    for (const task of Object.values(records.tasks)) {
      if (task.assessmentId === assessmentId) delete records.tasks[task.id];
    }
    delete records.assessments[assessmentId];
    writeRecords(records);
  },
};
