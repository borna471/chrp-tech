"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StepLayout } from "@/components/StepLayout";
import { setActiveSeed } from "@/lib/activeAssessment";
import { SUPPORT_EMAIL } from "@/lib/demoConfig";

/**
 * Where an invite link lands.
 *
 * Resolves the token to an assessment, records it as the one this browser is
 * working on, and hands over to the normal onboarding flow — which then asks
 * the homeowner to confirm the property before anything else.
 *
 * Nothing is written until the token is known to be good, so a bad link leaves
 * the browser exactly as it found it.
 */

function StartFlow() {
  const router = useRouter();
  const token = useSearchParams().get("t");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/assessments/by-token/${encodeURIComponent(token)}`,
        );
        if (!response.ok) throw new Error(String(response.status));
        const seed = (await response.json()) as {
          id: string;
          policyRef: string;
          homeAddress: string;
          homeownerFirstName: string;
        };
        if (cancelled) return;
        // An invited assessment starts empty — none of the demo's pre-completed
        // items, or the admin list would show progress with no photos behind it.
        setActiveSeed({ ...seed, demoStaging: false });
        router.replace("/onboarding/link-landing");
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  // A missing token needs no lookup, so it is decided during render rather than
  // by setting state from the effect.
  if (token && !failed) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-steel-600">
        Opening your assessment…
      </div>
    );
  }

  return (
    <StepLayout eyebrow="Chrp Healthy Homes" title="This link isn't valid">
      <p className="mb-4">
        It may have expired, or been copied incompletely. Check the message it
        came in and open the whole link.
      </p>
      <p className="text-steel-700">
        If it keeps happening, contact{" "}
        <a className="text-aqua-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </StepLayout>
  );
}

export default function StartPage() {
  // `useSearchParams` needs a boundary so the shell can prerender around it.
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-steel-600">
          Opening your assessment…
        </div>
      }
    >
      <StartFlow />
    </Suspense>
  );
}
