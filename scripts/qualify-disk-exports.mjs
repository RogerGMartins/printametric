// Isolated R3 OPFS/download experiment. No application storage or artifact input.
// Large byte fixture qualifies I/O only; native STEP and 3MF use small real files.
import assert from 'node:assert/strict';
import { chromium, firefox, expect } from '@playwright/test';
import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile, stat, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { monitorBrowserMemory } from './browser-memory-sampler.mjs';

const directory = resolve('artifacts/wall-art-layouts/disk-exports'), out = resolve(directory, 'fixture');
if (process.argv.includes('--build-only')) {
  const { build } = await import('vite');
  await build({ configFile: false, root: resolve('tests/fixtures/export-profile'), publicDir: false,
    worker: { format: 'es' }, build: { outDir: out, emptyOutDir: true } });
} else if (process.argv.includes('--native-only')) {
  await mkdir(directory, { recursive: true });
  for (const [fixture, identity, translation] of [['cylinder', "cylinder #2 O'Brien", [-25, 41, 3]], ['numbered', 'numbered-4000', [137, -46, 9]]]) {
    const worker = new Worker(new URL('../tests/support/native-snapshot-worker.mjs', import.meta.url), { workerData: { fixture, identity, translation, step: true } });
    try {
      const result = await new Promise((accept, reject) => {
        worker.once('error', reject); worker.once('exit', code => reject(Error(`Native fixture exited ${code}`)));
        worker.once('message', message => message.error ? reject(Error(message.error)) : accept(message));
      });
      await writeFile(resolve(out, `${fixture}-fragment.step`), result.step);
    } finally { await worker.terminate(); }
  }
} else {
  const bytes = Number(process.env.EXPORT_BYTES ?? 256 * 1024 ** 2);
  const repeat = Number(process.env.EXPORT_STEP_REPEAT ?? 1);
  const selectedEngine = process.env.EXPORT_ENGINE;
  assert.ok(Number.isSafeInteger(bytes) && bytes >= 1 && bytes <= 1024 ** 3);
  assert.ok(Number.isSafeInteger(repeat) && repeat >= 1 && repeat <= 2000);
  assert.ok(selectedEngine === undefined || ['chromium', 'firefox'].includes(selectedEngine));
  // Native fixture construction, like Vite compilation, must exit before memory
  // sampling. Otherwise allocator pages in the harness inflate the browser result.
  for (const mode of ['--build-only', '--native-only']) await new Promise((accept, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), mode], { stdio: 'inherit' });
    child.once('error', reject); child.once('exit', code => code === 0 ? accept() : reject(Error(`Fixture process exited ${code}`)));
  });
  const fragmentURLs = ['/cylinder-fragment.step', '/numbered-fragment.step'];
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(out, `.${name === '/' ? '/index.html' : name}`);
      if (!path.startsWith(out + sep) || !(await stat(path)).isFile()) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript' })[extname(path)] ?? 'application/octet-stream');
      createReadStream(path).on('error', () => response.destroy()).pipe(response);
    } catch { response.writeHead(404).end(); }
  });
  const results = [];
  let failed = false;
  try {
    await new Promise((accept, reject) => { server.once('error', reject); server.listen(6673, '127.0.0.1', accept); });
    for (const [engine, launcher] of [['chromium', chromium], ['firefox', firefox]]) {
      if (selectedEngine && selectedEngine !== engine) continue;
      // Private contexts may implement temporary storage in RAM. An isolated
      // persistent profile exercises real disk storage without touching user data.
      const profile = await mkdtemp(resolve(directory, 'profile-'));
      const context = await launcher.launchPersistentContext(profile, engine === 'chromium'
        ? { acceptDownloads: true, channel: 'chromium', headless: false, args: ['--use-angle=d3d11', '--force-low-power-gpu'] } : { acceptDownloads: true, headless: true });
      const browser = context.browser();
      context.setDefaultTimeout(120_000);
      const result = { engine, version: browser.version(), persistentProfile: true, checks: [], memoryPhases: [] };
      let phase = { phase: 'startup' };
      let memory;
      try {
        if (engine === 'chromium') memory = monitorBrowserMemory(await browser.newBrowserCDPSession(), 1024 ** 3, () => browser.close(), bytes => result.memoryPhases.push({ ...phase, bytes, controllerRSS: process.memoryUsage().rss }));
        const page = await context.newPage();
        await page.exposeFunction('exportProbeProgress', progress => { phase = { ...progress, outputBytes: progress.bytes }; });
        await page.goto('http://127.0.0.1:6673');
        await page.waitForFunction(() => typeof window.startExport === 'function');
        const exportFile = async (options, filename) => {
          phase = { phase: 'starting', filename };
          const id = await page.evaluate(options => window.startExport(options), options);
          const ready = await page.evaluate(id => window.waitExport(id), id);
          phase = { phase: 'downloading', filename, outputBytes: ready.bytes };
          const downloaded = page.waitForEvent('download');
          await page.evaluate(({ id, filename }) => window.downloadExport(id, filename), { id, filename });
          const download = await downloaded, path = resolve(directory, `${engine}-${filename}`);
          await download.saveAs(path); assert.equal(await download.failure(), null);
          phase = { phase: 'downloaded', filename, outputBytes: ready.bytes };
          assert.equal((await stat(path)).size, ready.bytes);
          return { id, ready, path };
        };
        const step = await exportFile({ kind: 'step', fragmentURLs, repeat }, 'native.step');
        let cylinder = false, numbered = false, tail = '';
        // Keep verification bounded too: large output never becomes one JS string.
        for await (const chunk of createReadStream(step.path, { encoding: 'utf8' })) {
          const text = tail + chunk; cylinder ||= text.includes('CYLINDRICAL_SURFACE'); numbered ||= text.includes('numbered-4000'); tail = text.slice(-256);
        }
        assert.ok(cylinder && numbered); assert.match(tail, /END-ISO-10303-21;/);
        result.nativeSTEP = { ...step.ready, syntheticRepeatedFragments: repeat };
        const other = await context.newPage(); await other.goto('http://127.0.0.1:6673');
        await other.waitForFunction(() => typeof window.cleanExports === 'function');
        await other.evaluate(() => window.cleanExports());
        assert.ok((await other.evaluate(() => window.exportIDs())).includes(step.id));
        await assert.rejects(other.evaluate(() => window.startExport({ kind: 'bytes', bytes: 1, maxBytes: 1 })), /reserved/);
        await page.evaluate(id => window.releaseExport(id), step.id);
        assert.deepEqual(await other.evaluate(() => window.exportIDs()), []);
        result.checks.push('native STEP disk-backed download; live cross-tab lease; explicit release');

        const parts = [0, 1].map(i => ({ id: `part-${i}`, translation: i ? [137, -46, 9] : [-25, 41, 3],
          mesh: { positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]), indices: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]) } }));
        // Playwright serializes plain arrays reliably; reconstruct typed mesh arrays in-page.
        const id3mf = await page.evaluate(parts => window.startExport({ kind: '3mf', parts: parts.map(p => ({ ...p, mesh: { positions: new Float32Array(p.mesh.positions), indices: new Uint32Array(p.mesh.indices) } })) }),
          parts.map(p => ({ ...p, mesh: { positions: [...p.mesh.positions], indices: [...p.mesh.indices] } })));
        await page.evaluate(id => window.waitExport(id), id3mf);
        const modelDownload = page.waitForEvent('download');
        await page.evaluate(id => window.downloadExport(id, 'streamed.model.3mf'), id3mf);
        const model = await modelDownload, modelPath = resolve(directory, `${engine}-streamed.model.3mf`); await model.saveAs(modelPath);
        const parsed = await page.evaluate(bytes => window.read3MF(bytes), Array.from(await readFile(modelPath)));
        assert.deepEqual(parsed, { parts: 2, min: [-25, -46, 3], max: [147, 51, 19] });
        await page.evaluate(id => window.releaseExport(id), id3mf);
        result.checks.push('streamed 3MF download and independent reader placements');

        const cancelled = await page.evaluate(() => window.startExport({ kind: 'bytes', bytes: 2 * 1024 ** 3 }));
        await page.evaluate(id => window.cancelExport(id), cancelled);
        await assert.rejects(page.evaluate(id => window.waitExport(id), cancelled), /cancelled/);
        assert.deepEqual(await page.evaluate(() => window.exportIDs()), []);
        await assert.rejects(page.evaluate(async () => {
          const id = await window.startExport({ kind: 'bytes', bytes: 1024, maxBytes: 32 }); return window.waitExport(id);
        }), /limit/);
        assert.deepEqual(await page.evaluate(() => window.exportIDs()), []);
        await page.evaluate(() => { window.originalEstimate = navigator.storage.estimate; navigator.storage.estimate = async () => ({ quota: 0, usage: 0 }); });
        await assert.rejects(page.evaluate(() => window.startExport({ kind: 'bytes', bytes: 1 })), /quota/);
        await page.evaluate(() => { navigator.storage.estimate = window.originalEstimate; });
        result.checks.push('cancellation, output bound and quota denial remove partial files');

        const abandoned = await other.evaluate(() => window.startExport({ kind: 'bytes', bytes: 1024 }));
        await other.evaluate(id => window.waitExport(id), abandoned); await other.close();
        // Closing a renderer does not synchronously revoke its Web Locks in every
        // browser. Cleanup must skip a still-held lease, then succeed after release.
        await expect.poll(() => page.evaluate(async () => { await window.cleanExports(); return window.exportIDs(); })).toEqual([]);
        result.checks.push('closed-tab orphan cleanup');
        const large = await exportFile({ kind: 'bytes', bytes }, 'disk-backed.bin');
        const hash = createHash('sha256'); for await (const chunk of createReadStream(large.path)) hash.update(chunk);
        const expected = createHash('sha256'), block = Buffer.alloc(256 * 1024, 90);
        for (let offset = 0; offset < bytes; offset += block.length) expected.update(block.subarray(0, Math.min(block.length, bytes - offset)));
        assert.equal(hash.digest('hex'), expected.digest('hex'));
        await page.evaluate(id => window.releaseExport(id), large.id); assert.deepEqual(await page.evaluate(() => window.exportIDs()), []);
        result.large = large.ready; result.checks.push('large disk-backed download byte-exact and explicitly cleaned');
      } catch (error) { failed = true; result.failure = String(error); }
      finally {
        if (memory) { result.memory = await memory.stop(); if (result.memory.failure) { failed = true; result.failure = result.memory.failure; } }
        results.push(result); await context.close();
        await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        await writeFile(resolve(directory, `qualification-persistent-${repeat}-bytes${bytes}-${selectedEngine ?? 'both'}.json`), JSON.stringify(results, null, 2));
        console.log(JSON.stringify({ ...result, memoryPhases: result.memoryPhases.length }));
      }
    }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (failed) throw Error('Disk export qualification failed; see saved evidence');
}
