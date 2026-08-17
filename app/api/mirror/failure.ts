/**
 * One shape for every mirror route's failure.
 *
 * The client never acts on these — a mirror write is fire-and-forget — so the
 * body exists purely to make a broken mirror debuggable from the server log and
 * the browser console rather than silently dropping insurer-side data.
 */

export function mirrorFailure(scope: string, error: unknown): Response {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  console.error(`[chrp-mirror] ${scope} failed`, error);
  return Response.json({ error: detail, scope }, { status: 502 });
}
