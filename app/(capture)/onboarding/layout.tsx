"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAssessment } from "@/lib/useAssessment";

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { hydrated, isOnboarded } = useAssessment();

  // Onboarding is a one-time gate — a homeowner who has already been through it
  // and taps their link again belongs on the photo list.
  useEffect(() => {
    if (hydrated && isOnboarded) router.replace("/");
  }, [hydrated, isOnboarded, router]);

  if (!hydrated || isOnboarded) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-steel-600">
        Loading your assessment…
      </div>
    );
  }

  return <>{children}</>;
}
