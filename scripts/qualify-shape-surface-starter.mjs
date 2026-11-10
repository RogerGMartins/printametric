/** Explicit R3 100-piece native starter investigation. Fresh native heaps every
 * 20 parts, one overall watchdog, aggregate mesh/memory limits, no UI dispatch. */
import { Worker } from 'node:worker_threads';
import { mkdir, writeFile, open } from 'node:fs/promises';
import { assembleSTEP } from '../src/shared/export/step-fragments.ts';
import { streamSTL } from '../src/shared/export/stream-stl.ts';
import { stream3MF } from '../src/shared/export/stream-three-mf.ts';

const concavity = Number(process.argv[2] ?? 2.2);
if (process.argv.length > 3 || ![1, 2.2, 4].includes(concavity)) throw Error('Use side profile 1, 2.2 or 4.');
const path = `artifacts/wall-art-shape-surface/starter-${concavity}-${new Date().toISOString().replaceAll(':', '-')}`;
await mkdir(path, { recursive: true });
const started = performance.now(), parts = [], fragments = [], summaries = [];
let active, failure, parameters, operations = 0, peakRss = process.memoryUsage().rss, progress = 0;
const abort = message => { failure ??= new Error(message); active?.terminate(); };
const timer = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  if (peakRss > 2_000_000_000) abort('Starter exceeded the sampled 2 GB memory budget.');
  if (performance.now() - started > 120_000) abort('Starter exceeded its 120-second diagnostic watchdog.');
}, 100);
try {
  for (let start = 0; start < 100; start += 20) {
    const worker = active = new Worker(new URL('../tests/support/shape-surface-starter-batch.mjs', import.meta.url), { workerData: { start, concavity } });
    let result;
    await new Promise((resolve, reject) => {
      worker.on('message', message => { if ('progress' in message) progress = message.progress; else result = message; });
      worker.once('error', reject);
      worker.once('exit', code => failure ? reject(failure) : code || !result ? reject(Error(`Starter worker failed (${code}).`)) : resolve());
    });
    active = undefined;
    parts.push(...result.parts); summaries.push(...result.summaries); fragments.push(result.step);
    operations += result.operations; parameters = result.parameters;
    if (operations > 200_000 || parts.reduce((sum, p) => sum + p.mesh.indices.length / 3, 0) > 2_000_000) throw Error('Starter aggregate geometry budget exceeded.');
  }
  for (const [name, writer] of [['starter.step', sink => assembleSTEP(fragments, sink)], ['starter.stl', sink => streamSTL(parts, sink)], ['starter.3mf', sink => stream3MF(parts, sink)]]) {
    const file = await open(`${path}/${name}`, 'w');
    try { await writer({ write: async bytes => {
      for (let offset = 0; offset < bytes.length;) {
        if (failure) throw failure;
        const { bytesWritten } = await file.write(bytes, offset, bytes.length - offset);
        if (!bytesWritten) throw Error('Starter output write made no progress.');
        offset += bytesWritten;
      }
    } }); } finally { await file.close(); }
    if (failure) throw failure;
  }
  await writeFile(`${path}/preview.json`, JSON.stringify({ parameters, parts: parts.map(part => ({ ...part,
    mesh: { positions: [...part.mesh.positions], indices: [...part.mesh.indices] } })) }));
} catch (error) { failure = error; }
finally { clearInterval(timer); await active?.terminate(); }
peakRss = Math.max(peakRss, process.memoryUsage().rss);
if (peakRss > 2_000_000_000 || performance.now() - started > 120_000) failure ??= Error('Starter final memory/time sample exceeded its budget.');
const report = { complete: !failure, checkpointComplete: false, parameters, progress, operations, sampledProcessRssBytes: peakRss,
  elapsedMs: performance.now() - started, parts: summaries, failure: failure?.message };
await writeFile(`${path}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ path, ...report }));
if (failure) process.exitCode = 1;
