import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional access protection. If STUDIO_PASSCODE is set, every request needs
 * HTTP Basic auth with that passcode (any username). Recommended whenever the
 * app is deployed somewhere public, since it holds personal learning data and
 * can spend AI credits.
 */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function proxy(request: NextRequest) {
  const pass = process.env.STUDIO_PASSCODE?.trim();
  if (!pass) {
    // Secure by default on Vercel: a public deployment without a passcode would expose
    // personal learning data and let anyone spend the AI credits.
    if (process.env.VERCEL && process.env.STUDIO_PUBLIC !== "1")
      return new NextResponse(
        "My English Studio is deployed but locked: set STUDIO_PASSCODE in the Vercel project's environment variables and redeploy (or set STUDIO_PUBLIC=1 to make it public on purpose).",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    return NextResponse.next();
  }
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (safeEqual(given, pass)) return NextResponse.next();
    } catch {
      // fall through to the challenge
    }
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="My English Studio", charset="UTF-8"' } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
