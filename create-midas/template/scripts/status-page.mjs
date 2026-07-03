#!/usr/bin/env node
// status-page.mjs — generate a static status.html from harness/state.yaml + .harness/* (no deps).
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'status.html');

function read(rel) {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function listDir(rel, pattern) {
  const dir = join(ROOT, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => !pattern || pattern.test(f)).sort();
}

const state = read('harness/state.yaml') || '';
const stage = (state.match(/^stage:\s*(\S+)/m) || [])[1] || '—';
const stageStatus = (state.match(/^stage_status:\s*(\S+)/m) || [])[1] || '—';
const track = (state.match(/^track:\s*(\S+)/m) || [])[1] || 'full';
const setup = (state.match(/^setup_complete:\s*(\S+)/m) || [])[1] || '—';
const version = (state.match(/^midas_version:\s*(\S+)/m) || [])[1] || '—';

const audits = listDir('.harness/audits', /\.md$/);
const verifs = listDir('.harness/verifications', /\.md$/);
const debates = listDir('.harness/debates', /\.md$/);
const sprints = listDir('.harness/sprints', /\.md$/);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Midas status — ${esc(stage)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 56rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    h1 { font-size: 1.5rem; }
    .meta { color: #555; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: left; }
    th { background: #f5f5f5; }
    code { background: #f0f0f0; padding: 0.1rem 0.3rem; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Midas harness status</h1>
  <p class="meta">Generated locally · not committed · open this file in a browser</p>
  <table>
    <tr><th>Engine version</th><td>${esc(version)}</td></tr>
    <tr><th>Stage</th><td><code>${esc(stage)}</code> (${esc(stageStatus)})</td></tr>
    <tr><th>Track</th><td>${esc(track)}</td></tr>
    <tr><th>Setup complete</th><td>${esc(setup)}</td></tr>
  </table>
  <h2>Artifacts</h2>
  <table>
    <tr><th>Audits</th><td>${audits.length ? audits.map(esc).join(', ') : '—'}</td></tr>
    <tr><th>Verifications</th><td>${verifs.length ? verifs.map(esc).join(', ') : '—'}</td></tr>
    <tr><th>Debates</th><td>${debates.length ? debates.map(esc).join(', ') : '—'}</td></tr>
    <tr><th>Sprint progress</th><td>${sprints.length ? sprints.map(esc).join(', ') : '—'}</td></tr>
  </table>
  <p>Source: <code>harness/state.yaml</code> + <code>.harness/*</code></p>
</body>
</html>
`;

writeFileSync(OUT, html, 'utf8');
console.log(`wrote ${OUT}`);
