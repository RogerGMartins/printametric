/** R1 numerical coverage, independent analytic oracles and bounded-work rejection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { createSurfaceField } from '../src/tools/wall-art/geometry/surface-fields.ts';
import { fitSine, evaluateCurve, elevateCurve, multiplyLinear, fitPowerProfile } from '../src/tools/wall-art/geometry/surface-fit.ts';
import { createBoundaryPatches, evaluateBoundaryPatch, SURFACE_DOMAIN_LIMITS } from '../src/tools/wall-art/geometry/surface-sampling.ts';

test('harmonic Cartesian and Ring polar patches bound the actual physical field', () => {
  for (const family of ['wave', 'dunes', 'random', 'ring']) for (const rotation of [0, 37]) for (const density of [2, 12]) {
    const p = { ...DEFAULT_PARAMETERS_V3, family, stepBlend: 0, plinthEnabled: false, rotation, density, phase: .29, surfaceSeed: 5000 };
    const field = createSurfaceField(p);
    const patches = createBoundaryPatches(p, { minX: -19, maxX: 19, minY: -19, maxY: 19 });
    assert.ok(patches.length > 0);
    assert.ok(patches.reduce((sum, patch) => sum + patch.poles.length / 3, 0) <= 4096);
    for (const patch of patches) {
      assert.ok(patch.physicalHeightErrorMm <= .0002);
      for (let i = 0; i < 13; i++) for (let j = 0; j < 17; j++) {
        const [x, y, z] = evaluateBoundaryPatch(patch, (i + .37) / 13, (j + .61) / 17);
        assert.ok(Math.abs(z - (20 + 30 * field.evaluate(x, y))) <= patch.physicalHeightErrorMm,
          `${family}/${rotation}/${density}`);
      }
    }
  }
});

test('Bernstein interpolation bounds the interval, including between interpolation nodes', () => {
  for (const degree of [6, 10, 12, 18]) {
    const curve = fitSine(-.37, .53, 5.7, .19, degree);
    const raised = elevateCurve(curve, 20), product = multiplyLinear(curve, .3, .9);
    assert.ok(curve.error > 0 && Number.isFinite(curve.error));
    for (let i = 0; i < 1001; i++) {
      const t = i / 1000, expected = Math.sin(5.7 * (-.37 + .9 * t) + .19);
      assert.ok(Math.abs(evaluateCurve(curve, t) - expected) <= curve.error);
      assert.ok(Math.abs(evaluateCurve(raised, t) - expected) <= raised.error);
      assert.ok(Math.abs(evaluateCurve(product, t) - expected * (.3 + .6 * t)) <= product.error);
    }
  }
  assert.throws(() => fitSine(0, 1, Infinity, 0, 12), /domain/);
  assert.throws(() => fitSine(0, 1, 1, 0, 19), /degree/);
});

test('side profiles preserve straight/integer powers and bound the provisional 2.2 profile', () => {
  for (const exponent of [1, 2, 2.2, 3, 4]) for (const ratio of [.12, .8]) {
    const scale = 47.5 / 2 * Math.SQRT2 * (1 - ratio), curve = fitPowerProfile(exponent, .0002 / scale);
    assert.ok(curve.error * scale <= .0002);
    assert.equal(evaluateCurve(curve, 0), 0);
    assert.equal(evaluateCurve(curve, 1), 1);
    for (let i = 0; i < 10001; i++) {
      const t = i / 10000;
      assert.ok(Math.abs(evaluateCurve(curve, t) - t ** exponent) <= curve.error + 4e-15);
    }
  }
  assert.throws(() => fitPowerProfile(Infinity, .0001), /profile/);
  assert.throws(() => fitPowerProfile(2.2, 1e-14), /bounded/);
});

test('piecewise domains cover all formerly rejected regions with bounded physical-height error', () => {
  for (const family of ['spiral', 'ridges', 'dome']) for (const ratio of [.12, .8]) for (const origin of [0, 250]) {
    const parameters = { ...DEFAULT_PARAMETERS_V3, family, topRatio: ratio, stepBlend: 0, plinthEnabled: false };
    const half = 47.5 * ratio / 2, field = createSurfaceField(parameters);
    const box = { minX: origin - half, maxX: origin + half, minY: -half, maxY: half };
    const patches = createBoundaryPatches(parameters, box);
    assert.ok(patches.length > 0 && patches.length <= SURFACE_DOMAIN_LIMITS.patches);
    assert.ok(patches.reduce((sum, p) => sum + p.poles.length / 3, 0) <= SURFACE_DOMAIN_LIMITS.poles);
    for (const patch of patches) {
      assert.ok(patch.physicalHeightErrorMm <= .0002);
      for (let i = 0; i < 17; i++) for (let j = 0; j < 19; j++) {
        const [x, y, z] = evaluateBoundaryPatch(patch, (i + .31) / 17, (j + .67) / 19);
        const expected = parameters.minimumRelief + parameters.depth * field.evaluate(x, y);
        assert.ok(Math.abs(z - expected) <= patch.physicalHeightErrorMm, `${patch.id}: physical error bound`);
      }
    }
    if (family === 'spiral' && ratio === .8 && origin === 0) {
      assert.ok(patches.some(p => p.kind === 'polar-inner' && p.v[1] === .02));
      assert.ok(patches.some(p => p.kind === 'polar-outer' && p.v[0] === .02));
    }
    if (family === 'dome' && origin === 250) {
      assert.ok(patches.some(p => p.kind === 'polar-inner' && p.v[1] === 1));
      assert.ok(patches.some(p => p.kind === 'polar-outer' && p.v[0] === 1));
    }
    // Independently invert each chart for a grid over the requested rectangle.
    // This checks ideal-domain coverage; native trimmed coverage remains R2.
    for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
      const x = box.minX + (box.maxX - box.minX) * (i + .5) / 13;
      const y = box.minY + (box.maxY - box.minY) * (j + .5) / 13;
      if (family !== 'ridges') {
        const r = 2 * Math.hypot(x, y) / 500, theta = Math.atan2(y, x);
        assert.ok(patches.some(p => r >= p.v[0] - 1e-12 && r <= p.v[1] + 1e-12 && [-2 * Math.PI, 0, 2 * Math.PI].some(turn => theta + turn >= p.u[0] - 1e-12 && theta + turn <= p.u[1] + 1e-12)));
      }
    }
  }
});

test('domain generation retains rotation and independent seed semantics and rejects excess work', () => {
  const box = { minX: -19, maxX: 19, minY: -19, maxY: 19 };
  for (const family of ['spiral', 'ridges', 'dome']) {
    const parameters = { ...DEFAULT_PARAMETERS_V3, family, stepBlend: 0, plinthEnabled: false, rotation: 37, phase: .29, surfaceSeed: 5000 };
    const field = createSurfaceField(parameters), patches = createBoundaryPatches(parameters, box);
    assert.deepEqual(patches, createBoundaryPatches({ ...parameters, seed: 9999 }, box));
    for (const p of patches) for (const [u, v] of [[.13, .29], [.73, .81], [0, 0], [1, 1]]) {
      const [x, y, z] = evaluateBoundaryPatch(p, u, v);
      assert.ok(Math.abs(z - parameters.minimumRelief - parameters.depth * field.evaluate(x, y)) <= p.physicalHeightErrorMm);
    }
  }
  assert.throws(() => createBoundaryPatches({ ...DEFAULT_PARAMETERS_V3, family: 'spiral', stepBlend: 0, width: 80, height: 80, density: 12, spiralArms: 16 }, { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 }), error => error.code === 'SURFACE_BUDGET');
  assert.throws(() => createBoundaryPatches(DEFAULT_PARAMETERS_V3, box), /continuous/);
});
