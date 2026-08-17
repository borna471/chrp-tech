"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzePhoto } from "@/lib/ai/analyzePhoto";
import type { AnalyzePhotoResult } from "@/lib/ai/types";
import { getRepository } from "@/lib/data";
import type { Assessment, PhotoCapture, PhotoTask } from "@/lib/data/types";
import { demoConfig } from "@/lib/demoConfig";
import { FOLLOW_UP_TIPS } from "@/lib/tasks";

export type Phase = "instruct" | "analyzing" | "result" | "error";

export type CaptureView = ReturnType<typeof useCapture>["view"];

/**
 * How long to wait after opening the camera before standing in a photo. On a
 * desktop the file picker may never return anything, and the demo has to keep
 * moving; a real capture arriving first cancels this.
 */
const DEMO_AUTO_SHOT_MS = 900;

/**
 * One photo task, addressed by its slug in the URL. Owns everything about
 * capturing and reviewing that one shot; when the task is settled it hands the
 * homeowner on to the next slug, or back to the dashboard when none is left.
 */
export function useCapture(slug: string) {
  const router = useRouter();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [tasks, setTasks] = useState<PhotoTask[]>([]);
  const [hydrated, setHydrated] = useState(false);

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

  const current = tasks.find((task) => task.slug === slug) ?? null;

  // A slug that names no task is a dead link — send them back to the list.
  useEffect(() => {
    if (hydrated && !current) router.replace("/");
  }, [current, hydrated, router]);

  const clearPhoto = useCallback(() => {
    setPhotoUrl((existing) => {
      if (existing) URL.revokeObjectURL(existing);
      return null;
    });
    setCapture(null);
    setResult(null);
  }, []);

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

  const moveOn = useCallback(
    (nextTasks: PhotoTask[]) => {
      // Skipped tasks are deliberately not revisited — the dashboard chases them
      // with a banner instead.
      const order = current?.order ?? -1;
      const forward = nextTasks.find(
        (task) => task.order > order && task.status === "pending",
      );
      const target =
        forward ?? nextTasks.find((task) => task.status === "pending") ?? null;

      clearPhoto();
      setPhase("instruct");
      router.push(target ? `/capture/${target.slug}` : "/");
    },
    [clearPhoto, current, router],
  );

  const settle = useCallback(
    async (status: "done" | "skipped") => {
      if (!current) return;
      const updated = await getRepository().setTaskStatus(current.id, status);
      const nextTasks = tasks.map((task) =>
        task.id === updated.id ? updated : task,
      );
      setTasks(nextTasks);
      moveOn(nextTasks);
    },
    [current, moveOn, tasks],
  );

  const advance = useCallback(async () => {
    if (!current) return;
    if (result?.verdict === "follow_up") {
      // Same task again, this time as the close-up the reviewer asked for.
      clearPhoto();
      setPhase("instruct");
      return;
    }
    await settle("done");
  }, [clearPhoto, current, result, settle]);

  const skipTask = useCallback(() => settle("skipped"), [settle]);

  const view = useMemo(() => {
    const total = tasks.length;
    const doneCount = tasks.filter((task) => task.status === "done").length;
    const isFollowUpShot = current?.followUpPrompt != null;

    return {
      progressPct: total === 0 ? 0 : Math.round((doneCount / total) * 100),
      stepLabel: `Photo ${(current?.order ?? 0) + 1} of ${total}`,
      // Mirrors the row this photo has in the dashboard's list.
      status: current?.status ?? "pending",
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
      currentSlug: current?.slug ?? "",
      currentZone: current ? `${current.zone} · ${current.risk}` : "",
      currentInstruction: isFollowUpShot
        ? (current?.followUpPrompt ?? "")
        : (current?.instruction ?? ""),
      currentTips: isFollowUpShot ? FOLLOW_UP_TIPS : (current?.tips ?? []),
    };
  }, [capture, current, tasks]);

  return {
    ready: hydrated && current !== null,
    phase,
    view,
    result,
    photoUrl,
    savedPhotoUrl,
    openCamera,
    retake,
    retryAnalysis,
    advance,
    skipTask,
  };
}
