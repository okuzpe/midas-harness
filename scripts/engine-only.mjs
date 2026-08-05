// engine-only.mjs — surfaces that belong in the midas-harness contributor tree
// but must never ship in create-midas/template or plugins/midas.

export const ENGINE_ONLY_SKILLS = Object.freeze(['midas-precommit']);

/** Relative paths under `harness/` to strip from the install template engine tree. */
export const HARNESS_ENGINE_ONLY_RELS = Object.freeze([
  'state.yaml',
  'autonomy',
  ...ENGINE_ONLY_SKILLS.map((name) => `skills/${name}`),
]);

/**
 * True when `root` looks like the midas-harness engine repo (not a product install).
 * @param {string} root
 * @param {{ existsSync: (p: string) => boolean, readFileSync: (p: string, enc: string) => string }} fs
 * @param {{ join: (...parts: string[]) => string }} path
 */
export function isEngineRepo(root, fs, path) {
  const pkgPath = path.join(root, 'package.json');
  const testPath = path.join(root, 'scripts', 'test.mjs');
  if (!fs.existsSync(pkgPath) || !fs.existsSync(testPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg?.name === 'midas-harness';
  } catch {
    return false;
  }
}

/**
 * Remove engine-only skill directories from a skills root (e.g. plugins/midas/skills).
 * @param {string} skillsRoot
 * @param {{ existsSync: (p: string) => boolean, rmSync: (p: string, o: object) => void }} fs
 * @param {{ join: (...parts: string[]) => string }} path
 * @returns {string[]} removed skill names
 */
export function stripEngineOnlySkills(skillsRoot, fs, path) {
  const removed = [];
  for (const name of ENGINE_ONLY_SKILLS) {
    const abs = path.join(skillsRoot, name);
    if (!fs.existsSync(abs)) continue;
    fs.rmSync(abs, { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}
