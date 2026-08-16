import type { ReactNode } from "react";

type StepLayoutProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  /** Buttons for the bottom bar. Omitted on a dead-end screen. */
  actions?: ReactNode;
};

/**
 * The frame every onboarding and closing screen shares: a scrolling body under
 * a heading, and a fixed action bar that fades the content out beneath it.
 */
export function StepLayout({
  eyebrow,
  title,
  children,
  actions,
}: StepLayoutProps) {
  return (
    <>
      <div
        className={`flex flex-1 flex-col overflow-y-auto px-5 ${actions ? "pb-[130px]" : "pb-8"}`}
      >
        {eyebrow && (
          <div className="mt-[26px] mb-2.5 text-[11px] font-semibold tracking-[.14em] text-aqua-700 uppercase">
            {eyebrow}
          </div>
        )}
        <h1
          className={`mb-3.5 text-[30px] leading-[1.15] font-semibold text-pretty ${eyebrow ? "" : "mt-[26px]"}`}
        >
          {title}
        </h1>
        {/* A flex column, so a page with a body that should fill the screen — the
            consent policy — can hand its box `flex-1`. */}
        <div className="flex min-h-0 flex-1 flex-col text-[17px] leading-[1.45] text-pretty text-accent-800">
          {children}
        </div>
      </div>

      {actions && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-linear-to-t from-bg from-72% to-transparent px-5 pt-4 pb-[26px]">
          {actions}
        </div>
      )}
    </>
  );
}
