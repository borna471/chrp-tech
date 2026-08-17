import Link from "next/link";
import { StepLayout } from "@/components/StepLayout";

export default function IntroPage() {
  return (
    <StepLayout
      eyebrow="What this is"
      title="This will be a short visual assessment of your home through photos"
      actions={
        <Link
          href="/onboarding/consent"
          className="btn btn-primary btn-block min-h-[54px] p-4 text-[17px] font-semibold tracking-[.01em]"
        >
          Continue
        </Link>
      }
    >
      <p className="mb-4">
        These will be used to uncover preventative claims you can make to
        prevent disasters in your home, which your insurer is happy to cover.
      </p>
      <div className="rounded-lg bg-surface px-4 py-3.5">
        <div className="mb-[5px] text-[10px] font-semibold tracking-[.14em] text-aqua-700 uppercase">
          What to expect
        </div>
        <div className="text-base leading-[1.35] text-pretty text-ink">
          This assessment will require 20 photos and take no more than 30
          minutes of your time.
        </div>
      </div>
    </StepLayout>
  );
}
