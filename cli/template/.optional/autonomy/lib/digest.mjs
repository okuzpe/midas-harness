import { createHash, randomBytes } from 'node:crypto';

/** SHA-256 hex digest of utf8 bytes. */
export function sha256Hex(input) {
  return createHash('sha256').update(input, typeof input === 'string' ? 'utf8' : undefined).digest('hex');
}

/** Canonicalize policy text for stable digests (LF endings, trailing newline). */
export function canonicalizeText(text) {
  const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

export function digestText(text) {
  return sha256Hex(canonicalizeText(text));
}

/** New fencing / idempotency token. */
export function newToken(prefix = 'tok') {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`;
}
