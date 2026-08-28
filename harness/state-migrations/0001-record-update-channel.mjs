// Installs written before the release-channel feature have no `channel` key, so `update` would fall
// back to the default on every run and never record what the project actually tracks. Pin it once,
// explicitly, so a later switch to `edge` is a visible edit rather than an invisible default.

export const id = '0001-record-update-channel';
export const description = 'Record the release channel (stable) in state.yaml';

/**
 * @param {{
 *   root: string,
 *   engineDir: string,
 *   statePath: string,
 *   patchState: (fn: (yaml: string) => string) => void,
 * }} ctx
 */
export async function up(ctx) {
  ctx.patchState((yaml) => {
    if (/^channel:\s*\S+/m.test(yaml)) return yaml;
    // Sits next to the other install-provenance keys; falls back to appending when they are absent.
    if (/^setup_complete:.*$/m.test(yaml)) {
      return yaml.replace(/^(setup_complete:.*)$/m, '$1\nchannel: stable');
    }
    return `${yaml.replace(/\s*$/, '')}\nchannel: stable\n`;
  });
}
