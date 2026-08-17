import type { Decision } from "@/lib/ai/decide";
import { THRESHOLDS } from "@/lib/ai/decide";
import type { AnalyzePhotoResult } from "@/lib/ai/types";
import type { TaskSeed } from "@/lib/tasks";

/**
 * Testing surface, not product. Shows what the reviewer actually returned and
 * what the decision rules made of it, so behaviour can be judged from a phone
 * without a console.
 *
 * Deliberately styled unlike the rest of the app — monospace, grey, labelled —
 * so it can never be mistaken for homeowner copy in a screenshot. Gated on
 * `demoConfig.showAnalysisDebug`, which must be off before real users.
 */
type AnalysisDebugProps = {
  result: AnalyzePhotoResult;
  decision: Decision;
  task: TaskSeed | null;
};

const SEVERITY_CLASS: Record<string, string> = {
  urgent: "text-red-700",
  attention: "text-aqua-700",
  advisory: "text-steel-600",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-steel-600">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

export function AnalysisDebug({ result, decision, task }: AnalysisDebugProps) {
  const outcome =
    decision.action === "retake"
      ? `retake · ${decision.reason}`
      : decision.action === "close_up"
        ? `close_up · ${decision.checkId}`
        : decision.needsHumanReview
          ? "accepted · flagged for review"
          : "accepted";

  return (
    <section className="mt-4 rounded-lg bg-steel-200 p-3.5 font-mono text-[11px] leading-[1.5] text-steel-700">
      <header className="mb-2.5 flex items-center justify-between border-b border-divider pb-2">
        <span className="font-semibold tracking-[.08em] text-ink uppercase">
          Reviewer output
        </span>
        <span className="rounded-full bg-bg px-2 py-0.5 text-[9px] tracking-[.1em] uppercase">
          Testing only
        </span>
      </header>

      <div className="mb-3 space-y-0.5">
        <Row label="decision" value={outcome} />
        <Row label="model" value={result.model} />
        <Row label="elapsed" value={`${result.elapsedMs}ms`} />
      </div>

      <div className="mb-3 space-y-0.5">
        <div className="mb-1 font-semibold text-ink">quality</div>
        <Row
          label="blur"
          value={`${result.quality.blur.toFixed(2)} (max ${THRESHOLDS.blurMax})`}
        />
        <Row label="framing" value={result.quality.framing} />
        <Row label="exposure" value={result.quality.exposure} />
        <Row label="subjectPresent" value={String(result.quality.subjectPresent)} />
      </div>

      {result.elements.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 font-semibold text-ink">required elements</div>
          {result.elements.map((element) => (
            <Row
              key={element.id}
              label={element.id}
              value={`${element.visible ? "visible" : "MISSING"} · ${element.confidence.toFixed(2)}`}
            />
          ))}
        </div>
      )}

      {result.findings.length > 0 && (
        <div>
          <div className="mb-1 font-semibold text-ink">findings</div>
          {result.findings.map((finding) => {
            const check = task?.checks.find((c) => c.id === finding.checkId);
            const severity = check?.severity ?? "advisory";
            return (
              <div key={finding.checkId} className="mb-1.5">
                <Row
                  label={finding.checkId}
                  value={`${finding.present ? "PRESENT" : "absent"} · ${finding.confidence.toFixed(2)}`}
                />
                {finding.present && (
                  <div
                    className={`pl-2 text-pretty ${SEVERITY_CLASS[severity] ?? ""}`}
                  >
                    [{severity}] {finding.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
