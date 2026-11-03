// Isolate native memory growth without changing application kernel or retention rules.
// Each case has its own worker/heap. These synthetic solids do not qualify phase 02.
import { mkdir, writeFile } from 'node:fs/promises';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { makeBox, cast } from 'replicad';
import { loadKernel } from '../tests/support/wall-art-kernel.mjs';

if (isMainThread) {
  const results = [];
  for (const mode of ['plain-mesh', 'recess-mesh', 'recess-extract', 'recess-validate', 'fresh-recess-mesh', 'fresh-recess-validate']) {
    const worker = new Worker(new URL(import.meta.url), { workerData: mode });
    const result = await new Promise(resolve => {
      const timer = setTimeout(() => resolve({ mode, failure: '120-second diagnostic timeout' }), 120_000);
      worker.once('message', result => { clearTimeout(timer); resolve(result); });
      worker.once('error', error => { clearTimeout(timer); resolve({ mode, failure: String(error) }); });
    });
    await worker.terminate(); results.push(result); console.log(JSON.stringify(result));
  }
  await mkdir('artifacts/wall-art-layouts', { recursive: true });
  await writeFile('artifacts/wall-art-layouts/isolated-memory.json', JSON.stringify({ node: process.version, platform: process.platform, results }, null, 2));
} else {
  const kernel = await loadKernel();
  const base = makeBox([-25, -25, 0], [25, 25, 10]);
  const tool = makeBox([-10, -10, -1], [10, 10, 1]);
  const shape = workerData === 'plain-mesh' ? base.clone() : base.cut(tool);
  const growth = [], started = performance.now();
  let previous = kernel.wasmMemory.buffer.byteLength, completed = 0;
  try {
    for (let i = 0; i < 512; i++) {
      let fresh;
      if (workerData.startsWith('fresh-')) {
        const operation = new kernel.BRepAlgoAPI_Cut(base.wrapped, tool.wrapped);
        try { const raw = operation.Shape(); try { fresh = cast(raw); } finally { raw.delete(); } }
        finally { operation.delete(); }
      }
      const current = fresh ?? shape;
      try {
      if (workerData.endsWith('validate')) {
        const analyzer = new kernel.BRepCheck_Analyzer(current.wrapped);
        try { if (!analyzer.IsValid()) throw Error('Invalid diagnostic solid'); } finally { analyzer.delete(); }
      } else if (workerData.endsWith('extract')) {
        const raw = kernel.ReplicadMeshExtractor.extract(current.wrapped, 0.05, 5 * Math.PI / 180, true);
        raw.delete();
      } else kernel.ReplicadMeshExtractor.mesh(current.wrapped, 0.05, 5 * Math.PI / 180);
      } finally { fresh?.delete(); }
      completed++;
      const capacity = kernel.wasmMemory.buffer.byteLength;
      if (capacity !== previous) { growth.push({ iteration: completed, capacity }); previous = capacity; }
      if (capacity > 512 * 1024 * 1024) break;
    }
    parentPort.postMessage({ mode: workerData, completed, wasmBytes: previous, elapsedMs: performance.now() - started, growth });
  } finally { shape.delete(); base.delete(); tool.delete(); }
}
