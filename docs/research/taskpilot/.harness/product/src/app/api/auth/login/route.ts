/**
 * TaskPilot — POST /api/auth/login
 *
 * Verifies credentials and starts a session. The error is identical whether the email is unknown
 * or the password is wrong, so the endpoint cannot be used to enumerate accounts.
 *
 * Docs fetched via Context7: next.js@15.3.x, topic: "route handlers"
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

interface LoginBody {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 422 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, user.id))
    .limit(1);

  await createSession(user.id, ws.id);
  return NextResponse.json({ id: user.id, email: user.email }, { status: 200 });
}
