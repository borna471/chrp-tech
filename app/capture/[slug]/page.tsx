"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { useCapture } from "@/lib/useCapture";

/** The newsprint-ish diagonal fill that stands in for a photograph. */
const EXAMPLE_FRAME =
  "repeating-linear-gradient(135deg,var(--color-steel-200) 0 12px,var(--color-surface) 12px 24px)";
const DEMO_PHOTO =
  "repeating-linear-gradient(115deg,#0d3a4f 0 10px,#154c66 10px 20px)";
/** Tried in order until one loads; missing files fall back to EXAMPLE_FRAME. */
const EXAMPLE_EXTENSIONS = ["webp", "jpeg", "jpg"] as const;

export default function CapturePage() {
  const { slug } = useParams<{ slug: string }>();
  const {
    ready,
    phase,
    view,
    result,
    photoUrl,
    savedPhotoUrl,
    openCamera,
    retake,
    retryAnalysis,
    advance,
    skipTask,
  } = useCapture(slug);

  const showInstruction = phase === "instruct";
  // Carries the slug it counts for, so moving to another task starts over at the
  // first extension without needing an effect to reset it.
  const [example, setExample] = useState({ slug, index: 0 });
  const exampleExtIndex = example.slug === slug ? example.index : 0;

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-steel-600">
        Loading this photo…
      </div>
    );
  }

  const exampleFailed = exampleExtIndex >= EXAMPLE_EXTENSIONS.length;
  const exampleSrc =
    view.currentSlug && !exampleFailed
      ? `/example-frames/${view.currentSlug}.${EXAMPLE_EXTENSIONS[exampleExtIndex]}`
      : null;
  const showExampleImage = !savedPhotoUrl && !!exampleSrc;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6">
      <div className="my-4 mb-[18px] flex items-center justify-between">
        <Link
          href="/"
          className="btn btn-ghost py-1.5 pr-2.5 pl-0 text-sm"
        >
          ← All photos
        </Link>
        <span className="text-[11px] tracking-[.12em] text-steel-700 uppercase">
          {view.stepLabel}
        </span>
      </div>

      <div className="mb-6 h-[5px] overflow-hidden rounded-full bg-steel-200">
        <div
          className="h-[5px] rounded-full bg-aqua"
          style={{ width: `${view.progressPct}%` }}
        />
      </div>

      {showInstruction ? (
        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-[.14em] text-aqua-700 uppercase">
            {view.currentZone}
          </div>
          <h1 className="mb-3 text-[30px] leading-[1.15] font-semibold">
            {view.currentName}
          </h1>
          <p className="mb-5 text-[17px] leading-[1.45] text-pretty text-accent-800">
            {view.currentInstruction}
          </p>

          <div
            className="relative mb-5 flex h-[180px] items-end overflow-hidden rounded-lg p-3"
            style={
              savedPhotoUrl || showExampleImage
                ? undefined
                : { background: EXAMPLE_FRAME }
            }
          >
            {savedPhotoUrl ? (
              // A blob URL from IndexedDB — next/image cannot optimize it.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={savedPhotoUrl}
                alt={`Your saved photo of ${view.currentName}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              showExampleImage &&
              exampleSrc && (
                // Static files under public/ — next/image is unnecessary here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={exampleSrc}
                  src={exampleSrc}
                  alt={`Example frame for ${view.currentName}`}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={() =>
                    setExample({ slug, index: exampleExtIndex + 1 })
                  }
                />
              )
            )}
            <span className="relative rounded-full bg-bg px-2 py-[5px] text-[10px] tracking-[.1em] text-steel-700 uppercase">
              {savedPhotoUrl ? `Photo on file` : `Example frame`}
            </span>
          </div>

          <div className="mb-6 border-t border-divider pt-3.5">
            <div className="mb-2.5 text-[10px] font-semibold tracking-[.14em] text-steel-600 uppercase">
              Make sure we can see
            </div>
            {view.currentTips.map((tip) => (
              <div
                key={tip}
                className="mb-[7px] flex gap-2.5 text-[15px] leading-[1.4]"
              >
                <span className="mt-2 h-[7px] w-[7px] flex-none rounded-full bg-aqua" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-2 text-[11px] tracking-[.14em] text-steel-700 uppercase">
            Captured — {view.capturedName}
          </div>
          <div className="relative mb-[18px] h-[330px] overflow-hidden rounded-lg bg-accent">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={`Captured photo of ${view.capturedName}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-end p-3.5"
                style={{ background: DEMO_PHOTO }}
              >
                <span className="rounded-full bg-accent/75 px-[9px] py-1.5 text-[10px] tracking-[.1em] text-white uppercase">
                  Demo photo — {view.capturedName}
                </span>
              </div>
            )}
            {phase === "analyzing" && (
              <div className="absolute inset-0 bg-accent/35">
                <div className="h-0.5 animate-scan bg-aqua shadow-[0_0_18px_3px_var(--color-aqua)]" />
              </div>
            )}
          </div>

          {phase === "analyzing" && (
            <div className="flex items-center gap-2.5 text-base text-steel-700">
              <span className="h-2 w-2 animate-blink rounded-full bg-aqua" />
              Chrp AI is reading this photo…
            </div>
          )}

          {phase === "error" && (
            <div className="rounded-lg bg-aqua-200 px-4 py-3.5">
              <div className="mb-1.5 text-[10px] font-semibold tracking-[.14em] text-aqua-700 uppercase">
                Review didn&apos;t go through
              </div>
              <div className="text-[17px] leading-[1.4] text-pretty">
                We couldn&apos;t review that photo. Your shot is saved — try
                again.
              </div>
            </div>
          )}

          {phase === "result" && result && (
            <div
              className={`rounded-lg px-4 py-3.5 ${result.verdict === "accepted" ? "bg-surface" : "bg-aqua-200"}`}
            >
              <div className="mb-1.5 text-[10px] font-semibold tracking-[.14em] text-aqua-700 uppercase">
                {result.verdict === "accepted"
                  ? "Accepted"
                  : "One more photo needed"}
              </div>
              <div className="text-[17px] leading-[1.4] text-pretty">
                {result.message}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-2.5 pt-5">
        {showInstruction && (
          <>
            <Button
              variant="primary"
              block
              onClick={openCamera}
              className="min-h-[54px] p-4 text-[17px] font-semibold"
            >
              Capture photo
            </Button>
            <Button
              variant="ghost"
              block
              onClick={() => void skipTask()}
              className="min-h-[44px] text-sm"
            >
              Skip for now
            </Button>
          </>
        )}
        {phase === "result" && result && (
          <>
            <Button
              variant="primary"
              block
              onClick={() => void advance()}
              className="min-h-[54px] p-4 text-[17px] font-semibold"
            >
              {result.verdict === "follow_up"
                ? "Take the close-up"
                : "Next photo"}
            </Button>
            <Button
              variant="ghost"
              block
              onClick={retake}
              className="min-h-[44px] text-sm"
            >
              Retake this photo
            </Button>
          </>
        )}
        {phase === "error" && (
          <>
            <Button
              variant="primary"
              block
              onClick={() => void retryAnalysis()}
              className="min-h-[54px] p-4 text-[17px] font-semibold"
            >
              Try again
            </Button>
            <Button
              variant="ghost"
              block
              onClick={retake}
              className="min-h-[44px] text-sm"
            >
              Retake this photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
