import Link from "next/link";
import policy from "@/content/data-use-policy.json";
import { StepLayout } from "@/components/StepLayout";

export default function ConsentPage() {
  return (
    <StepLayout
      eyebrow="Consent and data use"
      title="Please read through our data use policy"
      actions={
        <>
          <p className="text-center text-sm text-steel-700">
            Do you consent to these policies?
          </p>
          <Link
            href="/onboarding/prep"
            className="btn btn-primary btn-block min-h-[54px] p-4 text-[17px] font-semibold tracking-[.01em]"
          >
            Accept terms
          </Link>
        </>
      }
    >
      <div className="min-h-[220px] flex-1 overflow-y-auto rounded-lg border border-divider bg-surface px-4 py-3.5">
        {policy.map((section) => (
          <section key={section.heading} className="mb-4 last:mb-0">
            <h2 className="mb-1.5 text-[13px] font-semibold tracking-[.04em] text-ink uppercase">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="mb-2 text-[14px] leading-[1.5] text-pretty text-steel-800 last:mb-0"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </StepLayout>
  );
}
