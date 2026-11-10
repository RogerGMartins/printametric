import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { qualifyFootprintAssembly } from './support/shape-surface-assembly.mjs';

test('native continuous assemblies preserve clearance, identification, exports and a retained result', { timeout: 120_000 }, async t => {
  const worker = new Worker(new URL('./support/shape-surface-assembly-probe.mjs', import.meta.url));
  try {
    const rows = await new Promise((resolve, reject) => {
      let result;
      const timer = setTimeout(() => { worker.terminate(); reject(Error('Native assembly fixture exceeded 120 seconds.')); }, 120_000);
      worker.once('message', value => { result = value; }); worker.once('error', reject);
      worker.once('exit', code => { clearTimeout(timer); code === 0 && result ? resolve(result) : reject(Error(`Assembly worker exited ${code}.`)); });
    });
    assert.deepEqual(rows.map(row => row.status), ['engraved', 'map-only']);
    for (const row of rows) { assert.equal(row.parts, 7); assert.ok(row.triangles <= 2_000_000 && row.nativePairs > 0 && row.minimumCheckedDistance >= .81); }
    t.diagnostic(JSON.stringify(rows));
  } finally { await worker.terminate(); }
});

test('assembly rejects invalid identity and placement before native or mesh work', () => {
  const part = { id: 'part', mapNumber: 1, translation: [0, 0, 0], identification: { status: 'unengraved' },
    get solid() { throw Error('Unexpected native work'); } };
  assert.throws(() => qualifyFootprintAssembly(null, []), /1–32/);
  assert.throws(() => qualifyFootprintAssembly(null, Array(33).fill(part)), /1–32/);
  assert.throws(() => qualifyFootprintAssembly(null, [part, part]), /identity/);
  for (const translation of [[NaN, 0, 0], [4001, 0, 0], [0, 0, 1], [0, 0]]) {
    const invalid = Object.create(part); invalid.translation = translation;
    assert.throws(() => qualifyFootprintAssembly(null, [invalid]), /placement/);
  }
});
