import test from 'node:test';
import assert from 'node:assert/strict';
import { makePolygon, measureShapeVolumeProperties, importSTEP } from 'replicad';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { buildPlanarRectangle } from './support/shape-surface-planar-native.mjs';
import { meshBoundarySurface, measureBoundaryVolume } from './support/shape-surface-boundary-mesh.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { rectangleSurfaceMoments, fitRectanglePlane } from '../src/tools/wall-art/geometry/surface-moments.ts';
import { buildPlanarFootprint } from './support/shape-surface-footprint-native.mjs';
import { buildBoundarySurface } from './support/shape-surface-boundary-native.mjs';
import { serializeSTEP } from '../src/shared/export/step.ts';
import { validateSolid } from '../src/shared/geometry/kernel.ts';
import { validateMesh } from '../src/shared/geometry/validate-mesh.ts';

test('fractional curvature reaches all native builders without a singular endpoint', { timeout: 60_000 }, async () => {
  const kernel = await loadKernel(), width = 20, face = makePolygon([[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]]);
  const base = { nativeFace: face.serialize(), centroid: [0, 0], area: width ** 2 };
  try {
    for (const [concavity, ratio] of [[1.1, 1], [1.5, .99], [1.99, .8]]) {
      const builders = [
        () => buildPlanarRectangle(kernel, { width, ratio, concavity, baseThickness: 0, top: [20, 0, 0] }),
        () => buildPlanarFootprint(kernel, base, { ratio, concavity, baseThickness: 0, top: [20, 0, 0] }),
        () => buildBoundarySurface(kernel, { ...DEFAULT_PARAMETERS_V3, topRatio: ratio, concavity, minimumRelief: 20, depth: 0, stepBlend: 0, plinthEnabled: false }, { footprint: base }),
      ];
      for (const build of builders) {
        const candidate = build();
        try {
          const mesh = meshBoundarySurface(candidate);
          const expected = width ** 2 * 20 * (ratio ** 2 + 2 * ratio * (1 - ratio) / (concavity + 1) + (1 - ratio) ** 2 / (2 * concavity + 1));
          assert.ok(Math.abs(mesh.nativeVolume / expected - 1) < .00005);
          assert.ok(mesh.volumeError <= .001 && mesh.mesh.indices.length / 3 <= 100_000);
          if (concavity === 1.5) {
            const bytes = await serializeSTEP([{ id: 'fractional-profile', mapNumber: 1, translation: [17, 31, 0], mesh: mesh.mesh, ...validateMesh(mesh.mesh) }], [candidate.solid]);
            const restored = await importSTEP(new Blob([bytes]));
            try { validateSolid(kernel, restored); assert.ok(Math.abs(measureBoundaryVolume(restored).nativeVolume / mesh.nativeVolume - 1) < 1e-5); }
            finally { restored.delete(); }
          }
        } finally { candidate.solid.delete(); }
      }
    }
  } finally { face.delete(); }
});

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
