import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { makePolygon } from 'replicad';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { describeFace } from '../src/tools/wall-art/geometry/layouts/clip.ts';
import { classifySpan } from '../src/tools/wall-art/geometry/layouts/span.ts';
import { buildBoundarySurface } from './support/shape-surface-boundary-native.mjs';
import { identifyFootprintCandidate } from './support/shape-surface-identified-footprint.mjs';
import { identificationPolygons } from '../src/tools/wall-art/geometry/engraving.ts';
import { nativeBoolean, nativeExtrude } from '../src/tools/wall-art/geometry/native-operations.ts';
import { meshBoundarySurface } from './support/shape-surface-boundary-mesh.mjs';

for (const family of ['wave', 'dunes', 'ring', 'dome', 'ridges', 'random', 'spiral']) test(`continuous ${family} identification preserves valid bare parts and final export geometry`, { timeout: 30_000 }, async t => {
  const worker = new Worker(new URL('./support/shape-surface-identification-probe.mjs', import.meta.url), { workerData: { family } });
  try {
    const rows = await new Promise((resolve, reject) => {
      let result;
      const timer = setTimeout(() => { worker.terminate(); reject(Error('Continuous identification fixture exceeded 30 seconds.')); }, 30_000);
      worker.once('message', value => { result = value; }); worker.once('error', reject);
      worker.once('exit', code => { clearTimeout(timer); code === 0 && result ? resolve(result) : reject(Error(`Identification worker exited ${code}.`)); });
    });
    assert.deepEqual(rows.map(row => row.status), ['engraved', 'map-only']);
    for (const row of rows) assert.ok(row.triangles <= 100_000 && row.operations <= 4096 && row.volumeError <= .001);
    t.diagnostic(JSON.stringify(rows));
  } finally { await worker.terminate(); }
});

test('identification keeps its glyph placement when the shape uses an inscribed-circle anchor', { timeout: 30_000 }, async () => {
  const kernel = await loadKernel(), face = makePolygon([[0, 0, 0], [90, 0, 0], [90, 30, 0], [30, 30, 0], [30, 90, 0], [0, 90, 0]]);
  const described = describeFace(face), base = { id: 'anchor-fixture', mapNumber: 3969, centroid: described.centroid,
    area: described.area, nativeFace: face.serialize(), nativeContour: described.contour, span: classifySpan(kernel, face) };
  const saved = structuredClone(base);
  try {
    for (const plinthEnabled of [false, true]) {
      const p = { ...DEFAULT_PARAMETERS_V3, width: 150, height: 150, plinthEnabled, stepBlend: 0, depth: 0, minimumRelief: 20, topRatio: 1, concavity: 1 };
      let candidate, result;
      try {
        candidate = buildBoundarySurface(kernel, p, { footprint: base });
        assert.equal(candidate.anchorCertificate.method, 'inscribed-circle');
        result = identifyFootprintCandidate(kernel, p, base, candidate);
        assert.equal(result.identification.status, 'engraved');
        assert.equal(result.id, base.id); assert.equal(result.mapNumber, base.mapNumber);
        assert.deepEqual(base, saved); assert.deepEqual(result.translation, candidate.translation);
        const mesh = meshBoundarySurface(result);
        assert.ok(mesh.volumeError <= .001);
        // Reconstruct cuts solely from returned identification metadata. Every
        // complete prism must be absent from the final local solid; this catches
        // a centroid/shape-anchor mismatch even if both solids remain valid.
        const id = result.identification;
        for (const polygon of identificationPolygons(base.mapNumber, id.height, p.orientationMark).flat()) {
          const cutFace = makePolygon(polygon.map(([x, y]) => [x + id.anchor[0], y + id.anchor[1], 0]));
          const cutter = nativeExtrude(kernel, cutFace, p.engravingDepth);
          let common;
          try {
            common = nativeBoolean(kernel, 'common', result.solid, cutter);
            const faces = common.faces;
            try { assert.equal(faces.length, 0); } finally { faces.forEach(item => item.delete()); }
          } finally { common?.delete(); cutter.delete(); cutFace.delete(); }
        }
        const failingKernel = new Proxy(kernel, { get(target, key) { if (key === 'BRepAlgoAPI_Cut') throw Error('Injected identification cut failure'); return Reflect.get(target, key); } });
        const bytes = candidate.solid.serialize();
        assert.throws(() => identifyFootprintCandidate(failingKernel, p, base, candidate), /Injected identification cut failure/);
        assert.equal(candidate.solid.serialize(), bytes);
      } finally { result?.solid.delete(); candidate?.solid.delete(); }
    }
  } finally { face.delete(); }
});
