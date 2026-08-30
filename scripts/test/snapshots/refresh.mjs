#!/usr/bin/env node
// Refresh Phase-0 characterization snapshots. Run after intentional generator changes.
//   node scripts/test/snapshots/refresh.mjs

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCharacterizationSnapshots } from '../../lib/characterization.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const result = compareCharacterizationSnapshots(ROOT, { update: true });
console.log(`midas snapshots: wrote ${result.snapshotDir}`);
process.exit(0);
