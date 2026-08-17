"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnalysisError,
  analyzePhoto,
  logAnalysis,
  logAnalysisFailure,
} from "@/lib/ai/analyzePhoto";
import { isTooBlurry } from "@/lib/ai/blur";
import { decide } from "@/lib/ai/decide";
import type { Decision } from "@/lib/ai/decide";
import type { AnalyzePhotoResult } from "@/lib/ai/types";
import { getRepository } from "@/lib/data";
import type { Assessment, PhotoCapture, PhotoTask } from "@/lib/data/types";
import { demoConfig } from "@/lib/demoConfig";
import { FOLLOW_UP_TIPS, seedForSlug } from "@/lib/tasks";
import type { TaskSeed } from "@/lib/tasks";

export type Phase = "instruct" | "analyzing" | "result" | "error";

export type CaptureView = ReturnType<typeof useCapture>["view"];

/**
 * capturing and calling photo reviewers. Moves to next task or back to dashboard.
 */
export function useCapture(slug: string) {
  const router = useRouter();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [tasks, setTasks] = useState<PhotoTask[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [phase, setPhase] = useState<Phase>("instruct");
  const [capture, setCapture] = useState<PhotoCapture | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [result, setResult] = useState<AnalyzePhotoResult | null>(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  /** Why the review failed, when the reason is worth saying out loud. Used for debugging. */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setDecision(null);
    setErrorMessage(null);
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

  /** Persists the reviewer's observations plus what we did with them. */
  const commit = useCallback(
    async (
      task: PhotoTask,
      seed: TaskSeed,
      saved: PhotoCapture,
      analysis: AnalyzePhotoResult,
      chosen: Decision,
    ) => {
      const repository = getRepository();
      const severityOf = (checkId: string) =>
        seed.checks.find((check) => check.id === checkId)?.severity ?? "advisory";

      await repository.saveAnalysis(saved.id, {
        action: chosen.action,
        message: chosen.message,
        reason: chosen.action === "retake" ? chosen.reason : null,
        quality: analysis.quality,
        elements: analysis.elements,
        findings: analysis.findings.map((finding) => ({
          ...finding,
          severity: severityOf(finding.checkId),
        })),
        needsHumanReview:
          chosen.action === "accepted" ? chosen.needsHumanReview : false,
        model: analysis.model,
        elapsedMs: analysis.elapsedMs,
      });

      // A close-up marks the task as awaiting one, which is what makes the next
      // shot render — and be judged — as a close-up rather than a fresh attempt.
      if (chosen.action === "close_up") {
        const updated = await repository.setFollowUpPrompt(
          task.id,
          chosen.message,
        );
        setTasks((previous) =>
          previous.map((item) => (item.id === updated.id ? updated : item)),
        );
      }

      setResult(analysis);
      setDecision(chosen);
      setPhase("result");
    },
    [],
  );

  const runAnalysis = useCallback(
    async (task: PhotoTask, saved: PhotoCapture, blob: Blob | null) => {
      const seed = seedForSlug(task.slug);
      if (!seed) {
        setPhase("error");
        return;
      }
      const isFollowUp = task.followUpPrompt !== null;
      const attempt = (await getRepository().listCaptures(task.id)).length;

      try {
        // The blur gate runs first so an obviously soft photo costs nothing: no
        // model call, and the homeowner hears back immediately rather than after
        // a round trip. A capture with no bytes is the demo's stand-in and skips it.
        if (blob && (await isTooBlurry(blob))) {
          const blurred: AnalyzePhotoResult = {
            quality: {
              blur: 1,
              framing: "ok",
              exposure: "ok",
              subjectPresent: true,
            },
            elements: [],
            findings: [],
            model: "client:laplacian",
            elapsedMs: 0,
          };
          const chosen = decide(blurred, seed, attempt);
          logAnalysis(seed, attempt, blurred, chosen);
          await commit(task, seed, saved, blurred, chosen);
          return;
        }

        const analysis = await analyzePhoto({
          captureId: saved.id,
          task: seed,
          isFollowUp,
          blob,
        });

        let chosen = decide(analysis, seed, attempt);
        // The demo switch never suppresses a retake or a finding — it only skips
        // the close-up detour so the flow can be walked straight through.
        if (chosen.action === "close_up" && !demoConfig.aiFollowUps) {
          chosen = {
            action: "accepted",
            message: `Clear shot. Everything we needed for ${task.name.toLowerCase()} is visible.`,
            needsHumanReview: false,
          };
        }

        logAnalysis(seed, attempt, analysis, chosen);
        await commit(task, seed, saved, analysis, chosen);
      } catch (error) {
        const failure = error instanceof AnalysisError ? error : null;
        logAnalysisFailure(seed, attempt, error, failure?.raw);
        // A cold endpoint is a wait rather than a fault, so it is the one
        // failure a homeowner is told about specifically. Under the debug flag
        // every failure shows its real reason instead — a misconfigured endpoint
        // is otherwise indistinguishable from a model that answered badly.
        setErrorMessage(
          failure && (failure.warmingUp || demoConfig.showAnalysisDebug)
            ? failure.message
            : null,
        );
        setPhase("error");
      }
    },
    [commit],
  );

  const shoot = useCallback(
    async (blob: Blob) => {
      const task = current;
      if (!task || !assessment) return;

      setPhotoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
      setResult(null);
      setErrorMessage(null);
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
    // Nothing happens until a file arrives — on a desktop that means the page
    // waits on the picker rather than moving on without a photo to review.
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void shoot(file);
    });
    input.click();
  }, [shoot]);

  const retryAnalysis = useCallback(async () => {
    if (!current || !capture) return;
    setErrorMessage(null);
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
    // A close-up or a retake both mean shooting this task again — the task is
    // only settled once the photo was accepted.
    if (decision && decision.action !== "accepted") {
      clearPhoto();
      setPhase("instruct");
      return;
    }
    await settle("done");
  }, [clearPhoto, current, decision, settle]);

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
    decision,
    result,
    errorMessage,
    photoUrl,
    savedPhotoUrl,
    openCamera,
    retake,
    retryAnalysis,
    advance,
    skipTask,
  };
}
