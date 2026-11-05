import test from 'node:test';
import assert from 'node:assert/strict';
import { measureShapeVolumeProperties } from 'replicad';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { buildPlanarRectangle } from './support/shape-surface-planar-native.mjs';
import { meshBoundarySurface } from './support/shape-surface-boundary-mesh.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { rectangleSurfaceMoments, fitRectanglePlane } from '../src/tools/wall-art/geometry/surface-moments.ts';

test('stepped and genuinely sloping tops share valid native flanks and an optional plinth', { timeout: 60_000 }, async () => {
  const kernel = await loadKernel();
  const p = { ...DEFAULT_PARAMETERS_V3, rotation: 37, phase: 0, topRatio: .8 };
  const moments = rectangleSurfaceMoments(p, { minX: -19, maxX: 19, minY: -19, maxY: 19 });
  const plane = fitRectanglePlane(moments);
  assert.ok(Math.abs(plane[1]) > .1 && Math.abs(plane[2]) > .05);
  for (const concavity of [1, 2.2, 4]) for (const baseThickness of [0, 10]) for (const sloping of [false, true]) {
    const ratio = sloping ? .8 : .12, top = [baseThickness + 20 + 30 * plane[0], sloping ? 30 * plane[1] : 0, sloping ? 30 * plane[2] : 0];
    const candidate = buildPlanarRectangle(kernel, { width: 47.5, ratio, concavity, baseThickness, top });
    try {
      const factor = ratio * ratio + 2 * ratio * (1 - ratio) / (concavity + 1) + (1 - ratio) ** 2 / (2 * concavity + 1);
      // Odd terms from the sloped plane integrate to zero over this centered base.
      const expected = 47.5 ** 2 * (baseThickness + (top[0] - baseThickness) * factor);
      const properties = measureShapeVolumeProperties(candidate.solid);
      try { assert.ok(Math.abs(properties.volume / expected - 1) < .00005); } finally { properties.delete(); }
      const result = meshBoundarySurface(candidate);
      assert.ok(result.volumeError < .001 && result.mesh.indices.length / 3 < 100_000);
    } catch (error) { throw new Error(`curvature=${concavity}, plinth=${baseThickness}, sloping=${sloping}: ${error.message}`, { cause: error }); }
    finally { candidate.solid.delete(); }
  }
  assert.throws(() => buildPlanarRectangle(kernel, { width: 47.5, ratio: .12, concavity: 1, baseThickness: 0, top: [35, 15, 0] }), /folded flanks/);
  assert.throws(() => buildPlanarRectangle(null, { width: 47.5, ratio: .12, concavity: 1, baseThickness: 0, top: [0, 0, 0] }), /material/);
});
