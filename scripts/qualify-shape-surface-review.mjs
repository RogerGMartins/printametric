/** Explicit P2 comparison matrix. Every job has its own fresh heap and fixed budgets. */
import { Worker } from 'node:worker_threads';
import { mkdir, writeFile } from 'node:fs/promises';
import { SURFACE_REVIEW_FIXTURES } from '../tests/support/shape-surface-review.mjs';
const selected = process.argv.slice(2);
if (selected.some(id => !SURFACE_REVIEW_FIXTURES.some(fixture => fixture.id === id))) throw Error('Unknown fixed review fixture.');
const directory = `artifacts/wall-art-shape-surface/review-${new Date().toISOString().replaceAll(':', '-')}`;
await mkdir(directory, { recursive: true });
const results = [];
for (const fixture of SURFACE_REVIEW_FIXTURES.filter(fixture => !selected.length || selected.includes(fixture.id))) {
  const start = performance.now(); let peak = process.memoryUsage().rss, progress = 0, failure, result;
  const worker = new Worker(new URL('../tests/support/shape-surface-review-probe.mjs', import.meta.url), { workerData: { id: fixture.id } });
  const timer = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
    if (peak > 2_000_000_000 || performance.now() - start > 120_000) { failure ??= Error('Review job exceeded its 120-second / sampled 2 GB budget.'); worker.terminate(); }
  }, 100);
  try {
    await new Promise((resolve, reject) => {
      worker.on('message', value => { if ('progress' in value) progress = value.progress; else result = value; });
      worker.once('error', reject); worker.once('exit', code => failure ? reject(failure) : code || !result ? reject(Error(`Review worker exited ${code}.`)) : resolve());
    });
    peak = Math.max(peak, process.memoryUsage().rss);
    if (peak > 2_000_000_000 || performance.now() - start > 120_000) throw Error('Review acceptance exceeded its time/memory budget.');
    if (result.parts) {
      await mkdir(`${directory}/${fixture.id}`);
      for (const [extension, bytes] of [['step', result.step], ['stl', result.stl], ['3mf', result.threeMF]]) await writeFile(`${directory}/${fixture.id}/assembly.${extension}`, bytes);
      const { step, stl, threeMF, ...preview } = result;
      await writeFile(`${directory}/${fixture.id}/preview.json`, JSON.stringify({ ...preview, parts: result.parts.map(part => ({ ...part,
        mesh: { positions: [...part.mesh.positions], indices: [...part.mesh.indices] } })) }));
    }
    const { parts, step, stl, threeMF, ...summary } = result;
    results.push({ ...summary, count: parts?.length ?? 0, sampledProcessRssBytes: peak, wallMs: performance.now() - start });
  } catch (error) { results.push({ id: fixture.id, failure: error.message, progress, sampledProcessRssBytes: peak }); process.exitCode = 1; }
  finally { clearInterval(timer); await worker.terminate(); }
  await writeFile(`${directory}/report.json`, JSON.stringify({ checkpointComplete: false, results }, null, 2));
  console.log(JSON.stringify({ directory, ...results.at(-1) }));
  if (process.exitCode) break;
}
