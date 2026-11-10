/** Explicit small-assembly retained-CAD/renderer qualification, not a capacity tier. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, writeFile, mkdir } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { monitorBrowserMemory } from './browser-memory-sampler.mjs';
const out = resolve('artifacts/wall-art-shape-surface/browser-fixture');
if (process.argv.includes('--build-only')) {
  const { build } = await import('vite');
  await build({ configFile: false, root: resolve('tests/fixtures/surface-review'), publicDir: false, esbuild: { jsx: 'automatic' }, worker: { format: 'es' }, build: { outDir: out, emptyOutDir: true } });
} else {
  const directory = resolve(`artifacts/wall-art-shape-surface/browser-${new Date().toISOString().replaceAll(':', '-')}`); await mkdir(directory, { recursive: true });
  await new Promise((accept, reject) => { const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--build-only'], { stdio: 'inherit' }); child.once('error', reject); child.once('exit', code => code ? reject(Error(`Build exited ${code}`)) : accept()); });
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname), path = resolve(out, `.${name === '/' ? '/index.html' : name}`);
      if (!path.startsWith(out + sep) || !(await stat(path)).isFile()) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' })[extname(path)] ?? 'application/octet-stream');
      createReadStream(path).on('error', () => response.destroy()).pipe(response);
    } catch { response.writeHead(404).end(); }
  });
  let browser, memory; const report = { checkpointComplete: false, exports: [] };
  try {
    await new Promise((accept, reject) => { server.once('error', reject); server.listen(6873, '127.0.0.1', accept); });
    browser = await chromium.launch({ channel: 'chromium', headless: false, args: ['--use-angle=d3d11', '--force-low-power-gpu'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true }); page.setDefaultTimeout(125000);
    await page.goto('http://127.0.0.1:6873'); await page.waitForFunction(() => typeof window.generateSurface === 'function');
    memory = monitorBrowserMemory(await browser.newBrowserCDPSession(), 2_000_000_000, () => browser.close());
    report.initial = await page.evaluate(() => window.generateSurface('wave-curved-radial'));
    const digest = await page.evaluate(() => window.surfaceDigest());
    const rejected = await page.evaluate(async () => { try { await window.generateSurface('wave-bare-invalid'); return false; } catch { return true; } });
    assert.equal(rejected, true); assert.equal(await page.evaluate(() => window.surfaceDigest()), digest);
    await page.evaluate(() => { window.cancellation = window.generateSurface('spiral-continuous').catch(error => error.message); });
    await page.waitForFunction(() => window.surfaceState().progress > 0);
    const started = performance.now(); assert.equal(await page.evaluate(() => window.cancelSurface()), true);
    assert.match(await page.evaluate(() => window.cancellation), /cancelled/); report.cancelAcknowledgmentMs = performance.now() - started;
    assert.ok(report.cancelAcknowledgmentMs < 1000); assert.equal(await page.evaluate(() => window.surfaceDigest()), digest);
    report.replacement = await page.evaluate(() => window.generateSurface('spiral-continuous'));
    assert.notEqual(await page.evaluate(() => window.surfaceDigest()), digest);
    for (const format of ['step', 'stl', '3mf']) {
      const download = page.waitForEvent('download');
      const result = await page.evaluate(format => window.exportSurface(format), format);
      const file = await download; await file.saveAs(`${directory}/assembly.${format}`);
      assert.equal(await file.failure(), null); assert.equal((await stat(`${directory}/assembly.${format}`)).size, result.bytes);
      report.exports.push({ format, ...result });
    }
    await page.screenshot({ path: `${directory}/retained-preview.png` });
    report.invalidCandidatePreserved = true; report.cancelPreserved = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    if (memory) { report.memory = await memory.stop(); if (report.memory.failure) { report.failure = report.memory.failure; process.exitCode = 1; } }
    await browser?.close(); server.closeAllConnections(); await new Promise(accept => server.close(accept));
    await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ directory, ...report }));
  }
}
