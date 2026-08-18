"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * Client-side analytics, mounted once at the document root so it spans both the
 * homeowner capture flow and `/admin`.
 *
 * `init` runs in an effect rather than at module scope because this file is
 * imported by a Server Component: at module scope it would execute during the
 * server render, where there is no browser to instrument.
 */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // Unset means analytics are simply off — a demo that crashes because a
    // tracking key is missing is worse than one nobody is measuring.
    if (!key) return;

    posthog.init(key, {
      api_host: "https://us.i.posthog.com",
      defaults: "2026-05-30",
    });
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
