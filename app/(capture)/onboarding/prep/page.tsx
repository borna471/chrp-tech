"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { StepLayout } from "@/components/StepLayout";
import { useAssessment } from "@/lib/useAssessment";

const REQUIREMENTS = [
  "Daylight for exterior photos",
  "A charged phone and clean camera lens",
  "Opening cabinets and doors around home",
  "No ladders or tools required",
];

export default function PrepPage() {
  const router = useRouter();
  const { completeOnboarding } = useAssessment();

  return (
    <StepLayout
      eyebrow="Before you start"
      title="This assessment will require:"
      actions={
        <Button
          variant="primary"
          block
          onClick={() => void completeOnboarding().then(() => router.push("/"))}
          className="min-h-[54px] p-4 text-[17px] font-semibold tracking-[.01em]"
        >
          I understand
        </Button>
      }
    >
      {REQUIREMENTS.map((requirement) => (
        <div key={requirement} className="mb-3 flex gap-2.5">
          <span className="mt-2.5 h-[7px] w-[7px] flex-none rounded-full bg-aqua" />
          <span>{requirement}</span>
        </div>
      ))}
    </StepLayout>
  );
}
