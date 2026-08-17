import Link from "next/link";
import { NewAssessmentForm } from "@/components/admin/NewAssessmentForm";

/** Creates an assessment and hands back the link that starts it. */
export default function NewAssessmentPage() {
  return (
    <>
      <Link
        href="/admin"
        className="text-[13px] font-medium text-aqua-700 hover:underline"
      >
        ← All assessments
      </Link>
      <h1 className="mt-3 mb-1 text-[28px] font-semibold">New assessment</h1>
      <p className="mb-8 text-[15px] text-steel-700">
        Creates the assessment and its 20 photo tasks, then gives you a link to
        send.
      </p>
      <NewAssessmentForm />
    </>
  );
}
