/**
 * TaskPilot — DELETE /api/auth/logout
 *
 * Deletes the session row and clears the cookie. Idempotent: calling it without a session still
 * returns 200 (there is nothing to leak by saying so).
 *
 * Docs fetched via Context7: next.js@15.3.x, topic: "route handlers + cookies"
 */

import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export async function DELETE(request: NextRequest) {
  await destroySession(request);
  return NextResponse.json({ ok: true }, { status: 200 });
}
