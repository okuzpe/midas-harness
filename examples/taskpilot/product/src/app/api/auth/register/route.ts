/**
 * TaskPilot — POST /api/auth/register
 *
 * Registers a user, auto-creates their workspace + membership in one transaction, and starts a
 * session. Auto-creating the workspace is what keeps onboarding under the 5-minute target metric.
 *
 * Docs fetched via Context7: next.js@15.3.x, topic: "route handlers"; drizzle-orm@0.40.x ("transaction")
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, workspaces, workspaceMembers } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

interface RegisterBody {
  email: string;
  password: string;
  name: string;
  workspaceName?: string;
}

export async function POST(request: NextRequest) {
  let body: RegisterBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password, name, workspaceName } = body;
  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "email, password and name are required" },
      { status: 422 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "password must be at least 8 characters" },
      { status: 422 },
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const { userId, workspaceId } = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash, name })
      .returning({ id: users.id });
    const [ws] = await tx
      .insert(workspaces)
      .values({ name: workspaceName?.trim() || `${name}'s workspace`, ownerId: user.id })
      .returning({ id: workspaces.id });
    await tx.insert(workspaceMembers).values({ workspaceId: ws.id, userId: user.id });
    return { userId: user.id, workspaceId: ws.id };
  });

  await createSession(userId, workspaceId);
  return NextResponse.json({ id: userId, email, workspaceId }, { status: 201 });
}
