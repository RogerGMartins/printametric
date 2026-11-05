import test from 'node:test';
import assert from 'node:assert/strict';
import { makePolygon } from 'replicad';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { selectNativeAnchor } from './support/shape-surface-anchor.mjs';
import { buildAnchoredPlanarFootprint, nativeFootprintMoments } from './support/shape-surface-footprint-native.mjs';
import { meshBoundarySurface } from './support/shape-surface-boundary-mesh.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';

test('native maximum-circle fallback is bounded, deterministic and keeps world placement', async () => {
  const kernel = await loadKernel(), points = [[0, 0, 0], [90, 0, 0], [90, 30, 0], [30, 30, 0], [30, 90, 0], [0, 90, 0]];
  const face = makePolygon(points), rectangle = makePolygon([[-20, -10, 0], [20, -10, 0], [20, 10, 0], [-20, 10, 0]]);
  let candidate;
  try {
    const kept = selectNativeAnchor(kernel, rectangle, [0, 0]);
    assert.equal(kept.method, 'area-centroid'); assert.deepEqual(kept.point, [0, 0]); assert.equal(kept.samples, 1);
    const expected = 30 * (2 - Math.SQRT2), first = selectNativeAnchor(kernel, face, [33, 33]), second = selectNativeAnchor(kernel, face, [33, 33]);
    assert.equal(first.method, 'inscribed-circle'); assert.deepEqual(first, second);
    assert.ok(first.samples <= 4096); assert.ok(first.radiusError <= .000502);
    assert.ok(expected >= first.radiusLower && expected <= first.radiusLower + first.radiusError);
    assert.ok(first.point.every(value => Math.abs(value - expected) < .002));
    const base = { nativeFace: face.serialize(), centroid: [33, 33], area: 4500 }, saved = structuredClone(base);
    const moments = nativeFootprintMoments(kernel, base, DEFAULT_PARAMETERS_V3, { anchor: first.point });
    const centered = nativeFootprintMoments(kernel, base, DEFAULT_PARAMETERS_V3);
    assert.ok(Math.abs(moments.mean - centered.mean) <= moments.error + centered.error);
    for (let axis = 0; axis < 2; axis++) assert.ok(Math.abs(moments.anchor[axis] + moments.scale * [moments.u, moments.v][axis] - base.centroid[axis]) <= moments.scale * moments.error);
    const top = [35, .02, -.01], ratio = .4;
    candidate = buildAnchoredPlanarFootprint(kernel, base, { ratio, concavity: 2.2, baseThickness: 10, top });
    const mesh = meshBoundarySurface(candidate);
    assert.deepEqual(base, saved); assert.deepEqual(candidate.translation, [...first.point, 0]);
    for (let axis = 0; axis < 2; axis++) {
      assert.ok(Math.abs(mesh.bounds.min[axis] + candidate.translation[axis]) < .001);
      assert.ok(Math.abs(mesh.bounds.max[axis] + candidate.translation[axis] - 90) < .001);
    }
    const maximumHeight = Math.max(...points.map(point => top[0] + point.slice(0, 2).reduce((sum, value, axis) =>
      sum + top[axis + 1] * (first.point[axis] + ratio * (value - first.point[axis]) - base.centroid[axis]), 0)));
    assert.ok(Math.abs(mesh.bounds.max[2] - maximumHeight) < .001);
    assert.ok(mesh.volumeError <= .001);
  } finally { candidate?.solid.delete(); face.delete(); rectangle.delete(); }
});
