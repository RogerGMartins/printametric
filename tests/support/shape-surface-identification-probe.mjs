/** Fresh native heap per family for real continuous no-plinth identification. */
import { parentPort, workerData } from 'node:worker_threads';
import assert from 'node:assert/strict';
import { importSTEP } from 'replicad';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { loadKernel } from './wall-art-kernel.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../../src/tools/wall-art/model/parameters-v3.ts';
import { layoutParametersV3 } from '../../src/tools/wall-art/model/validation-v3.ts';
import { partitionLayout } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { buildBoundarySurface } from './shape-surface-boundary-native.mjs';
import { identifyFootprintCandidate } from './shape-surface-identified-footprint.mjs';
import { measureBoundaryVolume, meshBoundarySurface } from './shape-surface-boundary-mesh.mjs';
import { validateMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { serializeSTEP } from '../../src/shared/export/step.ts';
import { serializeSTL } from '../../src/shared/export/stl.ts';

const kernel = await loadKernel(), rows = [];
const parameters = { ...DEFAULT_PARAMETERS_V3, width: 160, height: 150, outline: 'ellipse', layout: 'radial', straightBoundary: true,
  family: workerData.family, plinthEnabled: false, stepBlend: 0, phase: .29, rotation: 37, topRatio: .8 };
const base = partitionLayout(kernel, layoutParametersV3(parameters)).bases.filter(b => b.area >= 100 && b.span.lower >= 3.1).sort((a, b) => b.area - a.area)[0];
const saved = structuredClone(base);
for (const fixture of [{ minimumRelief: 20, depth: 3, status: 'engraved' }, { minimumRelief: 1.3, depth: .1, status: 'map-only' }]) {
  const p = { ...parameters, minimumRelief: fixture.minimumRelief, depth: fixture.depth };
  let bare, result;
  try {
    bare = buildBoundarySurface(kernel, p, { footprint: base, spiralCenter: 'smooth-c2' });
    const before = meshBoundarySurface(bare), sourceBytes = bare.solid.serialize();
    result = identifyFootprintCandidate(kernel, p, base, bare);
    assert.equal(result.identification.status, fixture.status);
    assert.equal(result.id, base.id); assert.equal(result.mapNumber, base.mapNumber);
    assert.deepEqual(result.translation, bare.translation); assert.deepEqual(base, saved);
    assert.equal(bare.solid.serialize(), sourceBytes);
    const after = meshBoundarySurface(result), checked = validateMesh(after.mesh);
    if (fixture.status === 'engraved') {
      assert.ok(before.nativeVolume - after.nativeVolume > 1);
      assert.ok(validateMesh(before.mesh).volume - checked.volume > 1, 'The canonical mesher must include the identification cuts.');
    } else {
      assert.equal(result.identification.reason, 'residual-floor');
      assert.ok(Math.abs(before.nativeVolume - after.nativeVolume) < 1e-8);
      assert.deepEqual(after.mesh, before.mesh);
    }
    const part = { id: result.id, mapNumber: result.mapNumber, translation: result.translation, mesh: after.mesh, ...checked };
    const restored = await importSTEP(new Blob([await serializeSTEP([part], [result.solid])]));
    try { validateSolid(kernel, restored); assert.ok(Math.abs(measureBoundaryVolume(restored).nativeVolume / after.nativeVolume - 1) < .00001); }
    finally { restored.delete(); }
    const geometry = new STLLoader().parse(serializeSTL([part]).buffer);
    try {
      geometry.computeBoundingBox(); assert.equal(geometry.attributes.position.count, after.mesh.indices.length);
      for (const side of ['min', 'max']) geometry.boundingBox[side].toArray().forEach((v, axis) => assert.ok(Math.abs(v - checked.bounds[side][axis] - part.translation[axis]) < .001));
    } finally { geometry.dispose(); }
    rows.push({ family: p.family, status: result.identification.status, reason: result.identification.reason, triangles: after.mesh.indices.length / 3,
      operations: result.identificationOperations, volumeError: after.volumeError });
  } finally { result?.solid.delete(); bare?.solid.delete(); }
}
assert.throws(() => buildBoundarySurface(kernel, { ...parameters, minimumRelief: .5, depth: .1 }, { footprint: base, spiralCenter: 'smooth-c2' }), /vertical material bounds/);
assert.deepEqual(base, saved);
parentPort.postMessage(rows);
