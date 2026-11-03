/** Experimental center comparisons preserve the linear baseline and resource limits. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { createSurfaceField } from '../src/tools/wall-art/geometry/surface-fields.ts';
import { fitSine, evaluateCurve, multiplySmoothCenter } from '../src/tools/wall-art/geometry/surface-fit.ts';
import { createBoundaryPatches, evaluateBoundaryPatch } from '../src/tools/wall-art/geometry/surface-sampling.ts';

test('center experiments preserve the exterior, bounds, stored inputs and linear default', () => {
  for (const arms of [1, 5, 16]) {
    const parameters = { ...DEFAULT_PARAMETERS_V3, family: 'spiral', spiralArms: arms };
    const original = structuredClone(parameters), baseline = createSurfaceField(parameters);
    for (const mode of ['smooth-c1', 'smooth-c2']) {
      const field = createSurfaceField(parameters, mode);
      assert.equal(field.evaluate(0, 0), .5);
      for (let i = 0; i <= 100; i++) for (let j = 0; j < 31; j++) {
        const distance = i / 10, angle = j * 2 * Math.PI / 31, x = distance * Math.cos(angle), y = distance * Math.sin(angle);
        const value = field.evaluate(x, y);
        assert.ok(value >= 0 && value <= 1);
        if (distance >= 5.01) assert.equal(value, baseline.evaluate(x, y));
      }
      // Along a ray, the envelope's order is visible independently of the fit.
      const a = Math.abs(field.evaluate(.001, 0) - .5), b = Math.abs(field.evaluate(.002, 0) - .5);
      assert.ok(b / a > (mode === 'smooth-c1' ? 3.9 : 7.9));
    }
    assert.deepEqual(parameters, original);
    assert.equal(baseline.evaluate(1, 0), createSurfaceField(parameters, 'linear').evaluate(1, 0));
    assert.throws(() => createSurfaceField(parameters, 'unknown'), /Unknown Spiral/);
  }
});

test('experimental envelope products retain whole-interval error bounds', () => {
  for (const order of [1, 2]) for (const [start, end] of [[0, 1], [.13, .77]]) {
    const curve = fitSine(start, end, .251, .3, 6), bounded = multiplySmoothCenter(curve, start, end, order);
    for (let i = 0; i <= 2000; i++) {
      const t = i / 2000, r = start + (end - start) * t;
      const envelope = order === 1 ? 3 * r ** 2 - 2 * r ** 3 : 10 * r ** 3 - 15 * r ** 4 + 6 * r ** 5;
      assert.ok(Math.abs(evaluateCurve(bounded, t) - envelope * Math.sin(.251 * r + .3)) <= bounded.error);
    }
  }
  assert.throws(() => multiplySmoothCenter(fitSine(0, 1, 1, 0, 6), 1, 2), /domain/);
});

test('both experimental fields match bounded native patch definitions across the center join', () => {
  for (const mode of ['smooth-c1', 'smooth-c2']) for (const ratio of [.12, .8]) {
    const p = { ...DEFAULT_PARAMETERS_V3, family: 'spiral', topRatio: ratio, stepBlend: 0, plinthEnabled: false, rotation: 37, phase: .29 };
    const half = 47.5 * ratio / 2, field = createSurfaceField(p, mode);
    const patches = createBoundaryPatches(p, { minX: -half, minY: -half, maxX: half, maxY: half }, mode);
    assert.ok(patches.reduce((sum, patch) => sum + patch.poles.length / 3, 0) <= 4096);
    for (const patch of patches) {
      assert.ok(patch.physicalHeightErrorMm <= .0002);
      for (let i = 0; i < 13; i++) for (let j = 0; j < 17; j++) {
        const [x, y, z] = evaluateBoundaryPatch(patch, (i + .13) / 13, (j + .67) / 17);
        assert.ok(Math.abs(z - 20 - 30 * field.evaluate(x, y)) <= patch.physicalHeightErrorMm);
      }
    }
  }
});
