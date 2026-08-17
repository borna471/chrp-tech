"use server";

/**
 * Creating an assessment from the insurer side.
 *
 * This writes the twenty photo tasks as well as the assessment itself, from the
 * same `TASK_SEEDS` the capture flow uses — which is the whole reason `/admin`
 * lives in this app rather than the separate dashboard repo. The assessment
 * reads 0/20 immediately, and `content/photo-tasks.json` is never duplicated.
 *
 * The homeowner's browser later upserts the same rows under the same
 * deterministic ids, so this is a head start rather than a second source.
 */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/server/supabase";
import { TASK_SEEDS } from "@/lib/tasks";

export type CreateResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "created"; link: string; homeownerFirstName: string };

/** A demo reference in the format already on screen, not a real policy number. */
function policyRef(): string {
  const digits = 1000 + Math.floor(Math.random() * 9000);
  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `HO-${digits} • ${date}`;
}

/**
 * Prefers the request's own host so invite links are correct in development and
 * on a preview deployment without anything being configured. `APP_URL` overrides
 * it for the case where the public origin differs from what Next sees.
 */
async function origin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function createAssessment(
  _previous: CreateResult,
  formData: FormData,
): Promise<CreateResult> {
  const homeownerFirstName = String(formData.get("name") ?? "").trim();
  const homeAddress = String(formData.get("address") ?? "").trim();
  const homeownerEmail = String(formData.get("email") ?? "").trim();

  if (!homeownerFirstName || !homeAddress) {
    return { status: "error", message: "Name and address are both required." };
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Supabase is not configured.",
    };
  }

  const id = crypto.randomUUID();
  // Separate from the id on purpose: the id travels in storage paths and every
  // mirror payload, so it is not a secret and must not be what grants access.
  const inviteToken = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const { error: assessmentError } = await supabase.from("assessments").insert({
    id,
    policy_ref: policyRef(),
    home_address: homeAddress,
    homeowner_first_name: homeownerFirstName,
    homeowner_email: homeownerEmail || null,
    status: "open",
    invite_token: inviteToken,
    invited_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  });
  if (assessmentError) {
    console.error("[chrp-admin] create assessment failed", assessmentError);
    return { status: "error", message: assessmentError.message };
  }

  const { error: tasksError } = await supabase.from("photo_tasks").insert(
    TASK_SEEDS.map((seed, index) => ({
      id: `${id}:${seed.slug}`,
      assessment_id: id,
      slug: seed.slug,
      name: seed.name,
      zone: seed.zone,
      risk: seed.risk,
      instruction: seed.instruction,
      tips: seed.tips,
      order: index,
      status: "pending",
    })),
  );
  if (tasksError) {
    console.error("[chrp-admin] create tasks failed", tasksError);
    return { status: "error", message: tasksError.message };
  }

  revalidatePath("/admin");
  return {
    status: "created",
    link: `${await origin()}/start?t=${inviteToken}`,
    homeownerFirstName,
  };
}
