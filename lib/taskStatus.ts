/**
 * How a photo task's status looks, shared by the dashboard's photo list and the
 * capture page's status marker so one photo reads the same in both places.
 *
 * `next` is a list-only decoration — the capture page only ever sees the three
 * stored statuses from `PhotoTask`.
 */
export type RowState = "done" | "skipped" | "next" | "pending";

export const MARK: Record<RowState, string> = {
  done: "✓",
  skipped: "!",
  next: "",
  pending: "",
};

export const MARK_CLASS: Record<RowState, string> = {
  done: "border-accent bg-accent text-white",
  skipped: "border-aqua text-aqua-700",
  next: "border-steel-400",
  pending: "border-steel-400",
};

export const STATUS_LABEL: Record<RowState, string> = {
  done: "Done",
  skipped: "Skipped",
  next: "Next",
  pending: "",
};

export const STATUS_CLASS: Record<RowState, string> = {
  done: "text-steel-500 font-normal",
  skipped: "text-aqua-700 font-semibold",
  next: "text-accent-700 font-semibold",
  pending: "",
};

/**
 * The photo list can leave a not-yet-taken row unlabelled — its blank circle
 * says enough next to its neighbours. On the capture page there is nothing to
 * compare against, so that state has to say so out loud.
 */
export const CAPTURE_STATUS_LABEL: Record<RowState, string> = {
  ...STATUS_LABEL,
  next: "Not captured yet",
  pending: "Not captured yet",
};
