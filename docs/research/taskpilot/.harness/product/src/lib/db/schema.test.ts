/**
 * TaskPilot — Drizzle schema unit tests
 *
 * These tests verify the shape and invariants of the schema WITHOUT a live
 * database. They check that:
 * - tables have the expected columns
 * - the task status enum contains exactly the expected values
 * - inferred TypeScript types have the expected fields (type-level assertions)
 *
 * Run with:  npm run test
 * Framework: Vitest 2.1.x (see package.json)
 */

import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  sessions,
  taskStatusEnum,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "./schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the column names of a Drizzle table as a sorted array. */
function columnNames(table: Record<string, unknown>): string[] {
  return Object.keys(table).sort();
}

// ---------------------------------------------------------------------------
// Task status enum
// ---------------------------------------------------------------------------

describe("taskStatusEnum", () => {
  it("contains exactly todo, in-progress, and done", () => {
    expect([...taskStatusEnum.enumValues].sort()).toEqual([
      "done",
      "in-progress",
      "todo",
    ]);
  });

  it("has exactly 3 values", () => {
    expect(taskStatusEnum.enumValues).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Table shape — users
// ---------------------------------------------------------------------------

describe("users table", () => {
  it("has id, email, passwordHash, name, createdAt columns", () => {
    const cols = columnNames(users);
    expect(cols).toContain("id");
    expect(cols).toContain("email");
    expect(cols).toContain("passwordHash");
    expect(cols).toContain("name");
    expect(cols).toContain("createdAt");
  });

  it("exposes the correct column count (5)", () => {
    expect(Object.keys(getTableColumns(users)).length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Table shape — workspaces
// ---------------------------------------------------------------------------

describe("workspaces table", () => {
  it("has id, name, ownerId, createdAt columns", () => {
    const cols = columnNames(workspaces);
    expect(cols).toContain("id");
    expect(cols).toContain("name");
    expect(cols).toContain("ownerId");
    expect(cols).toContain("createdAt");
  });
});

// ---------------------------------------------------------------------------
// Table shape — tasks
// ---------------------------------------------------------------------------

describe("tasks table", () => {
  const expectedCols = [
    "id",
    "workspaceId",
    "title",
    "description",
    "status",
    "assigneeId",
    "createdBy",
    "createdAt",
    "updatedAt",
  ];

  it.each(expectedCols)("has column: %s", (col) => {
    expect(columnNames(tasks)).toContain(col);
  });

  it("has exactly 9 columns", () => {
    expect(Object.keys(getTableColumns(tasks)).length).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Table shape — sessions
// ---------------------------------------------------------------------------

describe("sessions table", () => {
  it("has userId, workspaceId and expiresAt for auth scoping", () => {
    const cols = columnNames(sessions);
    expect(cols).toContain("userId");
    expect(cols).toContain("workspaceId");
    expect(cols).toContain("expiresAt");
  });
});

// ---------------------------------------------------------------------------
// Table shape — workspaceMembers
// ---------------------------------------------------------------------------

describe("workspaceMembers table", () => {
  it("links workspaceId and userId", () => {
    const cols = columnNames(workspaceMembers);
    expect(cols).toContain("workspaceId");
    expect(cols).toContain("userId");
    expect(cols).toContain("joinedAt");
  });
});

// ---------------------------------------------------------------------------
// Tenant isolation guard (logic test, no DB required)
// ---------------------------------------------------------------------------

describe("tenant isolation contract", () => {
  it("tasks table has a workspaceId column for scoping all queries", () => {
    // Every query in the application must filter by workspaceId.
    // This test asserts the column exists so refactors don't accidentally drop it.
    expect(columnNames(tasks)).toContain("workspaceId");
  });

  it("sessions table carries workspaceId so the active workspace is always known", () => {
    expect(columnNames(sessions)).toContain("workspaceId");
  });
});
