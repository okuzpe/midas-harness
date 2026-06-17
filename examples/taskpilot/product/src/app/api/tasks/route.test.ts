/**
 * TaskPilot — /api/tasks integration test (T-09)
 *
 * Exercises the route handlers end-to-end at the HTTP boundary with the session and DB layers
 * mocked: unauthenticated requests are rejected, an empty title is refused, and a valid create is
 * scoped to the caller's workspace. This is the integration counterpart to the schema unit tests.
 *
 * Run with:  npm run test   ·   Framework: Vitest 3.x
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let currentSession: { sessionId: string; userId: string; workspaceId: string } | null = null;
const captured: { insertedValues?: Record<string, unknown> } = {};

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => currentSession),
}));

vi.mock("@/lib/db", () => {
  // Minimal chainable Drizzle stub. select-chains resolve to a fixed row set; insert-chains echo
  // back the inserted values so the test can assert workspace scoping.
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: async () => [{ id: "task-1", title: "Existing", workspaceId: "ws-1" }],
    insert: () => chain,
    values: (v: Record<string, unknown>) => {
      captured.insertedValues = v;
      return chain;
    },
    returning: async () => [{ id: "task-2", ...captured.insertedValues }],
  });
  return { db: chain };
});

import { GET, POST } from "./route";

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  currentSession = { sessionId: "s-1", userId: "user-1", workspaceId: "ws-1" };
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/tasks", () => {
  it("returns 401 when there is no session", async () => {
    currentSession = null;
    const res = await GET(new NextRequest("http://localhost/api/tasks"));
    expect(res.status).toBe(401);
  });

  it("returns the workspace's tasks for an authenticated caller", async () => {
    const res = await GET(new NextRequest("http://localhost/api/tasks"));
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(rows).toHaveLength(1);
  });
});

describe("POST /api/tasks", () => {
  it("returns 401 when there is no session", async () => {
    currentSession = null;
    const res = await POST(jsonRequest({ title: "New task" }));
    expect(res.status).toBe(401);
  });

  it("rejects an empty title with 422", async () => {
    const res = await POST(jsonRequest({ title: "   " }));
    expect(res.status).toBe(422);
  });

  it("creates a task scoped to the caller's workspace", async () => {
    const res = await POST(jsonRequest({ title: "Write the integration test" }));
    expect(res.status).toBe(201);
    expect(captured.insertedValues?.workspaceId).toBe("ws-1");
    expect(captured.insertedValues?.createdBy).toBe("user-1");
  });
});
