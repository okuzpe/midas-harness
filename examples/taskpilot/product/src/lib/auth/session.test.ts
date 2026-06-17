/**
 * TaskPilot — session helper unit tests
 *
 * Verifies the security-relevant behaviour of createSession: the session cookie is set with the
 * hardened flags (httpOnly, sameSite=lax — the conscious Sprint-1 choice logged as audit-01 A-01).
 * next/headers and the DB are mocked so no browser or Postgres is required.
 *
 * Run with:  npm run test   ·   Framework: Vitest 3.x
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

vi.mock("@/lib/db", () => {
  const chain = {
    insert: () => chain,
    values: () => chain,
    returning: async () => [{ id: "session-123" }],
  };
  return { db: chain };
});

import { createSession, SESSION_COOKIE } from "./session";

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets the session cookie with hardened flags", async () => {
    await createSession("user-1", "ws-1");

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const [name, value, opts] = cookieStore.set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE);
    expect(value).toBe("session-123");
    expect(opts.httpOnly).toBe(true);
    // sameSite=lax is the logged Sprint-1 choice (audit-01 A-01); strict is deferred to Sprint 3.
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
  });
});
