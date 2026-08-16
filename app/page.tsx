"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/demoConfig";
import { useAssessment } from "@/lib/useAssessment";
import type { RowState } from "@/lib/useAssessment";

const MARK: Record<RowState, string> = {
  done: "✓",
  skipped: "!",
  next: "",
  pending: "",
};

const MARK_CLASS: Record<RowState, string> = {
  done: "border-accent bg-accent text-white",
  skipped: "border-aqua text-aqua-700",
  next: "border-steel-400",
  pending: "border-steel-400",
};

const STATUS_LABEL: Record<RowState, string> = {
  done: "Done",
  skipped: "Skipped",
  next: "Next",
  pending: "",
};

const STATUS_CLASS: Record<RowState, string> = {
  done: "text-steel-500 font-normal",
  skipped: "text-aqua-700 font-semibold",
  next: "text-accent-700 font-semibold",
  pending: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const { hydrated, isSubmitted, view, submit, startOver } = useAssessment();
  const [confirming, setConfirming] = useState(false);

  // A submitted assessment is closed — a refresh must not reopen it for editing.
  useEffect(() => {
    if (hydrated && isSubmitted) router.replace("/confirmation");
  }, [hydrated, isSubmitted, router]);

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-steel-600">
        Loading your assessment…
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pb-[160px]">
        <h1 className="mt-[26px] mb-1.5 text-[33px] leading-[1.1] font-semibold">
          Hello, <span className="text-aqua-700">{view.firstName}</span>
        </h1>
        <p className="mb-6 max-w-[30ch] text-[15px] text-pretty text-steel-700">
          {view.homeAddress} — your assessment is open. Photos are reviewed as
          you send them.
        </p>

        <div className="mb-3.5 flex items-end gap-3.5">
          <div className="text-[72px] leading-[.9] font-semibold">
            {view.doneCount}
          </div>
          <div className="pb-2.5">
            <div className="text-[26px] leading-none font-semibold text-steel-600">
              / {view.totalCount}
            </div>
            <div className="mt-1 text-[11px] tracking-[.12em] text-steel-700 uppercase">
              Photos captured
            </div>
          </div>
        </div>

        <div className="mb-2 h-2 overflow-hidden rounded-full bg-steel-200">
          <div
            className="h-2 rounded-full bg-aqua"
            style={{ width: `${view.progressPct}%` }}
          />
        </div>
        <div className="mb-[30px] flex justify-between text-xs text-steel-700">
          <span>{view.remainingLabel}</span>
          <span>About {view.minutesLeft} min left</span>
        </div>

        {view.flagText && (
          <div className="mb-[26px] rounded-lg bg-aqua-200 px-4 py-3.5">
            <div className="mb-[5px] text-[10px] font-semibold tracking-[.14em] text-aqua-700 uppercase">
              Follow-up requested
            </div>
            <div className="text-base leading-[1.35] text-pretty">
              {view.flagText}
            </div>
          </div>
        )}

        <h2 className="mb-2.5 text-xs font-semibold tracking-[.12em] text-steel-600 uppercase">
          Photo list
        </h2>

        <ul>
          {view.rows.map((row) => (
            <li
              key={row.id}
              className="mb-2 flex items-center gap-[13px] rounded-lg bg-surface px-3.5 py-3"
            >
              <div
                className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] text-sm font-semibold ${MARK_CLASS[row.state]}`}
                aria-hidden="true"
              >
                {MARK[row.state]}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-base leading-[1.25] font-medium ${row.state === "done" ? "text-steel-600" : "text-ink"}`}
                >
                  {row.name}
                </div>
                <div className="mt-[3px] text-[10px] tracking-[.1em] text-steel-600 uppercase">
                  {row.zone}
                </div>
              </div>
              <div
                className={`flex-none text-[11px] tracking-[.08em] uppercase ${STATUS_CLASS[row.state]}`}
              >
                {STATUS_LABEL[row.state]}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-[22px] text-xs leading-[1.5] text-steel-600">
          Questions?{" "}
          <a
            className="text-aqua-700 hover:text-accent"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          · {SUPPORT_PHONE}
        </p>
        <button
          type="button"
          onClick={() => void startOver()}
          className="mt-2 text-xs text-steel-500 underline underline-offset-2 hover:text-aqua-700"
        >
          Start this demo over
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-linear-to-t from-bg from-72% to-transparent px-5 pt-4 pb-[26px]">
        {view.nextSlug && (
          <Link
            href={`/capture/${view.nextSlug}`}
            className="btn btn-primary btn-block min-h-[54px] p-4 text-[17px] font-semibold tracking-[.01em]"
          >
            {view.ctaLabel}
          </Link>
        )}
        <Button
          variant={view.allDone ? "primary" : "secondary"}
          block
          disabled={!view.allDone}
          onClick={() => setConfirming(true)}
          className={
            view.allDone
              ? "min-h-[54px] p-4 text-[17px] font-semibold tracking-[.01em]"
              : "min-h-[48px] text-base"
          }
        >
          Submit assessment
        </Button>
      </div>

      {confirming && (
        <ConfirmDialog
          message="Are you sure you want to submit? Your captured photos cannot be changed after this point."
          cancelLabel="No"
          confirmLabel="Yes"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            void submit().then(() => router.push("/confirmation"));
          }}
        />
      )}
    </>
  );
}
