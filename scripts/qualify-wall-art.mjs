// Optional offline qualification. Generated models and measurements stay in artifacts/.
import { mkdir, writeFile } from 'node:fs/promises';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import assert from 'node:assert/strict';
import { generateModel } from '../src/tools/wall-art/geometry/generate.ts';
import { DEFAULT_PARAMETERS } from '../src/tools/wall-art/model/parameters.ts';
import { loadKernel } from '../tests/support/wall-art-kernel.mjs';
import { serializeSTEP } from '../src/shared/export/step.ts';
import { serializeSTL } from '../src/shared/export/stl.ts';
import { serialize3MF } from '../src/shared/export/three-mf.ts';
const directory = 'artifacts/wall-art-core';
if (isMainThread) {
await mkdir(directory, { recursive: true });
const results = [];
for (let index = 0; index < 20; index++) {
  // Match the application lifetime: one STEP transfer per native worker heap.
  const worker = new Worker(new URL(import.meta.url), { workerData: index });
  try {
    results.push(await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); worker.once('exit', code => { if (code) reject(new Error(`Worker exited ${code}`)); }); }));
  } finally { await worker.terminate(); }
}
await writeFile(`${directory}/resource-cycles.json`, JSON.stringify({ node: process.version, platform: process.platform, lifetime: 'one STEP export per worker', results }, null, 2));
console.log(JSON.stringify({ iterations: results.length, firstWasm: results[0].wasmBytes, lastWasm: results.at(-1).afterExportWasmBytes, maxGenerationMs: Math.max(...results.map(r => r.elapsedMs)) }, null, 2));
} else {
  const index = workerData;
  const kernel = await loadKernel();
  const model = generateModel({ ...DEFAULT_PARAMETERS, reliefHeight: index % 2 ? 120 : 20 }, index + 1, kernel);
  try {
    const started = performance.now();
    const files = { step: await serializeSTEP(model.result.parts, model.solids), stl: serializeSTL(model.result.parts), 'model.3mf': serialize3MF(model.result.parts) };
    if (index === 0) for (const [extension, bytes] of Object.entries(files)) await writeFile(`${directory}/starter.${extension}`, bytes);
    const afterExportWasmBytes = kernel.wasmMemory.buffer.byteLength;
    assert.ok(afterExportWasmBytes + Object.values(files).reduce((n, bytes) => n + bytes.byteLength * 2, 0) + model.result.budget.meshBytes * 4 < 256 * 1024 * 1024);
    parentPort.postMessage({ iteration: index, ...model.result.budget, afterExportWasmBytes, allExportsMs: performance.now() - started });
  } finally { model.dispose(); }
}
