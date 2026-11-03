// Synthetic CPU/concurrency probe. A pool here does not authorize a production pool.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { runNativeBatch, batchTransfers } from '../tests/support/layout-batch.mjs';
import { LIMITS_V2 } from '../src/tools/wall-art/model/validation-v2.ts';

if (isMainThread) {
  const count = Number(process.env.LAYOUT_PARTS ?? 512), batchSize = Number(process.env.LAYOUT_BATCH_SIZE ?? 32);
  const workers = Number(process.env.LAYOUT_WORKERS ?? 1), mode = process.env.LAYOUT_POCKET_MODE ?? 'cut';
  if (!['cut', 'profile'].includes(mode) || ![1, 2, 3].includes(workers)) throw Error('Expected cut/profile mode and 1–3 workers');
  if (!Number.isInteger(count) || count < 1 || count > 4000 || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 32) throw Error('Expected 1–4000 parts and 1–32 parts per batch');
  // Two/three 192 MiB reservations leave 128/192 MiB in their experiment budgets.
  const batchReservation = (workers === 1 ? 256 : 192) * 1024 * 1024;
  const memoryLimit = workers === 3 ? 768 * 1024 * 1024 : LIMITS_V2.memoryBytes;
  const peakLimit = workers === 3 ? 1024 * 1024 * 1024 : LIMITS_V2.workerPeakBytes;
  const started = performance.now(), processCPU = process.cpuUsage(), baselineRSS = process.memoryUsage().rss;
  const batches = [], candidate = [], active = new Set();
  let peakRSS = baselineRSS, retainedBytes = 0, failure, next = 1, module, templateMetrics;
  const sampler = setInterval(() => {
    peakRSS = Math.max(peakRSS, process.memoryUsage().rss);
    if (peakRSS > peakLimit) {
      failure ??= 'Controller plus workers RSS exceeds experiment limit';
      for (const worker of active) void worker.terminate();
    }
  }, 10);
  async function runBatch(data) {
    const remainingMs = LIMITS_V2.timeoutMs - (performance.now() - started);
    if (remainingMs <= 0) throw Error('120-second generation watchdog');
    const worker = new Worker(new URL(import.meta.url), { workerData: { ...data, module, batchReservation } });
    active.add(worker);
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('120-second generation watchdog')), remainingMs);
        worker.once('message', message => { clearTimeout(timer); message.error ? reject(Error(message.error)) : resolve(message); });
        worker.once('error', error => { clearTimeout(timer); reject(error); });
        worker.once('exit', code => { clearTimeout(timer); reject(Error(`Batch exited without a result (${code})`)); });
      });
    } finally { await worker.terminate(); active.delete(worker); }
  }
  try {
    module = await WebAssembly.compile(await readFile(new URL(import.meta.resolve('replicad-opencascadejs/wasm'))));
    const prepared = await runBatch({ templatesOnly: true });
    const { templates, ...metrics } = prepared; templateMetrics = metrics;
    retainedBytes = templates.reduce((sum, snapshot) => sum + snapshot.bytes.byteLength, 0);
    async function lane() {
      try {
        while (!failure && next <= count) {
          const start = next; next += batchSize;
          if (workers * batchReservation + retainedBytes * 2 > memoryLimit) throw Error('Pool reservations plus accepted/candidate estimate exceed experiment limit');
          const batch = await runBatch({ start, count: Math.min(batchSize, count - start + 1), mode, templates });
          retainedBytes += batch.snapshotBytes + batch.meshBytes;
          candidate.push(...batch.parts);
          const { parts, ...metadata } = batch;
          batches.push({ start, parts: parts.length, ...metadata, retainedBytes });
          if (workers * batchReservation + retainedBytes * 2 > memoryLimit) throw Error('Retained snapshots exceed aggregate reservation');
        }
      } catch (error) {
        failure ??= String(error);
        await Promise.all([...active].map(worker => worker.terminate()));
      }
    }
    await Promise.all(Array.from({ length: workers }, lane));
  } catch (error) { failure ??= String(error); }
  finally { clearInterval(sampler); await Promise.all([...active].map(worker => worker.terminate())); }
  const elapsedMs = performance.now() - started, cpu = process.cpuUsage(processCPU);
  const targetMs = count <= 512 ? 30_000 : 120_000;
  if (!failure && elapsedMs > targetMs) failure = `Single-run timing exceeds ${targetMs / 1000}-second target; p95 qualification has not started`;
  const digest = createHash('sha256');
  for (const part of candidate.sort((a, b) => a.mapNumber - b.mapNumber)) {
    digest.update(JSON.stringify([part.id, part.translation, part.volume, part.bounds]));
    digest.update(new Uint8Array(part.mesh.positions.buffer)); digest.update(new Uint8Array(part.mesh.indices.buffer));
  }
  const report = { passed: !failure && candidate.length === count, ...(failure ? { failure } : {}), synthetic: true, mode, workers, count,
    completed: candidate.length, batchSize, memoryLimit, peakLimit, elapsedMs, processCpuMs: (cpu.user + cpu.system) / 1000,
    geometryDigest: digest.digest('hex'), templateMetrics, retainedBytes, baselineRSS, peakRSS, node: process.version, platform: process.platform,
    memoryMethod: '10 ms whole-process RSS sampling; accepted/candidate overlap estimated, not yet measured', batches: batches.sort((a, b) => a.start - b.start) };
  await mkdir('artifacts/wall-art-layouts', { recursive: true });
  await writeFile(`artifacts/wall-art-layouts/batches-${count}-${batchSize}-${mode}-w${workers}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, batches: batches.length }, null, 2));
  if (!report.passed) process.exitCode = 1;
} else {
  const cpuClock = () => { const cpu = process.threadCpuUsage(); return (cpu.user + cpu.system) / 1000; };
  try { const batch = await runNativeBatch(workerData, cpuClock); parentPort.postMessage(batch, batchTransfers(batch)); }
  catch (error) { parentPort.postMessage({ error: String(error) }); }
}
