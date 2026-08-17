import Link from "next/link";
import { getSupabase } from "@/lib/server/supabase";

/**
 * Every assessment, and how far through it each homeowner is.
 *
 * A server component so the service-role key never leaves the server. Progress
 * is counted in JS from the task and capture rows rather than in SQL: at twenty
 * tasks per assessment that is a handful of rows, and it keeps the whole page
 * to three plain selects instead of a view.
 */

export const dynamic = "force-dynamic";

type AssessmentRow = {
  id: string;
  policy_ref: string;
  home_address: string;
  homeowner_first_name: string;
  homeowner_email: string | null;
  status: string;
  invited_at: string | null;
  opened_at: string | null;
  submitted_at: string | null;
  created_at: string;
};

const shortDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";

/** Where the homeowner has actually got to, which `status` alone does not say. */
function stage(row: AssessmentRow, captures: number) {
  if (row.status === "complete") return { label: "Submitted", tone: "done" };
  if (captures > 0) return { label: "In progress", tone: "active" };
  if (row.opened_at) return { label: "Opened", tone: "active" };
  return { label: "Not started", tone: "idle" };
}

const TONE: Record<string, string> = {
  done: "bg-aqua-200 text-aqua-700",
  active: "bg-steel-200 text-steel-800",
  idle: "bg-steel-200 text-steel-600",
};

const TH =
  "px-4 py-2.5 text-left text-[11px] font-semibold tracking-[.08em] text-steel-600 uppercase";
const TD = "px-4 py-3.5 align-middle text-[14px]";

export default async function AdminPage() {
  let rows: AssessmentRow[] = [];
  let doneByAssessment = new Map<string, number>();
  let totalByAssessment = new Map<string, number>();
  let capturesByAssessment = new Map<string, number>();
  let error: string | null = null;

  try {
    const supabase = getSupabase();

    const [assessments, tasks, captures] = await Promise.all([
      supabase
        .from("assessments")
        .select(
          "id, policy_ref, home_address, homeowner_first_name, homeowner_email, status, invited_at, opened_at, submitted_at, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("photo_tasks").select("assessment_id, status"),
      supabase.from("photo_captures").select("assessment_id"),
    ]);

    if (assessments.error) throw assessments.error;
    if (tasks.error) throw tasks.error;
    if (captures.error) throw captures.error;

    rows = (assessments.data ?? []) as AssessmentRow[];

    const countBy = <T extends { assessment_id: string }>(
      list: T[],
      keep: (item: T) => boolean = () => true,
    ) => {
      const counts = new Map<string, number>();
      for (const item of list) {
        if (!keep(item)) continue;
        counts.set(item.assessment_id, (counts.get(item.assessment_id) ?? 0) + 1);
      }
      return counts;
    };

    const taskRows = (tasks.data ?? []) as {
      assessment_id: string;
      status: string;
    }[];
    totalByAssessment = countBy(taskRows);
    doneByAssessment = countBy(taskRows, (task) => task.status === "done");
    capturesByAssessment = countBy(
      (captures.data ?? []) as { assessment_id: string }[],
    );
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  return (
    <>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="mb-1 text-[28px] font-semibold">Assessments</h1>
          <p className="text-[15px] text-steel-700">
            Every assessment created, and how far through it each homeowner is.
          </p>
        </div>
        <Link href="/admin/new" className="btn btn-primary px-5">
          New assessment
        </Link>
      </div>

      {error && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-[14px] text-red-700">
          Could not read the database: {error}
        </p>
      )}

      {!error && rows.length === 0 && (
        <div className="rounded-lg border border-divider px-6 py-12 text-center">
          <p className="text-[15px] text-steel-700">
            No assessments yet. Create one to get a link you can send.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-divider">
          <table className="w-full border-collapse">
            <thead className="border-b border-divider bg-steel-200">
              <tr>
                <th className={TH}>Homeowner</th>
                <th className={TH}>Property</th>
                <th className={TH}>Policy</th>
                <th className={TH}>Stage</th>
                <th className={TH}>Photos</th>
                <th className={TH}>Attempts</th>
                <th className={TH}>Invited</th>
                <th className={TH}>Opened</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const captures = capturesByAssessment.get(row.id) ?? 0;
                const done = doneByAssessment.get(row.id) ?? 0;
                const total = totalByAssessment.get(row.id) ?? 0;
                const { label, tone } = stage(row, captures);
                return (
                  <tr key={row.id} className="border-b border-divider last:border-0">
                    <td className={`${TD} font-medium`}>
                      {row.homeowner_first_name}
                      {row.homeowner_email && (
                        <div className="text-[12px] text-steel-600">
                          {row.homeowner_email}
                        </div>
                      )}
                    </td>
                    <td className={`${TD} text-steel-800`}>{row.home_address}</td>
                    <td className={`${TD} font-mono text-[12px] text-steel-600`}>
                      {row.policy_ref}
                    </td>
                    <td className={TD}>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[.06em] uppercase ${TONE[tone]}`}
                      >
                        {label}
                      </span>
                    </td>
                    <td className={`${TD} font-mono`}>
                      {done}/{total}
                    </td>
                    <td className={`${TD} font-mono text-steel-600`}>{captures}</td>
                    <td className={`${TD} text-steel-600`}>
                      {shortDate(row.invited_at)}
                    </td>
                    <td className={`${TD} text-steel-600`}>
                      {shortDate(row.opened_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
