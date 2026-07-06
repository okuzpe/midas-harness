/**
 * TaskPilot — /board (server component stub)
 *
 * Sprint 1 ships a minimal server-rendered list of the workspace's task titles to prove the
 * end-to-end path works: cookie session -> DB query scoped by workspace -> render. The drag-and-drop
 * kanban board (task-card.tsx, kanban-board.tsx) is Sprint 2.
 *
 * All colour/type/radius come from the design tokens (product/design-system.md) — no hardcoded
 * values; spacing uses the Tailwind 4px-grid scale.
 *
 * Docs fetched via Context7: next.js@15.3.x, topic: "server components + cookies()"
 */

import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessions, tasks } from "@/lib/db/schema";
import { SESSION_COOKIE } from "@/lib/auth/session";

export default async function BoardPage() {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionId) redirect("/login");

  const [session] = await db
    .select({ workspaceId: sessions.workspaceId })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!session) redirect("/login");

  const rows = await db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status })
    .from(tasks)
    .where(eq(tasks.workspaceId, session.workspaceId))
    .orderBy(tasks.createdAt);

  return (
    <main className="min-h-screen bg-surface p-6 text-[var(--color-text-primary)]">
      <h1 className="text-[length:var(--text-xl)] font-semibold">Board</h1>
      <ul className="mt-4 space-y-2">
        {rows.length === 0 && (
          <li className="text-[var(--color-text-secondary)]">
            No tasks yet — create one to get started.
          </li>
        )}
        {rows.map((task) => (
          <li
            key={task.id}
            className="rounded-card border border-[var(--color-border)] bg-surface-raised p-4"
          >
            <span className="text-[length:var(--text-lg)] font-medium">{task.title}</span>
            <span
              className="ml-2 text-[length:var(--text-xs)] capitalize"
              style={{ color: `var(--color-status-${task.status})` }}
            >
              {task.status}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
