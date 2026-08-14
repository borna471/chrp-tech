"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzePhoto } from "@/lib/ai/analyzePhoto";
import type { AnalyzePhotoResult } from "@/lib/ai/types";
import { getRepository } from "@/lib/data";
import type { Assessment, PhotoCapture, PhotoTask } from "@/lib/data/types";
import { demoConfig } from "@/lib/demoConfig";
import { FOLLOW_UP_TIPS } from "@/lib/tasks";

export type Screen = "home" | "capture" | "done";
export type Phase = "instruct" | "analyzing" | "result" | "error";
export type RowState = "done" | "skipped" | "next" | "pending";

/**
 * How long to wait after opening the camera before standing in a photo. On a
 * desktop the file picker may never return anything, and the demo has to keep
 * moving; a real capture arriving first cancels this.
 */
const DEMO_AUTO_SHOT_MS = 900;

export type Inspection = ReturnType<typeof useInspection>;
export type InspectionView = Inspection["view"];

export function useInspection() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [tasks, setTasks] = useState<PhotoTask[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [screen, setScreen] = useState<Screen>("home");
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("instruct");
  const [capture, setCapture] = useState<PhotoCapture | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzePhotoResult | null>(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);

  const autoShotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    const repository = getRepository();
    void (async () => {
      const loaded = await repository.openAssessment({
        id: demoConfig.assessmentId,
        policyRef: demoConfig.policyRef,
        homeAddress: demoConfig.homeAddress,
        homeownerFirstName: demoConfig.homeownerFirstName,
      });
      const loadedTasks = await repository.listTasks(loaded.id);
      if (cancelled) return;
      setAssessment(loaded);
      setTasks(loadedTasks);
      setScreen(loaded.status === "complete" ? "done" : "home");
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (autoShotTimer.current) clearTimeout(autoShotTimer.current);
    },
    [],
  );

  const clearPhoto = useCallback(() => {
    setPhotoUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setCapture(null);
    setResult(null);
  }, []);

  const current = tasks[idx] ?? tasks[0] ?? null;

  // The photo already on file for this task, so a homeowner returning to it
  // after a refresh sees their own shot rather than a blank instruction.
  useEffect(() => {
    if (!current || phase !== "instruct") return;
    let cancelled = false;
    let created: string | null = null;
    void (async () => {
      const repository = getRepository();
      const latest = await repository.getLatestCapture(current.id);
      if (!latest?.storageKey) return;
      const blob = await repository.getCaptureBlob(latest.storageKey);
      if (!blob || cancelled) return;
      created = URL.createObjectURL(blob);
      setSavedPhotoUrl(created);
    })();
    return () => {
      cancelled = true;
      setSavedPhotoUrl(null);
      if (created) URL.revokeObjectURL(created);
    };
  }, [current, phase]);

  const firstPendingIndex = useCallback(() => {
    const index = tasks.findIndex((task) => task.status !== "done");
    return index === -1 ? 0 : index;
  }, [tasks]);

  const start = useCallback(() => {
    if (tasks.length === 0) return;
    if (tasks.every((task) => task.status === "done")) {
      setScreen("done");
      return;
    }
    clearPhoto();
    setIdx(firstPendingIndex());
    setPhase("instruct");
    setScreen("capture");
  }, [clearPhoto, firstPendingIndex, tasks]);

  const goHome = useCallback(() => {
    clearPhoto();
    setPhase("instruct");
    setScreen("home");
  }, [clearPhoto]);

  const runAnalysis = useCallback(
    async (task: PhotoTask, saved: PhotoCapture, blob: Blob | null) => {
      const repository = getRepository();
      const isFollowUp = task.followUpPrompt !== null;
      try {
        const analysis = await analyzePhoto({
          captureId: saved.id,
          taskSlug: task.slug,
          taskName: task.name,
          zone: task.zone,
          instruction: task.instruction,
          isFollowUp,
          blob,
        });
        // The demo switch never suppresses a real reviewer verdict — it only
        // exists so the flow can be walked without the close-up detour.
        const effective: AnalyzePhotoResult =
          analysis.verdict === "follow_up" && !demoConfig.aiFollowUps
            ? {
                ...analysis,
                verdict: "accepted",
                message: `Clear shot. Everything we needed for ${task.name.toLowerCase()} is visible.`,
              }
            : analysis;

        await repository.saveAnalysis(saved.id, effective);
        if (effective.verdict === "follow_up") {
          const updated = await repository.setFollowUpPrompt(
            task.id,
            effective.message,
          );
          setTasks((previous) =>
            previous.map((item) => (item.id === updated.id ? updated : item)),
          );
        }
        setResult(effective);
        setPhase("result");
      } catch {
        setPhase("error");
      }
    },
    [],
  );

  const shoot = useCallback(
    async (blob: Blob | null) => {
      if (autoShotTimer.current) clearTimeout(autoShotTimer.current);
      const task = current;
      if (!task || !assessment) return;

      setPhotoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return blob ? URL.createObjectURL(blob) : null;
      });
      setResult(null);
      setPhase("analyzing");

      const saved = await getRepository().saveCapture({
        taskId: task.id,
        assessmentId: assessment.id,
        isFollowUp: task.followUpPrompt !== null,
        blob,
      });
      setCapture(saved);
      await runAnalysis(task, saved, blob);
    },
    [assessment, current, runAnalysis],
  );

  const openCamera = useCallback(() => {
    // A detached input, created per capture: the picker is fire-and-forget, and
    // a fresh element means picking the same file twice in a row still fires.
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.addEventListener("change", () => {
      if (autoShotTimer.current) clearTimeout(autoShotTimer.current);
      void shoot(input.files?.[0] ?? null);
    });
    input.click();

    if (autoShotTimer.current) clearTimeout(autoShotTimer.current);
    autoShotTimer.current = setTimeout(() => {
      if (phaseRef.current === "instruct") void shoot(null);
    }, DEMO_AUTO_SHOT_MS);
  }, [shoot]);

  const retryAnalysis = useCallback(async () => {
    if (!current || !capture) return;
    setPhase("analyzing");
    const blob = capture.storageKey
      ? await getRepository().getCaptureBlob(capture.storageKey)
      : null;
    await runAnalysis(current, capture, blob);
  }, [capture, current, runAnalysis]);

  const retake = useCallback(() => {
    clearPhoto();
    setPhase("instruct");
  }, [clearPhoto]);

  const moveTo = useCallback(
    (nextTasks: PhotoTask[], startIndex: number) => {
      // Skipped tasks are deliberately not revisited — the home screen chases
      // them with a banner instead.
      const forward = nextTasks.findIndex(
        (task, index) => index > startIndex && task.status === "pending",
      );
      const target =
        forward !== -1
          ? forward
          : nextTasks.findIndex((task) => task.status === "pending");

      clearPhoto();
      setPhase("instruct");
      if (target === -1) {
        setScreen("done");
        if (assessment) {
          void getRepository()
            .setAssessmentStatus(assessment.id, "complete")
            .then(setAssessment);
        }
        return;
      }
      setIdx(target);
    },
    [assessment, clearPhoto],
  );

  const advance = useCallback(async () => {
    if (!current) return;
    if (result?.verdict === "follow_up") {
      // Same task again, this time as the close-up the reviewer asked for.
      clearPhoto();
      setPhase("instruct");
      return;
    }
    const updated = await getRepository().setTaskStatus(current.id, "done");
    const nextTasks = tasks.map((task) =>
      task.id === updated.id ? updated : task,
    );
    setTasks(nextTasks);
    moveTo(nextTasks, idx);
  }, [clearPhoto, current, idx, moveTo, result, tasks]);

  const skipTask = useCallback(async () => {
    if (!current) return;
    const updated = await getRepository().setTaskStatus(current.id, "skipped");
    const nextTasks = tasks.map((task) =>
      task.id === updated.id ? updated : task,
    );
    setTasks(nextTasks);
    moveTo(nextTasks, idx);
  }, [current, idx, moveTo, tasks]);

  const startOver = useCallback(async () => {
    const repository = getRepository();
    await repository.resetAssessment(demoConfig.assessmentId);
    const reopened = await repository.openAssessment({
      id: demoConfig.assessmentId,
      policyRef: demoConfig.policyRef,
      homeAddress: demoConfig.homeAddress,
      homeownerFirstName: demoConfig.homeownerFirstName,
    });
    clearPhoto();
    setAssessment(reopened);
    setTasks(await repository.listTasks(reopened.id));
    setIdx(0);
    setPhase("instruct");
    setScreen("home");
  }, [clearPhoto]);

  const view = useMemo(() => {
    const total = tasks.length;
    const doneCount = tasks.filter((task) => task.status === "done").length;
    const remaining = total - doneCount;
    const nextIndex = firstPendingIndex();
    const skipped = tasks.find((task) => task.status === "skipped") ?? null;
    const isFollowUpShot = current?.followUpPrompt != null;

    return {
      firstName: assessment?.homeownerFirstName ?? demoConfig.homeownerFirstName,
      homeAddress: assessment?.homeAddress ?? demoConfig.homeAddress,
      policyRef: assessment?.policyRef ?? demoConfig.policyRef,

      doneCount,
      totalCount: total,
      progressPct: total === 0 ? 0 : Math.round((doneCount / total) * 100),
      remainingLabel: `${remaining} still to capture`,
      minutesLeft: Math.max(2, Math.round(remaining * 1.5)),
      ctaLabel:
        doneCount === 0
          ? "Start inspection capture"
          : doneCount === total
            ? "Review my photos"
            : "Continue inspection capture",

      flagText: skipped
        ? `You skipped ${skipped.name}. We can't close the assessment without it.`
        : null,

      rows: tasks.map((task, index) => ({
        id: task.id,
        name: task.name,
        zone: `${task.zone} · ${task.risk}`,
        state: (task.status === "done"
          ? "done"
          : task.status === "skipped"
            ? "skipped"
            : index === nextIndex
              ? "next"
              : "pending") as RowState,
      })),

      stepLabel: `Photo ${idx + 1} of ${total}`,
      currentName: current
        ? isFollowUpShot
          ? `${current.name} — close-up`
          : current.name
        : "",
      // The shot on screen is labelled by what it actually was, not by whether a
      // follow-up has since been requested for the task.
      capturedName: current
        ? capture?.isFollowUp
          ? `${current.name} — close-up`
          : current.name
        : "",
      currentZone: current ? `${current.zone} · ${current.risk}` : "",
      currentInstruction: isFollowUpShot
        ? (current?.followUpPrompt ?? "")
        : (current?.instruction ?? ""),
      currentTips: isFollowUpShot ? FOLLOW_UP_TIPS : (current?.tips ?? []),
    };
  }, [assessment, capture, current, firstPendingIndex, idx, tasks]);

  return {
    hydrated,
    screen,
    phase,
    view,
    result,
    photoUrl,
    savedPhotoUrl,
    start,
    goHome,
    openCamera,
    retake,
    retryAnalysis,
    advance,
    skipTask,
    startOver,
  };
}
