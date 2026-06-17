/**
 * TaskPilot — password helper unit tests
 *
 * bcrypt is mocked so the test is fast and deterministic (no real key-stretching). The point is to
 * verify the wrappers use the agreed cost factor and delegate correctly — not to test bcrypt itself.
 *
 * Run with:  npm run test   ·   Framework: Vitest 3.x
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";
import { hashPassword, verifyPassword } from "./password";

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(async () => "hashed"),
    compare: vi.fn(async () => true),
  },
}));

describe("hashPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hashes with a cost factor of 12", async () => {
    await hashPassword("hunter2pass");
    expect(bcrypt.hash).toHaveBeenCalledWith("hunter2pass", 12);
  });

  it("never returns the plaintext", async () => {
    const result = await hashPassword("hunter2pass");
    expect(result).not.toBe("hunter2pass");
  });
});

describe("verifyPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("compares plaintext against the stored hash", async () => {
    await verifyPassword("hunter2pass", "stored-hash");
    expect(bcrypt.compare).toHaveBeenCalledWith("hunter2pass", "stored-hash");
  });
});
