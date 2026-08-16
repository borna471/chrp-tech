"use client";

import { useRouter } from "next/navigation";
import { StepLayout } from "@/components/StepLayout";
import { useAssessment } from "@/lib/useAssessment";

export default function ConfirmationPage() {
  const router = useRouter();
  const { startOver } = useAssessment();

  return (
    <StepLayout
      eyebrow="Assessment submitted"
      title="Thank you for submitting your captured photos!"
    >
      <p>
        Our assessment team will take a further look at your photos. We will be
        in touch through email about next steps and claims that would be
        available based on your assessment.
      </p>
      {/* Demo staging, not part of the journey: without it a submitted
          assessment is a one-way door, since the dashboard now redirects here. */}
      <button
        type="button"
        onClick={() =>
          void startOver().then(() => router.push("/onboarding/link-landing"))
        }
        className="mt-6 self-start text-xs text-steel-500 underline underline-offset-2 hover:text-aqua-700"
      >
        Start this demo over
      </button>
    </StepLayout>
  );
}
