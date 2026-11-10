import test from 'node:test';
import assert from 'node:assert/strict';
import { makePolygon, measureShapeVolumeProperties } from 'replicad';
import { nativeExtrude } from '../src/tools/wall-art/geometry/native-operations.ts';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { layoutParametersV3 } from '../src/tools/wall-art/model/validation-v3.ts';
import { partitionLayout } from '../src/tools/wall-art/geometry/layouts/partition.ts';
import { buildPlanarRectangle } from './support/shape-surface-planar-native.mjs';
import { identifyBarePart } from './support/shape-surface-bare-identification.mjs';
import { meshBoundarySurface } from './support/shape-surface-boundary-mesh.mjs';

test('bare parts retain Map-only ID only for a proven local residual-floor failure', async () => {
  const kernel = await loadKernel(), p = { ...DEFAULT_PARAMETERS_V3, plinthEnabled: false, depth: 0, minimumRelief: 20, width: 150, height: 150 };
  const layout = partitionLayout(kernel, layoutParametersV3(p)), base = layout.bases.find(b => Math.hypot(...b.centroid) < 1e-8);
  assert.ok(base);
  for (const fixture of [{ height: 20, ratio: .8, status: 'engraved' }, { height: 1.3, ratio: .8, status: 'map-only' }, { height: 3, ratio: .12, status: 'map-only' }]) {
    let bare, identified;
    try {
      bare = buildPlanarRectangle(kernel, { width: 47.5, ratio: fixture.ratio, concavity: 2.2, baseThickness: 0, top: [fixture.height, 0, 0] });
      const before = meshBoundarySurface(bare);
      identified = identifyBarePart(kernel, { ...p, topRatio: fixture.ratio, minimumRelief: fixture.height }, base, bare.solid);
      assert.equal(identified.identification.status, fixture.status);
      const after = meshBoundarySurface({ ...bare, solid: identified.solid });
      assert.ok(identified.operations <= 4096);
      if (fixture.status === 'map-only') {
        assert.equal(identified.identification.reason, 'residual-floor');
        assert.ok(Math.abs(after.nativeVolume - before.nativeVolume) < 1e-8);
        assert.deepEqual(after.bounds, before.bounds);
      } else {
        assert.ok(after.nativeVolume < before.nativeVolume);
        assert.equal(identified.identification.orientationMark, true);
      }
      const original = measureShapeVolumeProperties(bare.solid);
      try { assert.ok(Math.abs(original.volume - before.nativeVolume) < 1e-8); } finally { original.delete(); }
      if (fixture.height === 20) {
        const unavailableCut = new Proxy(kernel, { get(target, key) { if (key === 'BRepAlgoAPI_Cut') throw Error('Injected native cut failure'); return Reflect.get(target, key); } });
        assert.throws(() => identifyBarePart(unavailableCut, p, base, bare.solid), /Injected native cut failure/);
      }
      if (fixture.height === 1.3) {
        const unmarked = identifyBarePart(kernel, { ...p, engravingDepth: 0 }, base, bare.solid);
        try { assert.equal(unmarked.identification.status, 'unengraved'); assert.equal(unmarked.operations, 0); } finally { unmarked.solid.delete(); }
      }
    } finally { identified?.solid.delete(); bare?.solid.delete(); }
  }
  assert.throws(() => identifyBarePart(null, { ...p, minimumRelief: 0 }, base, null), /height|thickness|relief/i);
  const face = makePolygon([[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]]), invalidBare = nativeExtrude(kernel, face, 1);
  try { assert.throws(() => identifyBarePart(kernel, { ...p, minimumRelief: 1 }, base, invalidBare), /Bare material is invalid/); }
  finally { invalidBare.delete(); face.delete(); }
});

test('bare engraving checks below, at and above the local floor, including sloping material', async () => {
  const kernel = await loadKernel(), p = { ...DEFAULT_PARAMETERS_V3, plinthEnabled: false, depth: 0, minimumRelief: 20, width: 150, height: 150 };
  const base = partitionLayout(kernel, layoutParametersV3(p)).bases.find(b => Math.hypot(...b.centroid) < 1e-8);
  const face = makePolygon([[-23.75, -23.75, 0], [23.75, -23.75, 0], [23.75, 23.75, 0], [-23.75, 23.75, 0]]);
  try {
    for (const offset of [-.1, -.01, -.001, 0, .01]) {
      const solid = nativeExtrude(kernel, face, p.engravingDepth + 1.2 + offset);
      let result;
      try {
        if (offset === -.001) {
          assert.throws(() => identifyBarePart(kernel, p, base, solid), /Cannot certify the local engraving floor/);
          continue;
        }
        result = identifyBarePart(kernel, p, base, solid);
        assert.equal(result.identification.status, offset < 0 ? 'map-only' : 'engraved');
        if (offset < 0) assert.equal(result.identification.reason, 'residual-floor');
      } finally { result?.solid.delete(); solid.delete(); }
    }
    // A tall edge cannot establish the floor under marks near the low edge.
    const sloping = buildPlanarRectangle(kernel, { width: 47.5, ratio: 1, concavity: 1, baseThickness: 0, top: [2.1, .8, 0] });
    let result;
    try {
      result = identifyBarePart(kernel, p, base, sloping.solid);
      assert.equal(result.identification.status, 'map-only');
      assert.equal(result.identification.reason, 'residual-floor');
    } finally { result?.solid.delete(); sloping.solid.delete(); }
  } finally { face.delete(); }
});
