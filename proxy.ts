import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Keeps `/admin` off the open internet.
 *
 * It lists real home addresses and policy references, so once this is deployed
 * it cannot simply be public. One shared password, not accounts — enough to stop
 * it being crawlable, and honest about being no more than that.
 *
 * This is a proxy (Next's renamed middleware) rather than Vercel's own Deployment
 * Protection because that is deployment-wide: switching it on would also lock a
 * homeowner out of the invite link, which is the whole point of the deployment.
 */

const COOKIE = "chrp_admin";

export const config = { matcher: ["/admin/:path*"] };

export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  // Unset means local development: an unconfigured gate that locks everyone out
  // is worse than no gate, and the deployment checklist names this variable.
  if (!password) return NextResponse.next();

  if (request.cookies.get(COOKIE)?.value === password) {
    return NextResponse.next();
  }

  const submitted = request.nextUrl.searchParams.get("key");
  if (submitted === password) {
    // Drop the password out of the URL so it does not linger in history or in
    // whatever the next page sends as a referrer.
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("key");
    const response = NextResponse.redirect(clean);
    response.cookies.set(COOKIE, password, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  }

  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in</title></head>
     <body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#cfdde3;color:#0d3a4f">
       <form method="get" style="background:#fff;padding:28px;border-radius:14px;min-width:280px">
         <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6d838d;margin-bottom:10px">chrp assessments</div>
         <input name="key" type="password" placeholder="Password" autofocus
                style="width:100%;box-sizing:border-box;padding:10px 12px;font-size:15px;border:1px solid rgba(13,58,79,.2);border-radius:8px" />
         <button type="submit"
                 style="width:100%;margin-top:12px;padding:10px;font-size:15px;font-weight:600;color:#fff;background:#0d3a4f;border:0;border-radius:8px;cursor:pointer">
           Continue
         </button>
       </form>
     </body></html>`,
    { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
