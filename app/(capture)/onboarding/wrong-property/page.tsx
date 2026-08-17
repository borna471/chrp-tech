import { StepLayout } from "@/components/StepLayout";

export default function WrongPropertyPage() {
  return (
    <StepLayout
      eyebrow="Wrong property"
      title="Thank you, we'll get back to you with a new link shortly."
    >
      <p>
        We&apos;ve flagged this assessment for review. There&apos;s nothing else
        to do here — you can close this page.
      </p>
    </StepLayout>
  );
}
