/** Independent readers for one explicit 100-piece R3 artifact directory. The
 * outer worker bounds native reader lifetime; this is not production import. */
import { Worker, isMainThread, workerData } from 'node:worker_threads';
import { readFile, stat, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import initReader from 'occt-import-js';
import { cast, importSTEP, measureShapeVolumeProperties } from 'replicad';
import { loadKernel } from '../tests/support/wall-art-kernel.mjs';
import { validateSolid } from '../src/shared/geometry/kernel.ts';
import { validateMesh, weldMesh } from '../src/shared/geometry/validate-mesh.ts';
import { removeCollapsedTriangles } from '../tests/support/shape-surface-boundary-mesh.mjs';

if (isMainThread) {
  const directory = process.argv[2];
  if (!directory || process.argv.length !== 3) throw Error('Supply one generated starter artifact directory.');
  const worker = new Worker(new URL(import.meta.url), { workerData: directory });
  let failure, peak = process.memoryUsage().rss; const started = performance.now();
  const timer = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
    if (peak > 2_000_000_000 || performance.now() - started > 120000) { failure ??= Error('Starter reader diagnostic exceeded memory/time budget.'); worker.terminate(); }
  }, 100);
  try { await new Promise((resolve, reject) => { worker.once('error', reject); worker.once('exit', code => failure || code ? reject(failure ?? Error(`Reader failed (${code}).`)) : resolve()); }); }
  finally { clearInterval(timer); await worker.terminate(); }
  console.log(JSON.stringify({ readerMilliseconds: performance.now() - started, sampledProcessRssBytes: peak }));
} else {
  const boundedRead = async name => { if ((await stat(`${workerData}/${name}`)).size > 256 * 1024 ** 2) throw Error('Reader input exceeds 256 MiB diagnostic limit.'); return readFile(`${workerData}/${name}`); };
  const { parts } = JSON.parse(await boundedRead('preview.json'));
  assert.equal(parts.length, 100);
  const key = bounds => `${Math.round((bounds.min[0] + bounds.max[0]) / 2)},${Math.round((bounds.min[1] + bounds.max[1]) / 2)}`;
  const expected = new Map(parts.map(part => {
    const bounds = Object.fromEntries(['min', 'max'].map(side => [side, part.bounds[side].map((x, axis) => x + part.translation[axis])]));
    return [key(bounds), { ...part, bounds }];
  }));
  assert.equal(expected.size, 100);
  function check(mesh, seen, tolerance, cap = 100000) {
    const actual = validateMesh(mesh, cap), id = key(actual.bounds), part = expected.get(id);
    assert.ok(part && !seen.has(id), `Missing/duplicate placement ${id}`); seen.add(id);
    assert.ok(Math.abs(actual.volume - part.volume) / part.volume <= .001, `Volume mismatch at ${id}`);
    for (const side of ['min', 'max']) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(actual.bounds[side][axis] - part.bounds[side][axis]) <= tolerance, `Bounds mismatch at ${id}`);
  }
  const stl = await boundedRead('starter.stl'), geometry = new STLLoader().parse(stl.buffer.slice(stl.byteOffset, stl.byteOffset + stl.byteLength));
  const groups = new Map(), positions = geometry.attributes.position.array;
  try {
    for (let i = 0; i < positions.length; i += 9) {
      const x = (positions[i] + positions[i + 3] + positions[i + 6]) / 3, y = (positions[i + 1] + positions[i + 4] + positions[i + 7]) / 3;
      const id = `${Math.floor((x + 250) / 50)},${Math.floor((y + 250) / 50)}`;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(...positions.subarray(i, i + 9));
    }
    const seen = new Set();
    for (const vertices of groups.values()) check(weldMesh(vertices, Array.from({ length: vertices.length / 3 }, (_, i) => i)), seen, .001);
    assert.equal(seen.size, 100);
  } finally { geometry.dispose(); }
  const step = await boundedRead('starter.step'), kernel = await loadKernel(), restored = await importSTEP(new Blob([step]));
  const explorer = new kernel.TopExp_Explorer(restored.wrapped, kernel.TopAbs_ShapeEnum.TopAbs_SOLID, kernel.TopAbs_ShapeEnum.TopAbs_SHAPE);
  let nativeCount = 0, volume = 0;
  try {
    for (; explorer.More(); explorer.Next()) {
      const raw = explorer.Current(), solid = cast(raw);
      try { validateSolid(kernel, solid); const properties = measureShapeVolumeProperties(solid); try { volume += properties.volume; } finally { properties.delete(); } nativeCount++; }
      finally { solid.delete(); raw.delete(); }
    }
  } finally { explorer.delete(); restored.delete(); }
  assert.equal(nativeCount, 100);
  const expectedVolume = parts.reduce((sum, part) => sum + part.volume, 0);
  assert.ok(Math.abs(volume - expectedVolume) / expectedVolume < .00001);
  const reader = await initReader(), result = reader.ReadStepFile(step, { linearUnit: 'millimeter', linearDeflectionType: 'absolute_value', linearDeflection: .05, angularDeflection: Math.PI / 36 });
  assert.equal(result.success, true); assert.equal(result.meshes.length, 100);
  const seen = new Set();
  for (const mesh of result.meshes) check(removeCollapsedTriangles({ vertices: mesh.attributes.position.array, triangles: mesh.index.array }).mesh, seen, .01, 500000);
  assert.equal(seen.size, 100);
  const evidence = { nativeSTEPParts: nativeCount, independentSTEPParts: seen.size, independentSTLParts: groups.size, nativeVolume: volume, expectedVolume, checkpointComplete: false };
  await writeFile(`${workerData}/reader-evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
