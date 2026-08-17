"use client";

import { useSyncExternalStore } from "react";
import { getActiveSeed, subscribeActiveSeed } from "@/lib/activeAssessment";

/**
 * A client component purely so the policy reference follows the invite.
 *
 * It used to be fed `demoConfig.policyRef` from the server layout, which meant
 * an invited homeowner saw their own address in the page and somebody else's
 * policy number in the header. The reference is read after mount because the
 * active assessment lives in localStorage.
 */
export function AppHeader() {
  const policyRef = useSyncExternalStore(
    subscribeActiveSeed,
    () => getActiveSeed().policyRef,
    // Blank on the server: the active assessment is not knowable there, and a
    // guess would hydrate as a mismatch.
    () => "",
  );

  return (
    <header className="flex flex-none items-center justify-between bg-accent px-5 pt-3.5 pb-3">
      <div className="flex items-center gap-[9px]">
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
        <span className="text-[15px] font-semibold tracking-[.01em] text-white">
          chrp
          <span className="align-super text-[9px] text-aqua">®</span>{" "}
          <span className="font-normal opacity-70">Healthy Homes</span>
        </span>
      </div>
      <span className="text-[10px] tracking-[.08em] text-white/65 uppercase">
        {policyRef}
      </span>
    </header>
  );
}
