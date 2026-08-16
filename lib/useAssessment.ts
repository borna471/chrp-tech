"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/data";
import type { Assessment, PhotoTask } from "@/lib/data/types";
import { demoConfig } from "@/lib/demoConfig";

export type RowState = "done" | "skipped" | "next" | "pending";

export type AssessmentView = ReturnType<typeof useAssessment>["view"];

const seed = () => ({
  id: demoConfig.assessmentId,
  policyRef: demoConfig.policyRef,
  homeAddress: demoConfig.homeAddress,
  homeownerFirstName: demoConfig.homeownerFirstName,
});

/**
 * The assessment as the dashboard, onboarding and confirmation pages see it:
 * who the homeowner is, how far along they are, and where the flow goes next.
 * The capture flow's own state lives in `useCapture`.
 */
export function useAssessment() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [tasks, setTasks] = useState<PhotoTask[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const repository = getRepository();
    void (async () => {
      const loaded = await repository.openAssessment(seed());
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

  const submit = useCallback(async () => {
    if (!assessment) return;
    setAssessment(
      await getRepository().setAssessmentStatus(assessment.id, "complete"),
    );
  }, [assessment]);

  const completeOnboarding = useCallback(async () => {
    if (!assessment) return;
    setAssessment(await getRepository().completeOnboarding(assessment.id));
  }, [assessment]);

  const startOver = useCallback(async () => {
    const repository = getRepository();
    await repository.resetAssessment(demoConfig.assessmentId);
    const reopened = await repository.openAssessment(seed());
    setAssessment(reopened);
    setTasks(await repository.listTasks(reopened.id));
  }, []);

  const view = useMemo(() => {
    const total = tasks.length;
    const doneCount = tasks.filter((task) => task.status === "done").length;
    const remaining = total - doneCount;
    const nextIndex = tasks.findIndex((task) => task.status !== "done");
    const nextPending = tasks.find((task) => task.status === "pending") ?? null;
    const skipped = tasks.find((task) => task.status === "skipped") ?? null;

    return {
      firstName: assessment?.homeownerFirstName ?? demoConfig.homeownerFirstName,
      homeAddress: assessment?.homeAddress ?? demoConfig.homeAddress,

      doneCount,
      totalCount: total,
      progressPct: total === 0 ? 0 : Math.round((doneCount / total) * 100),
      remainingLabel: `${remaining} still to capture`,
      minutesLeft: Math.max(2, Math.round(remaining * 1.5)),
      ctaLabel:
        doneCount === 0
          ? "Start inspection capture"
          : "Continue inspection capture",

      /** Where the capture CTA points; null once nothing is left to shoot. */
      nextSlug: nextPending?.slug ?? null,
      // Skipped tasks keep this false, which is what the banner below warns about.
      allDone: total > 0 && doneCount === total,

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
    };
  }, [assessment, tasks]);

  return {
    hydrated,
    isSubmitted: assessment?.status === "complete",
    isOnboarded: assessment?.onboardingCompletedAt != null,
    view,
    submit,
    completeOnboarding,
    startOver,
  };
}
