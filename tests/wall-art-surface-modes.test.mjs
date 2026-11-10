/** Area-based stepped/planar caps and blended native surfaces share mesh checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

test('all seven fields produce bounded stepped, blended, continuous and planar rectangles', { timeout: 120_000 }, async t => {
  for (const family of ['wave', 'dunes', 'ring', 'dome', 'spiral', 'ridges', 'random']) {
    const results = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./support/shape-surface-modes-probe.mjs', import.meta.url), { workerData: { family } });
      let message;
      const timer = setTimeout(() => { void worker.terminate(); reject(Error(`${family}: mode probe timed out`)); }, 30_000);
      worker.on('message', value => { message = value; });
      worker.on('error', error => { clearTimeout(timer); reject(error); });
      worker.on('exit', code => { clearTimeout(timer); code || !message ? reject(Error(`${family}: worker exited ${code}`)) : resolve(message); });
    });
    assert.deepEqual(results.map(result => result.mode), ['stepped', 'blend', 'continuous', 'plane']);
    for (const result of results) {
      assert.ok(result.triangles <= 100_000 && result.poles <= 4096, `${family}/${result.mode}`);
      assert.ok(result.volumeError <= .001);
    }
    t.diagnostic(`${family}: ${results.map(result => `${result.mode}=${result.triangles}`).join(', ')}`);
  }
});
