import test from 'node:test';
import assert from 'node:assert/strict';
import { Shell } from 'replicad';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { buildSurfaceReview, SURFACE_REVIEW_FIXTURES } from './support/shape-surface-review.mjs';
import { surfaceErrorLedger } from './support/shape-surface-error-ledger.mjs';
import { validateParametersV3 } from '../src/tools/wall-art/model/validation-v3.ts';

test('fixed P2 matrix includes all families, modes and visible material rejection', () => {
  assert.equal(new Set(SURFACE_REVIEW_FIXTURES.map(fixture => fixture.id)).size, SURFACE_REVIEW_FIXTURES.length);
  for (const fixture of SURFACE_REVIEW_FIXTURES) assert.deepEqual(validateParametersV3(fixture.parameters), fixture.parameters);
  assert.equal(SURFACE_REVIEW_FIXTURES.filter(fixture => fixture.expectedError).length, 1);
  for (const family of ['wave', 'dunes', 'ring', 'dome', 'spiral', 'ridges', 'random']) {
    for (const mode of ['stepped', 'continuous', 'blend', 'planar', 'narrow']) assert.ok(SURFACE_REVIEW_FIXTURES.some(fixture => fixture.id === `${family}-${mode}`));
  }
  assert.throws(() => surfaceErrorLedger(null, { physicalHeightErrorMm: Infinity }, .8), /accounting/);
  assert.throws(() => surfaceErrorLedger(null, {}, 0), /accounting/);
});

test('review builds survive renamed classes and retain explicit native error/work accounting', { timeout: 120000 }, async () => {
  const kernel = await loadKernel(), name = Object.getOwnPropertyDescriptor(Shell, 'name');
  Object.defineProperty(Shell, 'name', { value: 'MinifiedShell', configurable: true });
  try {
    for (const id of ['ring-stepped', 'wave-continuous']) {
      const fixture = SURFACE_REVIEW_FIXTURES.find(fixture => fixture.id === id), saved = structuredClone(fixture.parameters);
      const result = buildSurfaceReview(kernel, fixture.parameters);
      try {
        assert.equal(result.parts.length, 4); assert.ok(result.cadOperations > 0 && result.cadOperations < 200000);
        assert.ok(result.reservedFieldEvaluations <= 4000000);
        assert.ok(result.errors.every(error => error.conditionalTotalMm <= .001 && !error.formalKernelErrorProof && error.kernelConsistency === 'exact-method'));
        const positions = new Float32Array(result.parts[0].mesh.positions);
        assert.throws(() => buildSurfaceReview(kernel, { ...fixture.parameters, plinthEnabled: false, minimumRelief: .5, depth: .1, stepBlend: 0 }), /vertical material bounds/);
        assert.deepEqual(result.parts[0].mesh.positions, positions); assert.deepEqual(fixture.parameters, saved);
      } finally { result.candidates.forEach(candidate => candidate.solid.delete()); }
    }
  } finally { Object.defineProperty(Shell, 'name', name); }
});
