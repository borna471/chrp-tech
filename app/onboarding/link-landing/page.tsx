"use client";

import Link from "next/link";
import { StepLayout } from "@/components/StepLayout";
import { useAssessment } from "@/lib/useAssessment";

export default function LinkLandingPage() {
  const { view } = useAssessment();

  return (
    <StepLayout
      eyebrow="Chrp Healthy Homes"
      title="Welcome to your CHRP assessment portal"
      actions={
        <>
          <Link
            href="/onboarding/intro"
            className="btn btn-primary btn-block min-h-[54px] p-4 text-[17px] font-semibold tracking-[.01em]"
          >
            Yes, this is my property
          </Link>
          <Link
            href="/onboarding/wrong-property"
            className="btn btn-secondary btn-block min-h-[48px] text-base"
          >
            No, this isn&apos;t my property
          </Link>
        </>
      }
    >
      <p className="mb-4">Is this your property address?</p>
      <div className="rounded-lg bg-surface px-4 py-3.5">
        <div className="mb-[5px] text-[10px] font-semibold tracking-[.14em] text-aqua-700 uppercase">
          Property on file
        </div>
        <div className="text-[19px] leading-[1.3] font-medium text-pretty text-ink">
          {view.homeAddress}
        </div>
      </div>
    </StepLayout>
  );
}
