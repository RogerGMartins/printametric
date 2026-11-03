import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { makePolygon } from 'replicad';
import { OUTLINES } from '../src/tools/wall-art/model/parameters-v2.ts';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { buildFlatFootprint, radialCurveSign } from './support/shape-surface-footprint-native.mjs';
import { meshBoundarySurface } from './support/shape-surface-boundary-mesh.mjs';

test('native homothetic flat tops cover layouts and reject proven protruding sections', { timeout: 120_000 }, async t => {
  for (const outline of OUTLINES) {
    const rows = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./support/shape-surface-footprint-probe.mjs', import.meta.url), { workerData: { outline } });
      let result; const timer = setTimeout(() => { worker.terminate(); reject(Error('Native outline fixture exceeded 30 seconds.')); }, 30_000);
      worker.once('message', value => { result = value; }); worker.once('error', reject);
      worker.once('exit', code => { clearTimeout(timer); code === 0 && result ? resolve(result) : reject(Error(`Native outline worker exited ${code}.`)); });
    });
    assert.equal(new Set(rows.map(row => row.layout)).size, 5);
    assert.ok(rows.length >= 5 && rows.length <= 10);
    for (const row of rows) {
      if (row.status === 'rejected-protrusion') assert.ok(row.outsideArea > 1e-6);
      else assert.ok(row.poles <= 4096 && row.triangles <= 100_000 && row.volumeError <= .001 && row.maximumVertexAdjustmentMm <= 1e-7);
    }
    assert.equal(new Set(rows.filter(row => row.status === 'valid').map(row => row.layout)).size, 5);
    t.diagnostic(`${outline}: ${rows.filter(row => row.status === 'valid').length} valid parts; ${rows.filter(row => row.status === 'rejected-protrusion').length} proven containment rejections.`);
  }
});

test('whole native boundary rejects unsafe anchors and retains a concave star-shaped part', async () => {
  assert.equal(radialCurveSign([[2, -1], [2, 1]], [1, 1]), 1);
  assert.equal(radialCurveSign([[2, -1], [2, 1]], [1, 1], -1), -1);
  assert.throws(() => radialCurveSign([[0, -1], [0, 1]], [1, 1]), /containment/);
  assert.throws(() => radialCurveSign([[2, -1], [2, 1]], [1, -1]), /Invalid/);
  const kernel = await loadKernel();
  const star = makePolygon(Array.from({ length: 10 }, (_, i) => { const angle = i * Math.PI / 5, radius = i % 2 ? 12 : 25; return [radius * Math.cos(angle), radius * Math.sin(angle), 0]; }));
  const outside = makePolygon([[10, -20, 0], [30, -20, 0], [30, 20, 0], [10, 20, 0]]);
  let candidate;
  try {
    candidate = buildFlatFootprint(kernel, { nativeFace: star.serialize(), centroid: [0, 0] }, { ratio: .4, concavity: 2.2, baseThickness: 0, topHeight: 35 });
    assert.ok(meshBoundarySurface(candidate).volumeError <= .001);
    assert.throws(() => buildFlatFootprint(kernel, { nativeFace: outside.serialize(), centroid: [0, 0] }, { ratio: .4, concavity: 1, baseThickness: 0, topHeight: 35 }), /centroid|containment/);
  } finally { candidate?.solid.delete(); star.delete(); outside.delete(); }
});
