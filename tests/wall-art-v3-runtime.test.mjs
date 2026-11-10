/** Real production workers: version dispatch, bounded work and final-solid archives. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { generateLayout } from '../src/tools/wall-art/geometry/layout-coordinator.ts';
import { DEFAULT_PARAMETERS_V3, SURFACE_FAMILIES } from '../src/tools/wall-art/model/parameters-v3.ts';
import { surfaceWork, countedSurfaceKernel } from '../src/tools/wall-art/geometry/surface-work.ts';

test('work allowances stop before a native call or field batch and reset only per-part work', () => {
  let constructed = 0, built = 0;
  const work = surfaceWork(2, 100000);
  const kernel = countedSurfaceKernel({ BRepBuilderAPI_Test: class { constructor() { constructed++; } Build() { built++; } } }, work.operation);
  const object = new kernel.BRepBuilderAPI_Test(); object.Build();
  assert.throws(() => object.Build(), { code: 'GENERATION_BUDGET' });
  assert.equal(constructed, 1); assert.equal(built, 1);
  work.evaluate(65536); assert.throws(() => work.evaluate(1), { code: 'SURFACE_BUDGET' });
  work.beginPart(); work.evaluate(34464); assert.throws(() => work.evaluate(1), { code: 'SURFACE_BUDGET' });
  assert.equal(work.evaluations, 100000);
});

for (const family of SURFACE_FAMILIES) test(`production ${family} final solids survive native STEP and independent mesh readers`, { timeout: 120000 }, async t => {
  const worker=new Worker(new URL('./support/layout-export-worker.mjs',import.meta.url),{workerData:{generatorVersion:3,
    parameters:{...DEFAULT_PARAMETERS_V3,width:100,height:100,topRatio:.8,family,stepBlend:0}}});
  const stop=()=>{void worker.terminate();};t.signal.addEventListener('abort',stop,{once:true});
  try{
    const result=await new Promise((resolve,reject)=>{
      worker.once('error',reject);worker.once('exit',code=>reject(Error(`Export fixture exited ${code}`)));
      worker.once('message',message=>message.error?reject(Error(message.error)):resolve(message));
    });
    assert.equal(result.parts,4);assert.equal(result.engraved,4);assert.equal(result.curved,true);
    assert.ok(result.stepBytes>0&&result.stlBytes>0&&result.threeMFBytes>0);
  } finally {t.signal.removeEventListener('abort',stop);await worker.terminate();}
});

test('generator 3 production batches create final archives and retain the previous design on failure', { timeout: 120000 }, async () => {
  const module = await WebAssembly.compile(await readFile(new URL(import.meta.resolve('replicad-opencascadejs/wasm'))));
  const accounting = [];
  const host = { loadModule: async () => module, createPort() {
    const worker = new Worker(new URL('./support/layout-runtime-worker.mjs', import.meta.url));
    const port = { onmessage: null, onerror: null, postMessage: request => worker.postMessage(request), terminate() { void worker.terminate(); } };
    worker.on('message', data => { if (data.result) accounting.push(data.result); port.onmessage?.({ data }); });
    worker.on('error', error => port.onerror?.({ message: error.message })); return port;
  } };
  const p = { ...DEFAULT_PARAMETERS_V3, width: 100, height: 100 };
  const accepted = await generateLayout(p, 1, null, host, new AbortController().signal, 3);
  assert.equal(accepted.generatorVersion, 3); assert.equal(accepted.result.parts.length, 4);
  assert.ok(accepted.result.digest.startsWith('wa-3-3:'));
  assert.ok(accepted.parts.every(item => item.part.id.startsWith('wa-g3-') && item.snapshot.bytes.length > 0 && item.clearanceHull === null));
  assert.ok(accounting.reduce((sum, batch) => sum + batch.evaluations, 0) > 0);
  assert.ok(accounting.reduce((sum, batch) => sum + batch.operations, 0) > 0);
  const original = accepted.parts.map(item => item.snapshot.bytes.slice());
  const replaced = await generateLayout({ ...p, minimumRelief: 21 }, 2, accepted, host, new AbortController().signal, 3);
  assert.deepEqual(replaced.parts.map(item => item.part.id), accepted.parts.map(item => item.part.id));
  assert.ok(Math.abs(replaced.result.bounds.max[2] - accepted.result.bounds.max[2] - 1) < .001);
  await assert.rejects(generateLayout({ ...p, plinthEnabled: false, minimumRelief: .5, depth: .1 }, 3, accepted, host, new AbortController().signal, 3));
  assert.deepEqual(accepted.parts.map(item => item.snapshot.bytes), original);
});
