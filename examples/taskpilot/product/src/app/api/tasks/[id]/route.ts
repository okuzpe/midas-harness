/**
 * TaskPilot — /api/tasks/[id] route handlers
 *
 * PATCH  /api/tasks/:id   — update allowed fields on a task in the caller's workspace
 * DELETE /api/tasks/:id   — delete a task in the caller's workspace
 *
 * Both return 404 when the task is missing OR belongs to another workspace — cross-tenant existence
 * is never revealed (tenant isolation; see architecture.md).
 *
 * Docs fetched via Context7: next.js@15.3.x, topic: "dynamic route handlers (params is a Promise)"
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskStatusEnum, type NewTask, type TaskStatus } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface PatchBody {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId?: string | null;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.status && !taskStatusEnum.enumValues.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 422 });
  }

  // Build the update from allowed fields only — never spread untrusted input into the query.
  const updates: Partial<NewTask> = { updatedAt: new Date() };
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (body.description !== undefined) updates.description = body.description;
  if (body.status) updates.status = body.status;
  if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId;

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, session.workspaceId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, session.workspaceId)))
    .returning({ id: tasks.id });

  if (!deleted) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
