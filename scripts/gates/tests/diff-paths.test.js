import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasProductionPaths, isProductionPath } from '../lib/diff-paths.mjs';

describe('diff-paths production heuristic', () => {
  it('isProductionPath matches product source trees', () => {
    assert.equal(isProductionPath('src/app.ts'), true);
    assert.equal(isProductionPath('apps/web/main.tsx'), true);
  });

  it('isProductionPath matches deploy and CI paths', () => {
    assert.equal(isProductionPath('Dockerfile'), true);
    assert.equal(isProductionPath('docker-compose.yml'), true);
    assert.equal(isProductionPath('.github/workflows/ci.yml'), true);
    assert.equal(isProductionPath('infra/terraform/main.tf'), true);
    assert.equal(isProductionPath('api/openapi.yaml'), true);
  });

  it('isProductionPath rejects engine, docs, and tests', () => {
    assert.equal(isProductionPath('harness/conventions.md'), false);
    assert.equal(isProductionPath('docs/readme.md'), false);
    assert.equal(isProductionPath('scripts/doctor.mjs'), false);
    assert.equal(isProductionPath('src/foo.test.ts'), false);
    assert.equal(isProductionPath('README.md'), false);
  });

  it('isProductionPath matches installed product source trees', () => {
    assert.equal(isProductionPath('.harness/product/src/app.ts'), true);
    assert.equal(isProductionPath('.harness/product/app/page.tsx'), true);
    assert.equal(isProductionPath('.midas/product/src/index.ts'), true);
    assert.equal(isProductionPath('product/src/main.go'), true);
  });

  it('isProductionPath excludes product ritual paths', () => {
    assert.equal(isProductionPath('.harness/product/sprints/01-auth.md'), false);
    assert.equal(isProductionPath('.harness/product/src/foo.test.ts'), false);
  });

  it('hasProductionPaths aggregates', () => {
    assert.equal(hasProductionPaths(['docs/a.md', 'harness/b.md']), false);
    assert.equal(hasProductionPaths(['docs/a.md', 'Dockerfile']), true);
  });
});
