/**
 * TaskPilot — session helpers (HTTP-only cookie sessions)
 *
 * The session row in the DB is the source of truth; the cookie carries only the opaque session id.
 * All API routes and server components resolve the caller through requireSession() so that every
 * query can be scoped to the session's workspace (tenant isolation — see architecture.md).
 *
 * Docs fetched via Context7: next.js@15.3.x, topic: "cookies() in Route Handlers"
 */

import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export const SESSION_COOKIE = "tp_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface ActiveSession {
  sessionId: string;
  userId: string;
  workspaceId: string;
}

/** Creates a session row and sets the session cookie with hardened flags. */
export async function createSession(userId: string, workspaceId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [row] = await db
    .insert(sessions)
    .values({ userId, workspaceId, expiresAt })
    .returning({ id: sessions.id });

  const store = await cookies();
  store.set(SESSION_COOKIE, row.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // sameSite "strict" is deferred to Sprint 3 (audit-01 amendment A-01): "lax" already blocks
    // cross-site POST CSRF while still allowing the top-level invite-accept navigation Sprint 3 adds.
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolves the active session for a request, or null when missing/expired. */
export async function requireSession(request: NextRequest): Promise<ActiveSession | null> {
  const id = request.cookies.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;
  return { sessionId: row.id, userId: row.userId, workspaceId: row.workspaceId };
}

/** Deletes the session row and clears the cookie. */
export async function destroySession(request: NextRequest): Promise<void> {
  const id = request.cookies.get(SESSION_COOKIE)?.value;
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
  (await cookies()).delete(SESSION_COOKIE);
}
