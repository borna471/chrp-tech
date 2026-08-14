import { browserRepository } from "./browserRepository";
import type { InspectionRepository } from "./repository";

/**
 * The single place an adapter is chosen. When the Postgres schema in
 * `prisma/schema.prisma` goes live, a `prismaRepository` (or a fetch-backed
 * client hitting route handlers) is selected here and nothing else moves.
 */
export function getRepository(): InspectionRepository {
  if (typeof window === "undefined") {
    throw new Error(
      "getRepository() is browser-only until a server adapter exists — call it from an effect or event handler.",
    );
  }
  return browserRepository;
}

export type { InspectionRepository } from "./repository";
