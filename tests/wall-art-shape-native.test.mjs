/** Checkpoint capability regressions, not qualification of the v3 generator. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { importSTEP, measureShapeVolumeProperties, measureVolume } from 'replicad';
import initReader from 'occt-import-js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { buildRectangleSurface, meshRectangleSurface } from './support/shape-surface-native.mjs';
import { validateSolid } from '../src/shared/geometry/kernel.ts';
import { validateMesh, weldMesh } from '../src/shared/geometry/validate-mesh.ts';
import { serializeSTEP } from '../src/shared/export/step.ts';
import { serializeSTL } from '../src/shared/export/stl.ts';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { createSurfaceField } from '../src/tools/wall-art/geometry/surface-fields.ts';

test('native rectangular capability matches independent straight and curved profile volumes', { timeout: 30_000 }, async () => {
  const kernel = await loadKernel();
  for (const ratio of [.12, .8]) for (const concavity of [1, 2.2, 4]) {
    const width = 47.5, height = 35;
    const result = buildRectangleSurface(kernel, { width, ratio, concavity, height: () => height });
    const properties = measureShapeVolumeProperties(result.solid);
    try {
      const integral = ratio ** 2 + 2 * ratio * (1 - ratio) / (concavity + 1) + (1 - ratio) ** 2 / (2 * concavity + 1);
      const expected = width ** 2 * height * integral;
      assert.ok(Math.abs(properties.volume - expected) / expected < .00005, `${ratio}/${concavity}: independent volume`);
      assert.ok(result.maximumSampledScaleDeviationMm < .00025);
      const raw = meshRectangleSurface(result);
      const checked = validateMesh(weldMesh(raw.vertices, raw.triangles));
      assert.ok(Math.abs(checked.volume - properties.volume) / properties.volume < .001);
      for (const [actual, expectedBound] of [[checked.bounds.min, [-width / 2, -width / 2, 0]], [checked.bounds.max, [width / 2, width / 2, height]]]) {
        actual.forEach((value, axis) => assert.ok(Math.abs(value - expectedBound[axis]) < .001));
      }
    } finally { properties.delete(); result.solid.delete(); }
  }
  assert.throws(() => buildRectangleSurface(null, { width: Infinity, ratio: .8, concavity: 2, height: () => 20 }), /Invalid/);
  assert.throws(() => buildRectangleSurface(null, { width: 20, ratio: .8, concavity: 2, count: 10000, height: () => 20 }), /4–65/);
});

test('shared-boundary continuous native surface survives STEP and independent STEP/STL readers', { timeout: 60_000 }, async () => {
  const kernel = await loadKernel(), field = createSurfaceField(DEFAULT_PARAMETERS_V3);
  const candidate = buildRectangleSurface(kernel, { width: 47.5, ratio: .8, concavity: 2.2,
    height: (x, y) => 20 + 30 * field.evaluate(x + 62.5, y) });
  const properties = measureShapeVolumeProperties(candidate.solid);
  try {
    assert.ok(candidate.maximumSampledTopDeviationMm < .00025);
    const native = meshRectangleSurface(candidate);
    const mesh = weldMesh(native.vertices, native.triangles), checked = validateMesh(mesh);
    const part = { id: 'checkpoint-wave', mapNumber: 1, translation: [137, -46, 9], mesh, ...checked };
    const bytes = await serializeSTEP([part], [candidate.solid]);
    assert.match(new TextDecoder().decode(bytes), /B_SPLINE_SURFACE/);
    const restored = await importSTEP(new Blob([bytes]));
    try {
      validateSolid(kernel, restored);
      assert.ok(Math.abs(measureVolume(restored) - properties.volume) / properties.volume < .00001);
    } finally { restored.delete(); }
    const reader = await initReader();
    const read = reader.ReadStepFile(bytes, { linearUnit: 'millimeter', linearDeflectionType: 'absolute_value', linearDeflection: .005, angularDeflection: Math.PI / 36 });
    assert.equal(read.success, true); assert.equal(read.meshes.length, 1);
    const independent = read.meshes[0];
    const imported = validateMesh(weldMesh(independent.attributes.position.array, independent.index.array));
    assert.ok(Math.abs(imported.volume - properties.volume) / properties.volume < .001);
    imported.bounds.min.forEach((value, axis) => assert.ok(Math.abs(value - checked.bounds.min[axis] - part.translation[axis]) < .01));
    imported.bounds.max.forEach((value, axis) => assert.ok(Math.abs(value - checked.bounds.max[axis] - part.translation[axis]) < .01));
    const stl = serializeSTL([part]), geometry = new STLLoader().parse(stl.buffer);
    try {
      geometry.computeBoundingBox();
      assert.equal(geometry.attributes.position.count, mesh.indices.length);
      geometry.boundingBox.min.toArray().forEach((value, axis) => assert.ok(Math.abs(value - checked.bounds.min[axis] - part.translation[axis]) < .001));
      geometry.boundingBox.max.toArray().forEach((value, axis) => assert.ok(Math.abs(value - checked.bounds.max[axis] - part.translation[axis]) < .001));
    } finally { geometry.dispose(); }
  } finally { properties.delete(); candidate.solid.delete(); }
});

test('native crease and center failures reject before entering the mesher', { timeout: 30_000 }, async () => {
  const kernel = await loadKernel();
  // These exact fixture regions exposed the single-patch construction failure.
  // The Spiral was previously meshed despite its bad fit and exhausted 2 GB.
  for (const [family, ratio, origin] of [['spiral', .12, 0], ['ridges', .8, 0], ['dome', .12, 250]]) {
    const field = createSurfaceField({ ...DEFAULT_PARAMETERS_V3, family });
    const candidate = buildRectangleSurface(kernel, { width: 47.5, ratio, concavity: 1,
      height: (x, y) => 20 + 30 * field.evaluate(x + origin, y) });
    try {
      assert.ok(candidate.maximumSampledTopDeviationMm > .00025, `${family}: known approximation failure`);
      let meshCalls = 0;
      const sentinel = { ...candidate, solid: { mesh() { meshCalls++; throw Error('Mesher entered'); } } };
      assert.throws(() => meshRectangleSurface(sentinel), /sampled deviation/);
      assert.equal(meshCalls, 0);
      for (const invalid of [NaN, Infinity]) {
        assert.throws(() => meshRectangleSurface({ ...sentinel, maximumSampledTopDeviationMm: invalid }), /sampled deviation/);
      }
    } finally { candidate.solid.delete(); }
  }
});
