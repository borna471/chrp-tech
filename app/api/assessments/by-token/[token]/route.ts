/**
 * Turns an invite token into the seed the capture app opens with.
 *
 * This is the one place data flows *back* from the database into the homeowner
 * app — everything else is one-way through the mirror. It therefore returns the
 * four seed fields and nothing else: no findings, no photo history, and no way
 * to enumerate other assessments. A token is a bearer secret in a URL, so what
 * it unlocks is kept as small as the flow allows.
 */

import { getSupabase } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let supabase;
  try {
    supabase = getSupabase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[chrp-invite] not configured", error);
    return Response.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("assessments")
    .select("id, policy_ref, home_address, homeowner_first_name, opened_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (error) {
    console.error("[chrp-invite] lookup failed", error);
    return Response.json({ error: "Could not check that link." }, { status: 502 });
  }
  // Deliberately the same answer for an unknown token as for a malformed one —
  // there is nothing to learn from probing.
  if (!data) {
    return Response.json({ error: "That link isn't valid." }, { status: 404 });
  }

  if (!data.opened_at) {
    // Best effort: failing to record the first open must not stop the homeowner
    // getting into their assessment.
    const { error: stampError } = await supabase
      .from("assessments")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", data.id);
    if (stampError) console.error("[chrp-invite] opened_at failed", stampError);
  }

  return Response.json({
    id: data.id,
    policyRef: data.policy_ref,
    homeAddress: data.home_address,
    homeownerFirstName: data.homeowner_first_name,
  });
}
