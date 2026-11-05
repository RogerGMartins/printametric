import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { OUTLINES } from '../src/tools/wall-art/model/parameters-v2.ts';

async function probe(workerData) {
  const worker = new Worker(new URL('./support/shape-surface-continuous-probe.mjs', import.meta.url), { workerData });
  try {
    return await new Promise((resolve, reject) => {
      let result;
      const timer = setTimeout(() => { worker.terminate(); reject(Error('Continuous native fixture exceeded 30 seconds.')); }, 30_000);
      worker.once('message', value => { result = value; }); worker.once('error', reject);
      worker.once('exit', code => { clearTimeout(timer); code === 0 && result ? resolve(result) : reject(Error(`Continuous worker exited ${code}.`)); });
    });
  } finally { await worker.terminate(); }
}

test('continuous Wave tops use real clipped contours and preserve independent field volume', { timeout: 120_000 }, async t => {
  for (const outline of OUTLINES) {
    const rows = await probe({ outline });
    assert.equal(rows.length, 5);
    for (const row of rows) assert.ok(row.poles <= 4096 && row.triangles <= 100_000 && row.volumeError <= .001 && row.fieldVolumeError < .0001);
    if (outline === 'ellipse') assert.deepEqual(rows.find(row => row.layout === 'radial').exportReaders, ['native-step', 'independent-stl']);
    t.diagnostic(`${outline}: ${rows.length} continuous native parts.`);
  }
});

test('continuous curved Spiral fits the unchanged control-net budget with certified boundaries', { timeout: 120_000 }, async t => {
  for (const ratio of [.8, .4]) {
    const [row] = await probe({ outline: 'ellipse', layout: 'radial', family: 'spiral', ratio });
    assert.ok(row.poles <= 4096 && row.triangles <= 100_000 && row.boundaryComparisons <= 65_536);
    assert.ok(row.maximumBoundaryReductionMm / ratio <= .00001);
    assert.ok(row.volumeError <= .001 && row.fieldVolumeError < .0001);
    assert.deepEqual(row.exportReaders, ['native-step', 'independent-stl']);
    t.diagnostic(`ratio ${ratio}: ${row.poles} poles, ${row.triangles} triangles, ${row.boundaryComparisons} comparisons, field-volume error ${row.fieldVolumeError}.`);
  }
});

test('unreduced continuous Spiral still rejects the excessive control net before export', { timeout: 30_000 }, async () => {
  await assert.rejects(probe({ outline: 'ellipse', layout: 'radial', family: 'spiral', boundaryReduction: false }), /4096-pole budget/);
});

test('blended curved footprint uses its actual area mean and continuous boundary', { timeout: 30_000 }, async () => {
  const rows = await probe({ outline: 'ellipse', layout: 'radial', blend: .5 });
  assert.equal(rows.length, 1); assert.equal(rows[0].blend, .5); assert.ok(rows[0].fieldVolumeError < .0001);
});
