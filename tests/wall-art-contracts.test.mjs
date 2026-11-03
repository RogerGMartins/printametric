// Keep the phase-01 review inventory tied to runnable tests and parameter contracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PARAMETER_NAMES } from '../src/tools/wall-art/model/parameters.ts';
import { parameterCases, coverage, deferred } from './support/wall-art-cases.mjs';
test('active wall-art controls retain executable case coverage', async () => {
  assert.deepEqual(Object.keys(parameterCases).sort(), [...PARAMETER_NAMES].sort());
  for (const entry of coverage) {
    const source = await readFile(new URL(`../${entry.file}`, import.meta.url), 'utf8');
    assert.ok(source.includes(`test('${entry.test}'`), `Missing executable coverage: ${entry.controls.join(', ')}`);
    assert.ok(entry.ac.every(id => id >= 1 && id <= 10));
  }
  assert.ok(deferred.includes('packing'));
});
