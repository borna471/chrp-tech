import { AppHeader } from "@/components/AppHeader";

/**
 * The homeowner's phone shell — the frame every capture-flow screen sits in.
 *
 * Lifted out of the root layout so `(admin)` can be a desktop page instead of a
 * 430px column. Route groups do not appear in URLs, so nothing here moved.
 */
export default function CaptureLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-bg text-ink">
      <AppHeader />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </main>
  );
}
