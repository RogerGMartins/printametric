/** Independent readers, one isolated heap per generated review assembly. */
import { Worker, isMainThread, workerData } from 'node:worker_threads';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import initReader from 'occt-import-js';
import { cast, importSTEP } from 'replicad';
import { loadKernel } from '../tests/support/wall-art-kernel.mjs';
import { validateSolid } from '../src/shared/geometry/kernel.ts';
import { validateMesh, weldMesh } from '../src/shared/geometry/validate-mesh.ts';
import { measureBoundaryVolume, removeCollapsedTriangles } from '../tests/support/shape-surface-boundary-mesh.mjs';

if (isMainThread) {
  const directory = process.argv[2];
  const slicer = process.argv[3] === '--slicer';
  if (!directory || process.argv.length !== (slicer ? 4 : 3)) throw Error('Supply one generated review directory and optional --slicer.');
  const report = JSON.parse(await readFile(`${directory}/report.json`, 'utf8')), results = [];
  for (const fixture of [...report.results, ...(slicer ? report.starters ?? [] : [])].filter(row => row.count)) {
    const worker = new Worker(new URL(import.meta.url), { workerData: { directory: `${directory}/${fixture.id}`, slicer } });
    const started = performance.now(); let failure, result, peak = process.memoryUsage().rss;
    const timer = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().rss);
      if (peak > 2_000_000_000 || performance.now() - started > 120000) { failure ??= Error('Review reader memory/time budget exceeded.'); worker.terminate(); }
    }, 100);
    try {
      worker.once('message', value => { result = value; });
      await new Promise((resolve, reject) => { worker.once('error', reject); worker.once('exit', code => failure || code || !result ? reject(failure ?? Error(`Reader exited ${code}.`)) : resolve()); });
      results.push({ id: fixture.id, ...result, elapsedMs: performance.now() - started, sampledProcessRssBytes: peak });
      console.log(JSON.stringify(results.at(-1)));
      await writeFile(`${directory}/${slicer ? 'slicer-readers' : 'readers'}.json`, JSON.stringify(results, null, 2));
    } finally { clearInterval(timer); await worker.terminate(); }
  }
} else {
  const { parentPort } = await import('node:worker_threads');
  const boundedRead = async name => { if ((await stat(`${workerData.directory}/${name}`)).size > 256 * 1024 ** 2) throw Error('Reader input exceeds 256 MiB.'); return readFile(`${workerData.directory}/${name}`); };
  const expected = JSON.parse(await boundedRead('preview.json'));
  const match = (mesh, seen, tolerance, independent) => {
    const checked = validateMesh(mesh, independent ? 500000 : 100000);
    const index = expected.parts.findIndex(part => ['min', 'max'].every(side => checked.bounds[side].every((value, axis) => Math.abs(value - part.bounds[side][axis] - part.translation[axis]) < tolerance)));
    assert.ok(index >= 0 && !seen.has(index), 'Reader lost or duplicated a part placement'); seen.add(index);
    const source = expected.parts[index].mesh;
    const volume = independent ? expected.meshes[index].nativeVolume : validateMesh({ positions: new Float32Array(source.positions), indices: new Uint32Array(source.indices) }).volume;
    const error = Math.abs(checked.volume / volume - 1);
    assert.ok(error < (independent ? .001 : .00001), `Reader volume error ${error}`);
    return error;
  };
  if (workerData.slicer) {
    const files = (await readdir(workerData.directory)).filter(name => /^obj_\d+_Part-\d+\.stl$/.test(name)), seen = new Set(), errors = [];
    assert.equal(files.length, expected.parts.length);
    for (const file of files) {
      const bytes = await boundedRead(file), geometry = new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      try {
        const positions = geometry.attributes.position.array;
        errors.push(match(weldMesh(positions, Array.from({ length: positions.length / 3 }, (_, i) => i)), seen, .001, false));
      } finally { geometry.dispose(); }
    }
    assert.equal(seen.size, expected.parts.length);
    parentPort.postMessage({ slicerParts: seen.size, maximumCanonicalVolumeError: Math.max(...errors) });
  } else {
  const stl = await boundedRead('assembly.stl'), geometry = new STLLoader().parse(stl.buffer.slice(stl.byteOffset, stl.byteOffset + stl.byteLength));
  let stlCount;
  try {
    const vertices = geometry.attributes.position.array, mesh = weldMesh(vertices, Array.from({ length: vertices.length / 3 }, (_, i) => i));
    const parents = Array.from({ length: mesh.positions.length / 3 }, (_, i) => i);
    const root = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
    for (let i = 0; i < mesh.indices.length; i += 3) { const a = root(mesh.indices[i]); parents[root(mesh.indices[i + 1])] = a; parents[root(mesh.indices[i + 2])] = a; }
    const groups = new Map();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const id = root(mesh.indices[i]); if (!groups.has(id)) groups.set(id, []);
      for (let j = 0; j < 3; j++) { const k = mesh.indices[i + j] * 3; groups.get(id).push(mesh.positions[k], mesh.positions[k + 1], mesh.positions[k + 2]); }
    }
    const seen = new Set();
    for (const points of groups.values()) match(weldMesh(points, Array.from({ length: points.length / 3 }, (_, i) => i)), seen, .001, false);
    assert.equal(seen.size, expected.parts.length); stlCount = seen.size;
  } finally { geometry.dispose(); }
  const step = await boundedRead('assembly.step'), kernel = await loadKernel(), restored = await importSTEP(new Blob([step]));
  const explorer = new kernel.TopExp_Explorer(restored.wrapped, kernel.TopAbs_ShapeEnum.TopAbs_SOLID, kernel.TopAbs_ShapeEnum.TopAbs_SHAPE);
  let count = 0, volume = 0;
  try {
    for (; explorer.More(); explorer.Next()) {
      const raw = explorer.Current(), solid = cast(raw);
      try { validateSolid(kernel, solid); volume += measureBoundaryVolume(solid).nativeVolume; count++; }
      finally { solid.delete(); raw.delete(); }
    }
  } finally { explorer.delete(); restored.delete(); }
  assert.equal(count, expected.parts.length);
  assert.ok(Math.abs(volume / expected.meshes.reduce((sum, mesh) => sum + mesh.nativeVolume, 0) - 1) < .00001);
  const reader = await initReader(), result = reader.ReadStepFile(step, { linearUnit: 'millimeter', linearDeflectionType: 'absolute_value', linearDeflection: .005, angularDeflection: Math.PI / 36 });
  assert.equal(result.success, true); assert.equal(result.meshes.length, count);
  const seen = new Set(), errors = result.meshes.map(mesh => match(removeCollapsedTriangles({ vertices: mesh.attributes.position.array, triangles: mesh.index.array }).mesh, seen, .02, true));
  assert.equal(seen.size, count);
  parentPort.postMessage({ nativeSTEPParts: count, independentSTEPParts: seen.size, independentSTLParts: stlCount, maximumSTEPVolumeError: Math.max(...errors) });
  }
}
