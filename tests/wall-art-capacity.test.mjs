import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { restoreNative, SNAPSHOT_KERNEL } from './support/native-snapshot.mjs';
import { assembleSTEP } from './support/step-fragments.mjs';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { importSTEP, measureShapeVolumeProperties } from 'replicad';
import initReader from 'occt-import-js';
import { validateSolid } from '../src/shared/geometry/kernel.ts';

async function run(workerData, file = './support/native-snapshot-worker.mjs') {
  const worker = new Worker(new URL(file, import.meta.url), { workerData });
  try {
    return await new Promise((resolve, reject) => {
      // Correctness fixture, not a timing qualification. Use the phase-02 watchdog
      // so loaded CI hosts can complete the multi-solid native comparison.
      const timer = setTimeout(() => reject(Error('Snapshot fixture timeout')), 120_000);
      worker.once('message', message => { clearTimeout(timer); message.error ? reject(Error(message.error)) : resolve(message); });
      worker.once('error', error => { clearTimeout(timer); reject(error); });
      worker.once('exit', code => { clearTimeout(timer); reject(Error(`Fixture worker exited without a result (${code})`)); });
    });
  } finally { await worker.terminate(); }
}

test('native snapshots restore analytic curved, nonconvex and engraved solids in fresh workers', async () => {
  for (const fixture of ['cylinder', 'ellipse', 'arch', 'radial', 'numbered']) {
    const identity = `snapshot-fixture:${fixture}`, source = await run({ fixture, identity });
    const restored = await run({ snapshot: source.snapshot, identity });
    assert.deepEqual(restored.surfaces, source.surfaces, fixture);
    assert.ok(Math.abs(restored.volume - source.volume) <= 1e-8 * source.volume, fixture);
    for (const bound of ['min', 'max']) for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(restored.bounds[bound][axis] - source.bounds[bound][axis]) <= 0.001, fixture);
    }
    assert.ok(Math.abs(restored.meshVolume - source.meshVolume) <= 0.001 * source.volume, fixture);
    assert.deepEqual(restored.snapshot.bytes, source.snapshot.bytes, 'restoration must not detach or change retained source');
    if (fixture === 'cylinder' || fixture === 'radial') assert.ok(source.surfaces.GeomAbs_Cylinder > 0, 'native cylinder survives, not a triangle shell');
  }
});

test('perforated-profile extrusion preserves the full native pocket material region', async () => {
  const result = await run({}, './support/compare-pocket-worker.mjs');
  assert.deepEqual(result.results, [1, 6, 9, 10, 99, 100, 999, 1000, 4000]);
});

test('snapshot identity, kernel, bounds and checksum failures reject before native access', async () => {
  const source = await run({ fixture: 'cylinder', identity: 'accepted:part-1' });
  let nativeAccess = false;
  const kernel = new Proxy({}, { get() { nativeAccess = true; throw Error('Invalid snapshot reached native code'); } });
  const badBytes = source.snapshot.bytes.slice(); badBytes[20] ^= 1;
  for (const patch of [{ version: 2 }, { kernel: `${SNAPSHOT_KERNEL}-other` }, { identity: 'candidate:part-1' },
    { rawLength: 9 * 1024 * 1024 }, { rawLength: 0 }, { rawLength: NaN }, { extra: true },
    { bytes: badBytes }, { bytes: source.snapshot.bytes.slice(0, -1) }, { checksum: 'invalid' }]) {
    await assert.rejects(restoreNative(kernel, { ...source.snapshot, ...patch }, 'accepted:part-1'), /Invalid native snapshot/);
  }
  assert.equal(nativeAccess, false);
  assert.ok(source.snapshot.bytes.length > 0, 'accepted source still retained');
});

test('streamed native STEP fragments preserve restored curves, names, units and placement in independent readers', async () => {
  const sources = [];
  for (const [fixture, identity, translation] of [['cylinder', "cylinder #2 O'Brien", [-25, 41, 3]], ['numbered', 'wa-g2-test-4000', [137, -46, 9]]]) {
    const original = await run({ fixture, identity });
    sources.push(await run({ snapshot: original.snapshot, identity, translation, step: true }));
  }
  const chunks = [];
  const summary = await assembleSTEP(sources.map(source => source.step), { async write(bytes) { chunks.push(bytes); } });
  assert.equal(summary.fragments, 2);
  // This tiny fixture may collect output; the experimental assembler itself only
  // writes bounded chunks and never collects the full model file.
  const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes("cylinder #2 O''Brien")); assert.ok(text.includes('wa-g2-test-4000'));
  const kernel = await loadKernel(), result = await importSTEP(new Blob([bytes]));
  try {
    const solids = result.solids, faces = result.faces;
    try {
      assert.equal(solids.length, 2); solids.forEach(shape => validateSolid(kernel, shape));
      assert.ok(faces.some(face => ['CYLINDRE', 'CYLINDER'].includes(face.geomType)));
      const properties = measureShapeVolumeProperties(result);
      try { assert.ok(Math.abs(properties.volume - sources.reduce((sum, source) => sum + source.volume, 0)) < 0.001); }
      finally { properties.delete(); }
    } finally { solids.forEach(shape => shape.delete()); faces.forEach(face => face.delete()); }
  } finally { result.delete(); }
  const reader = await initReader();
  const imported = reader.ReadStepFile(bytes, { linearUnit: 'millimeter', linearDeflectionType: 'absolute_value', linearDeflection: 0.05, angularDeflection: Math.PI / 36 });
  assert.equal(imported.success, true); assert.equal(imported.meshes.length, 2);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of imported.meshes) for (const [index, value] of mesh.attributes.position.array.entries()) {
    min[index % 3] = Math.min(min[index % 3], value); max[index % 3] = Math.max(max[index % 3], value);
  }
  for (const [actual, expected] of [[min, [-35, -69.75, 3]], [max, [160.75, 51, 39]]]) {
    actual.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 0.01));
  }
});
