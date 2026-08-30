// helpers.mjs — shared doctor helpers bound to a project root.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isHostMirrorExcluded } from '../skill-registry.mjs';
import { walkFiles } from '../lib/walk.mjs';

/**
 * @param {string} ROOT
 * @param {{ engine: string }} paths
 */
export function createDoctorHelpers(ROOT, paths) {
  function read(rel) {
    const p = join(ROOT, rel);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  }

  function tallyNum(line, key) {
    const m = line.match(new RegExp(key + '=(\\d+)'));
    return m ? Number(m[1]) : 0;
  }

  function agentPath(name) {
    const host = join('.claude', 'agents', name + '.md');
    const engine = join(paths.engine, 'agents', name + '.md');
    if (existsSync(join(ROOT, host))) return host;
    if (existsSync(join(ROOT, engine))) return engine;
    return null;
  }

  function agentModel(name) {
    const rel = agentPath(name);
    const t = rel && read(rel);
    const m = t && t.match(/^model:\s*([^\s#]+)/m);
    return m ? m[1] : null;
  }

  function walkRelativeFiles(base) {
    return walkFiles(base, { relativeTo: base, exclude: [] });
  }

  function compareMirror(sourceRel, targetRel, transform = (_rel, raw) => raw, opts = {}) {
    const source = join(ROOT, sourceRel);
    const target = join(ROOT, targetRel);
    if (!existsSync(source)) return { status: 'skip', note: `no ${sourceRel}` };
    if (!existsSync(target)) return { status: 'warn', note: `${targetRel} missing` };
    const excludeTop = opts.excludeTopLevelDirs instanceof Set
      ? opts.excludeTopLevelDirs
      : new Set(opts.excludeTopLevelDirs || []);
    const sourceFiles = walkRelativeFiles(source).filter((file) => {
      const top = file.split('/')[0];
      return !excludeTop.has(top);
    });
    const targetFiles = walkRelativeFiles(target);
    const missing = sourceFiles.filter((file) => !targetFiles.includes(file));
    const extra = targetFiles.filter((file) => !sourceFiles.includes(file));
    const staleExcluded = extra.filter((file) => excludeTop.has(file.split('/')[0]));
    const drifted = sourceFiles.filter((file) => {
      const targetFile = join(target, file);
      return existsSync(targetFile) &&
        readFileSync(targetFile, 'utf8') !== transform(file, readFileSync(join(source, file), 'utf8'));
    });
    const failures = [
      missing.length ? `missing=${missing.length}` : '',
      drifted.length ? `drift=${drifted.length}` : '',
      staleExcluded.length ? `stale-excluded=${staleExcluded.length}` : '',
    ].filter(Boolean);
    const userExtra = extra.length - staleExcluded.length;
    return failures.length
      ? { status: 'warn', note: `${failures.join(', ')} — regenerate ${targetRel}` }
      : {
          status: 'ok',
          note: `${sourceFiles.length}/${sourceFiles.length} Midas files match` +
            (userExtra > 0 ? `; ${userExtra} user/host file(s) preserved` : ''),
        };
  }

  function hostMirrorSkillExcludeSet(engineSkillsRel) {
    const abs = join(ROOT, engineSkillsRel);
    if (!existsSync(abs)) return new Set();
    return new Set(
      readdirSync(abs, { withFileTypes: true })
        .filter((e) => e.isDirectory() && isHostMirrorExcluded(e.name))
        .map((e) => e.name),
    );
  }

  return {
    read,
    tallyNum,
    agentPath,
    agentModel,
    walkRelativeFiles,
    compareMirror,
    hostMirrorSkillExcludeSet,
  };
}
