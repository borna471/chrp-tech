"use client";

import type { AssessmentSeed } from "@/lib/data/repository";
import { demoConfig } from "@/lib/demoConfig";

/**
 * Which assessment this browser is working on.
 *
 * Set once by `/start` when an invite link is followed, and read by every hook
 * that opens the repository. Without an invite it falls back to `demoConfig`, so
 * visiting the app directly still walks the original demo assessment.
 *
 * This is what makes the app multi-tenant: task ids are `${assessmentId}:${slug}`,
 * so two invited homeowners get genuinely separate records with no other change.
 */

const ACTIVE_KEY = "chrp.activeAssessment.v1";

const DEMO_SEED: AssessmentSeed = {
  id: demoConfig.assessmentId,
  policyRef: demoConfig.policyRef,
  homeAddress: demoConfig.homeAddress,
  homeownerFirstName: demoConfig.homeownerFirstName,
  // The demo opens with three photos already marked done. A real invite must not.
  demoStaging: true,
};

function isSeed(value: unknown): value is AssessmentSeed {
  if (typeof value !== "object" || value === null) return false;
  const seed = value as Record<string, unknown>;
  return (
    typeof seed.id === "string" &&
    typeof seed.policyRef === "string" &&
    typeof seed.homeAddress === "string" &&
    typeof seed.homeownerFirstName === "string"
  );
}

export function getActiveSeed(): AssessmentSeed {
  if (typeof window === "undefined") return DEMO_SEED;
  try {
    const raw = window.localStorage.getItem(ACTIVE_KEY);
    if (!raw) return DEMO_SEED;
    const parsed: unknown = JSON.parse(raw);
    // A malformed value would otherwise strand the homeowner in an assessment
    // that cannot be opened; falling back to the demo is recoverable.
    return isSeed(parsed) ? { demoStaging: false, ...parsed } : DEMO_SEED;
  } catch {
    return DEMO_SEED;
  }
}

const listeners = new Set<() => void>();

/**
 * `/start` swaps the seed and then navigates client-side, which does not remount
 * the layout — so anything already on screen has to be told, or the header keeps
 * showing whichever policy reference it read first.
 */
export function subscribeActiveSeed(listener: () => void): () => void {
  listeners.add(listener);
  // `storage` covers the other direction: a second tab following an invite.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setActiveSeed(seed: AssessmentSeed): void {
  window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(seed));
  for (const listener of listeners) listener();
}
