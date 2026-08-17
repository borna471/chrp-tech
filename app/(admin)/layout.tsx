import Link from "next/link";

/**
 * The insurer-side shell: a desktop page, not the homeowner's 430px column.
 *
 * Deliberately shares the palette with the capture flow — this is the same
 * product seen from the other side, not a bolted-on admin panel.
 */
export default function AdminLayout({ children }: LayoutProps<"/"> ) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-divider bg-accent">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-aqua">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0d3a4f"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 11l9-7 9 7" />
                <path d="M5 10v10h14V10" />
                <path d="M10 20v-6h4v6" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold text-white">
              chrp<span className="align-super text-[9px] text-aqua">®</span>{" "}
              <span className="font-normal opacity-70">Assessments</span>
            </span>
          </Link>
          <span className="text-[10px] tracking-[.12em] text-white/65 uppercase">
            Internal
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-8 py-10">{children}</main>
    </div>
  );
}
