// walk-template.mjs — shared template tree walk for plan-tree (dry-run) and copy-tree (write).

import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toPosixRel } from '../shared/posix.mjs';
import { isHostDiscoveryMirrorPath } from './preserve-policy.mjs';

/**
 * Visit every template file (skip `.optional/` and host-discovery mirrors).
 * Directories are visited so callers can mkdir; files get `{ type: 'file', src, dst, rel }`.
 *
 * @param {string} srcDir
 * @param {string} dstDir
 * @param {{ target: string }} opts
 * @param {(node: { type: 'dir'|'file', src: string, dst: string, rel: string }) => void} visitor
 */
export function walkTemplate(srcDir, dstDir, opts, visitor) {
  const target = opts.target;
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === '.optional') continue;
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    const rel = toPosixRel(relative(target, dst));
    if (isHostDiscoveryMirrorPath(rel)) continue;
    if (entry.isDirectory()) {
      visitor({ type: 'dir', src, dst, rel });
      walkTemplate(src, dst, opts, visitor);
      continue;
    }
    visitor({ type: 'file', src, dst, rel });
  }
}
