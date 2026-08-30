import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isManualCheckBody } from '../../render-adapters.mjs';

describe('isManualCheckBody', () => {
  it('detects a leading manual: prefix', () => {
    assert.equal(isManualCheckBody('`manual:` the PR notes name each surface'), true);
    assert.equal(isManualCheckBody('manual: reviewer names a reference'), true);
  });

  it('detects a leading *(manual)* marker', () => {
    assert.equal(isManualCheckBody('*(manual)* Under any execution_mode'), true);
  });

  it('detects a trailing *(manual.)* / *(manual: …)* marker', () => {
    assert.equal(
      isManualCheckBody('when a stack rule names a linter. *(manual.)*'),
      true,
    );
    assert.equal(
      isManualCheckBody('not run on the orchestrate tier. *(manual: a phase whose only work is fetch)*'),
      true,
    );
  });

  it('does not classify a grep/command body as manual', () => {
    assert.equal(isManualCheckBody('`grep -nE "foo" src/` returns empty'), false);
    assert.equal(isManualCheckBody('`node scripts/doctor.mjs` exits 0'), false);
  });
});
