/**
 * TaskPilot — auth middleware
 *
 * Redirects unauthenticated requests for the authenticated app surface to /login. API routes
 * enforce auth themselves (they return 401, not a redirect), so they are excluded by the matcher.
 * The middleware only checks for the *presence* of the session cookie; the DB validates it inside
 * the route/server component (the edge runtime has no DB access).
 *
 * Docs fetched via Context7: next.js@15.3.x, topic: "middleware + matcher config"
 */

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

// Guard the authenticated app surface only; (auth) pages and /api/* are excluded.
export const config = {
  matcher: ["/board/:path*", "/tasks/:path*"],
};
