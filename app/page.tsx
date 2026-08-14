"use client";

import { AppHeader } from "@/components/AppHeader";
import { CaptureScreen } from "@/components/CaptureScreen";
import { DoneScreen } from "@/components/DoneScreen";
import { HomeScreen } from "@/components/HomeScreen";
import { useInspection } from "@/lib/useInspection";

export default function Page() {
  const inspection = useInspection();
  const { view } = inspection;

  return (
    <main className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-bg text-ink">
      <AppHeader policyRef={view.policyRef} />

      {/* The assessment loads from the repository on mount; until it lands there
          is nothing truthful to show, and rendering the seeded list first would
          flash counts that may not match what is stored. */}
      {!inspection.hydrated ? (
        <div className="flex flex-1 items-center justify-center text-sm text-steel-600">
          Loading your assessment…
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {inspection.screen === "home" && (
            <HomeScreen
              view={view}
              onStart={inspection.start}
              onStartOver={() => void inspection.startOver()}
            />
          )}
          {inspection.screen === "capture" && (
            <CaptureScreen
              view={view}
              phase={inspection.phase}
              result={inspection.result}
              photoUrl={inspection.photoUrl}
              savedPhotoUrl={inspection.savedPhotoUrl}
              onBack={inspection.goHome}
              onCapture={inspection.openCamera}
              onSkip={() => void inspection.skipTask()}
              onAdvance={() => void inspection.advance()}
              onRetake={inspection.retake}
              onRetry={() => void inspection.retryAnalysis()}
            />
          )}
          {inspection.screen === "done" && (
            <DoneScreen view={view} onBack={inspection.goHome} />
          )}
        </div>
      )}
    </main>
  );
}
