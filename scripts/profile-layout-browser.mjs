// Build in a separate process so compiler memory is released before measurement.
import { chromium } from '@playwright/test';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { monitorBrowserMemory } from './browser-memory-sampler.mjs';

const out = resolve('artifacts/wall-art-layouts/browser-probe');
if (process.argv.includes('--build-only')) {
  const { build } = await import('vite');
  await build({ configFile: false, root: resolve('tests/fixtures/layout-profile'), publicDir: false,
    worker: { format: 'es' }, build: { outDir: out, emptyOutDir: true } });
} else {
  const count = Number(process.env.LAYOUT_PARTS ?? 512);
  const overlap = process.env.LAYOUT_OVERLAP === '1';
  const sequence = process.env.LAYOUT_SEQUENCE ? process.env.LAYOUT_SEQUENCE.split(',').map(Number)
    : process.env.LAYOUT_WORKERS === undefined ? [1, 2, 2, 1] : [Number(process.env.LAYOUT_WORKERS)];
  if (!Number.isInteger(count) || count < 1 || count > 4000 || sequence.length > 4 || sequence.some(value => ![1, 2, 3, 4].includes(value))) throw Error('Invalid profile limits');
  // Final user-approved experiment: four heaps, 1 GiB estimated allocation and
  // a literal 1.2 GB sampled cap. Earlier experiment limits stay reproducible.
  const memoryMiB = sequence.includes(4) ? 1024 : sequence.includes(3) ? 768 : 512;
  const sampledLimit = sequence.includes(4) ? 1_200_000_000 : (memoryMiB === 768 ? 1024 : 768) * 1024 * 1024;
  await new Promise((accept, reject) => {
    const build = spawn(process.execPath, [fileURLToPath(import.meta.url), '--build-only'], { stdio: 'inherit' });
    build.once('error', reject); build.once('exit', code => code === 0 ? accept() : reject(Error(`Fixture build exited ${code}`)));
  });
  // Minimal same-origin static server: no dev transform/cache retained in profiling.
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(out, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(out + sep) || !(await stat(path)).isFile()) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html' })[extname(path)] ?? 'application/octet-stream');
      createReadStream(path).on('error', () => response.destroy()).pipe(response);
    } catch { response.writeHead(404).end(); }
  });
  let browser;
  const results = [];
  try {
    await new Promise((accept, reject) => { server.once('error', reject); server.listen(6573, '127.0.0.1', accept); });
    browser = await chromium.launch({ channel: 'chromium', headless: false, args: ['--use-angle=d3d11', '--force-low-power-gpu'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let lastProgress;
    await page.exposeFunction('layoutProbeProgress', progress => { lastProgress = progress; });
    await page.goto('http://127.0.0.1:6573');
    await page.waitForFunction(() => typeof window.profileLayouts === 'function');
    const environment = await page.evaluate(() => ({ userAgent: navigator.userAgent, logicalCpus: navigator.hardwareConcurrency }));
    const cdp = await browser.newBrowserCDPSession();
    for (const workers of sequence) {
      lastProgress = undefined;
      const memory = monitorBrowserMemory(cdp, sampledLimit, () => browser.close());
      let result;
      try { result = await page.evaluate(options => window.profileLayouts(options), { workers, count, memoryMiB, retainAccepted: overlap }); }
      catch (error) { result = { workers, count, completed: null, lastProgress, failure: String(error), batches: [] }; }
      result.sampledMemory = await memory.stop();
      if (result.sampledMemory.failure) result.failure = result.sampledMemory.failure;
      results.push(result);
      await mkdir('artifacts/wall-art-layouts', { recursive: true });
      await writeFile(`artifacts/wall-art-layouts/browser-parallelism-${count}-${sequence.join('-')}-isolated${overlap ? '-overlap' : ''}.json`, JSON.stringify({ environment, results }, null, 2));
      console.log(JSON.stringify({ ...result, batches: result.batches.length }));
      if (result.failure || !browser.isConnected()) break;
    }
    const complete = results.filter(result => result.completed === count && !result.failure);
    if (complete.length !== sequence.length || new Set(complete.map(result => result.geometryDigest)).size !== 1) throw Error('Incomplete run or concurrency changed geometry');
    if (overlap && results.some((result, index) => result.previewBytes <= 0 || (index > 0 &&
      (result.acceptedParts !== count || result.acceptedBytes <= result.previewBytes || result.previousDigest !== results[index - 1].geometryDigest)))) {
      throw Error('Accepted design or independent preview buffers were not retained');
    }
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(accept => server.close(accept)); }
}
