/**
 * TaskPilot — password hashing helpers (bcrypt)
 *
 * The plaintext password is never stored or logged — only the bcrypt hash reaches the database.
 *
 * Docs fetched via Context7: bcrypt@5.1.x, topic: "hash + compare"
 */

import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

/** Hashes a plaintext password for storage. */
export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/** Returns true when the plaintext matches the stored hash. */
export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
