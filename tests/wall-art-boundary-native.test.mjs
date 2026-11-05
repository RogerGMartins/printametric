/** R2 capability regressions. A valid CAD shell is not sufficient for acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { importSTEP, measureVolume } from 'replicad';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import initReader from 'occt-import-js';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { buildBoundarySurface } from './support/shape-surface-boundary-native.mjs';
import { meshBoundarySurface, removeCollapsedTriangles } from './support/shape-surface-boundary-mesh.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { validateSolid } from '../src/shared/geometry/kernel.ts';
import { validateMesh } from '../src/shared/geometry/validate-mesh.ts';
import { serializeSTEP } from '../src/shared/export/step.ts';
import { serializeSTL } from '../src/shared/export/stl.ts';

test('boundary-aware CAD patches survive meshing and native STEP/STL round trips', { timeout: 60_000 }, async () => {
  const kernel = await loadKernel();
  for (const [family, origin] of [['spiral', [0, 0]], ['ridges', [0, 0]], ['dome', [250, 0]],
    ['wave', [62.5, 0]], ['dunes', [62.5, 0]], ['random', [62.5, 0]], ['ring', [0, 0]]]) {
    const candidate = buildBoundarySurface(kernel, { ...DEFAULT_PARAMETERS_V3, family, topRatio: .8,
      concavity: 2.2, stepBlend: 0, plinthEnabled: false }, { origin });
    try {
      validateSolid(kernel, candidate.solid);
      assert.ok(candidate.physicalHeightErrorMm <= .0002);
      assert.ok(candidate.profilePositionErrorMm <= .0002);
      assert.ok(candidate.poles <= 4096);
      const result = meshBoundarySurface(candidate), checked = validateMesh(result.mesh);
      assert.ok(result.volumeError <= .001);
      const part = { id: `checkpoint-${family}`, mapNumber: 1, translation: [137, -46, 9], mesh: result.mesh, ...checked };
      const bytes = await serializeSTEP([part], [candidate.solid]);
      assert.match(new TextDecoder().decode(bytes), /B_SPLINE_SURFACE/);
      const restored = await importSTEP(new Blob([bytes]));
      try {
        validateSolid(kernel, restored);
        assert.ok(Math.abs(measureVolume(restored) - result.nativeVolume) / result.nativeVolume < .00001);
      } finally { restored.delete(); }
      const stl = serializeSTL([part]), geometry = new STLLoader().parse(stl.buffer);
      try {
        geometry.computeBoundingBox();
        assert.equal(geometry.attributes.position.count, result.mesh.indices.length);
        for (const side of ['min', 'max']) geometry.boundingBox[side].toArray().forEach((value, axis) => {
          assert.ok(Math.abs(value - checked.bounds[side][axis] - part.translation[axis]) < .001, `${family}: ${side}/${axis}`);
        });
      } finally { geometry.dispose(); }
    } finally { candidate.solid.delete(); }
  }
});

test('narrow Spiral remains rejected when native validity passes but tessellation is invalid', { timeout: 60_000 }, async () => {
  const kernel = await loadKernel();
  const candidate = buildBoundarySurface(kernel, { ...DEFAULT_PARAMETERS_V3, family: 'spiral', topRatio: .12,
    concavity: 1, stepBlend: 0, plinthEnabled: false });
  try {
    validateSolid(kernel, candidate.solid);
    assert.ok(candidate.physicalHeightErrorMm <= .0002);
    const raw = candidate.solid.mesh({ tolerance: .05, angularTolerance: Math.PI / 36 });
    assert.ok(raw.triangles.length / 3 < 100_000);
    assert.throws(() => validateMesh(removeCollapsedTriangles(raw).mesh), /open, non-manifold or inconsistently wound/);
    assert.throws(() => meshBoundarySurface(candidate), /triangle budget.*Earlier attempts:.*open, non-manifold/);
  } finally { candidate.solid.delete(); }
});

for (const fixture of [
  { name: 'narrow curved center', topRatio: .12, concavity: 2.2 },
  { name: 'broad straight center within the original triangle cap', topRatio: .8, concavity: 1 },
]) test(`experimental C2 ${fixture.name} supports canonical mesh and two native STEP readers`, { timeout: 60_000 }, async t => {
  const kernel = await loadKernel();
  const candidate = buildBoundarySurface(kernel, { ...DEFAULT_PARAMETERS_V3, family: 'spiral', topRatio: fixture.topRatio,
    concavity: fixture.concavity, stepBlend: 0, plinthEnabled: false }, { spiralCenter: 'smooth-c2' });
  try {
    const result = meshBoundarySurface(candidate), checked = validateMesh(result.mesh);
    assert.ok(candidate.poles <= 4096);
    assert.ok(candidate.physicalHeightErrorMm <= .0002);
    assert.ok(candidate.profilePositionErrorMm <= .0002);
    assert.ok(result.mesh.indices.length / 3 <= 100_000);
    const part = { id: 'checkpoint-smooth-center', mapNumber: 1, translation: [137, -46, 9], mesh: result.mesh, ...checked };
    const bytes = await serializeSTEP([part], [candidate.solid]);
    assert.match(new TextDecoder().decode(bytes), /B_SPLINE_SURFACE/);
    const restored = await importSTEP(new Blob([bytes]));
    try { validateSolid(kernel, restored); assert.ok(Math.abs(measureVolume(restored) - result.nativeVolume) / result.nativeVolume < .00001); }
    finally { restored.delete(); }
    const reader = await initReader();
    const read = reader.ReadStepFile(bytes, { linearUnit: 'millimeter', linearDeflectionType: 'absolute_value', linearDeflection: .05, angularDeflection: Math.PI / 36 });
    assert.equal(read.success, true); assert.equal(read.meshes.length, 1);
    const independent = read.meshes[0];
    // The independent mesher also emits repeated-vertex triangles on collapsed
    // polar edges. Apply the same exact-zero-area normalization, never hole repair.
    const readerMesh = removeCollapsedTriangles({ vertices: independent.attributes.position.array, triangles: independent.index.array }).mesh;
    // STEP stores CAD, not the canonical triangulation. The external reader makes
    // a different verification mesh; bound that diagnostic to 500k triangles.
    // The generated/exported part still must satisfy 100k above. All topology,
    // finite-coordinate, volume and placement checks remain identical.
    const imported = validateMesh(readerMesh, 500_000);
    t.diagnostic(`Canonical triangles: ${result.mesh.indices.length / 3}; independent STEP reader: ${readerMesh.indices.length / 3}`);
    assert.ok(Math.abs(imported.volume - result.nativeVolume) / result.nativeVolume < .001);
    for (const side of ['min', 'max']) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(imported.bounds[side][axis] - checked.bounds[side][axis] - part.translation[axis]) < .01);
    const geometry = new STLLoader().parse(serializeSTL([part]).buffer);
    try { geometry.computeBoundingBox(); assert.equal(geometry.attributes.position.count, result.mesh.indices.length);
      for (const side of ['min', 'max']) geometry.boundingBox[side].toArray().forEach((v, axis) => assert.ok(Math.abs(v - checked.bounds[side][axis] - part.translation[axis]) < .001));
    } finally { geometry.dispose(); }
  } finally { candidate.solid.delete(); }
});
