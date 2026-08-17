/**
 * The Supabase client the mirror routes write through.
 *
 * Server-only, and deliberately the single place the service-role key is read:
 * that key bypasses row-level security, so it must never be imported from
 * anything that could end up in a client bundle.
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Where capture photos land. Private — the dashboard signs its own URLs. */
export const CAPTURE_BUCKET = "captures";

/** Thrown when the mirror is switched on but not configured. */
export class MirrorNotConfiguredError extends Error {
  constructor(variable: string) {
    super(`${variable} is not set.`);
    this.name = "MirrorNotConfiguredError";
  }
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Named rather than swallowed: an unset variable otherwise surfaces as an
  // opaque 401 from Supabase that reads like a permissions problem.
  if (!url) throw new MirrorNotConfiguredError("SUPABASE_URL");
  if (!key) throw new MirrorNotConfiguredError("SUPABASE_SERVICE_ROLE_KEY");

  client = createClient(url, key, {
    // No session to persist and no token to refresh — this client is a process
    // singleton holding a static key, not a signed-in user.
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
