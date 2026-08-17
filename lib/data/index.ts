import { browserRepository } from "./browserRepository";
import { withMirror } from "./mirror";
import type { InspectionRepository } from "./repository";

/**
 * Unset means the app is byte-for-byte what it was before the mirror existed,
 * so a missing or broken Supabase config can never affect a demo. Only the flag
 * is public — the credentials it gates are read server-side.
 */
const MIRROR_ENABLED = process.env.NEXT_PUBLIC_MIRROR_ENABLED === "true";

let repository: InspectionRepository | null = null;

/**
 * The single place an adapter is chosen. The browser adapter stays
 * authoritative; `withMirror` only copies its writes outward, so replacing it
 * with a server-backed adapter later is still a change to this one function.
 */
export function getRepository(): InspectionRepository {
  if (typeof window === "undefined") {
    throw new Error(
      "getRepository() is browser-only until a server adapter exists — call it from an effect or event handler.",
    );
  }
  if (!repository) {
    repository = MIRROR_ENABLED
      ? withMirror(browserRepository)
      : browserRepository;
  }
  return repository;
}

export type { InspectionRepository } from "./repository";
