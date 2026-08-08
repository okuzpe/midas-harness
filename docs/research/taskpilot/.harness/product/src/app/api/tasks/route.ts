/**
 * TaskPilot — /api/tasks route handler
 *
 * GET  /api/tasks        — list all tasks for the authenticated workspace
 * POST /api/tasks        — create a new task in the authenticated workspace
 *
 * Individual task operations (PATCH, DELETE) live in /api/tasks/[id]/route.ts
 *
 * Docs fetched via Context7: next.js@15.3.x, topic: "route handlers"
 * Docs fetched via Context7: drizzle-orm@0.40.x, topic: "insert + select"
 */

import { db } from "@/lib/db";
import { tasks, type NewTask, type TaskStatus } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/tasks
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.workspaceId, session.workspaceId))
    .orderBy(tasks.createdAt);

  return NextResponse.json(rows);
}

// ---------------------------------------------------------------------------
// POST /api/tasks
// ---------------------------------------------------------------------------

interface CreateTaskBody {
  title: string;
  description?: string;
  assigneeId?: string;
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateTaskBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, description, assigneeId } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "title is required and must be a non-empty string" },
      { status: 422 },
    );
  }

  if (title.length > 255) {
    return NextResponse.json(
      { error: "title must be 255 characters or fewer" },
      { status: 422 },
    );
  }

  const newTask: NewTask = {
    workspaceId: session.workspaceId,
    title: title.trim(),
    description: description ?? null,
    status: "todo" as TaskStatus,
    assigneeId: assigneeId ?? null,
    createdBy: session.userId,
  };

  const [created] = await db.insert(tasks).values(newTask).returning();

  return NextResponse.json(created, { status: 201 });
}
