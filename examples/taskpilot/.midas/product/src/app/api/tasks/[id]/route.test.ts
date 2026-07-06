/**
 * TaskPilot — /api/tasks/[id] integration test (tenant isolation)
 *
 * PATCH/DELETE return 404 when the task is missing or belongs to another workspace.
 * Run with: npm run test · Framework: Vitest 2.1.x (see package.json)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let currentSession: { sessionId: string; userId: string; workspaceId: string } | null = null;
let updateReturns: unknown[] = [];
let deleteReturns: unknown[] = [];

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => currentSession),
}));

vi.mock("@/lib/db", () => {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    update: () => chain,
    set: () => chain,
    delete: () => chain,
    where: () => chain,
    returning: async () => updateReturns,
  });
  const deleteChain: Record<string, unknown> = {};
  Object.assign(deleteChain, {
    delete: () => deleteChain,
    where: () => deleteChain,
    returning: async () => deleteReturns,
  });
  return {
    db: {
      update: () => chain,
      delete: () => deleteChain,
    },
  };
});

import { DELETE, PATCH } from "./route";

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  currentSession = { sessionId: "s-1", userId: "user-1", workspaceId: "ws-1" };
  updateReturns = [];
  deleteReturns = [];
});
afterEach(() => vi.clearAllMocks());

describe("PATCH /api/tasks/[id]", () => {
  it("returns 401 when there is no session", async () => {
    currentSession = null;
    const res = await PATCH(
      new NextRequest("http://localhost/api/tasks/task-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
      }),
      routeContext("task-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when the task is in another workspace (tenant isolation)", async () => {
    updateReturns = [];
    const res = await PATCH(
      new NextRequest("http://localhost/api/tasks/task-other", {
        method: "PATCH",
        body: JSON.stringify({ title: "Nope" }),
      }),
      routeContext("task-other"),
    );
    expect(res.status).toBe(404);
  });

  it("updates a task in the caller's workspace", async () => {
    updateReturns = [{ id: "task-1", title: "Updated", workspaceId: "ws-1" }];
    const res = await PATCH(
      new NextRequest("http://localhost/api/tasks/task-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
      }),
      routeContext("task-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Updated");
  });
});

describe("DELETE /api/tasks/[id]", () => {
  it("returns 401 when there is no session", async () => {
    currentSession = null;
    const res = await DELETE(
      new NextRequest("http://localhost/api/tasks/task-1", { method: "DELETE" }),
      routeContext("task-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when the task is in another workspace (tenant isolation)", async () => {
    deleteReturns = [];
    const res = await DELETE(
      new NextRequest("http://localhost/api/tasks/task-other", { method: "DELETE" }),
      routeContext("task-other"),
    );
    expect(res.status).toBe(404);
  });

  it("deletes a task in the caller's workspace", async () => {
    deleteReturns = [{ id: "task-1" }];
    const res = await DELETE(
      new NextRequest("http://localhost/api/tasks/task-1", { method: "DELETE" }),
      routeContext("task-1"),
    );
    expect(res.status).toBe(204);
  });
});
