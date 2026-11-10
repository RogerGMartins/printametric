/** Explicit production-editor qualification. Failed complexity attempts are retained evidence. */
import { chromium, expect as baseExpect } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { cpus, totalmem, release } from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { monitorBrowserMemory } from './browser-memory-sampler.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { serializeVersionedDesign, parseVersionedDesign } from '../src/tools/wall-art/model/design-file.ts';
import { SNAPSHOT_KERNEL } from '../src/shared/geometry/native-snapshot.ts';

const directory = resolve(`artifacts/wall-art-shape-surface/application-${new Date().toISOString().replaceAll(':', '-')}`);
const expect = baseExpect.configure({ timeout: 125000 });
await mkdir(directory, { recursive: true });
const root = resolve('dist'), extension = resolve('artifacts/t6/zoom-extension');
const server = createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname), path = resolve(root, `.${name === '/' ? '/index.html' : name}`);
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2' })[extname(path)] ?? 'application/octet-stream');
    createReadStream(path).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404).end(); }
});
const report = { environment: { cpu: cpus()[0]?.model, logicalCPUs: cpus().length, ramBytes: totalmem(), os: release(), node: process.version, kernel: SNAPSHOT_KERNEL }, stages: [], complexityAttempts: [], visuals: [] };
let context, memory, stagePeak = 0;
try {
  await stat(`${root}/index.html`);
  report.environment.buildIndexSha256 = createHash('sha256').update(await readFile(`${root}/index.html`)).digest('hex');
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(6973, '127.0.0.1', accept); });
  const zoomAvailable = await stat(`${extension}/manifest.json`).then(() => true, () => false);
  context = await chromium.launchPersistentContext(`${directory}/profile`, { channel: 'chromium', headless: false, viewport: { width: 1280, height: 900 }, acceptDownloads: true,
    args: ['--use-angle=d3d11', '--force-low-power-gpu', ...(zoomAvailable ? [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] : [])] });
  report.environment.browser = context.browser().version();
  memory = monitorBrowserMemory(await context.browser().newBrowserCDPSession(), 2_000_000_000, () => context.close(), bytes => { stagePeak = Math.max(stagePeak, bytes); });
  const page = context.pages()[0]; page.setDefaultTimeout(125000);
  const saveButton = page.getByRole('button', { name: 'Save design JSON', exact: true });
  const status = page.getByLabel('Model status');
  const save = async () => { const pending = page.waitForEvent('download'); await saveButton.click(); return readFile(await (await pending).path()); };
  const load = async parameters => {
    await page.getByLabel('Load design JSON').setInputFiles({ name: 'qualification.json', mimeType: 'application/json',
      buffer: Buffer.from(serializeVersionedDesign({ modelSchemaVersion: 3, generatorVersion: 3, parameters })) });
  };
  const stage = async (name, action) => {
    stagePeak = 0; const started = performance.now(); await action();
    report.stages.push({ name, elapsedMs: performance.now() - started, sampledPeakBytes: stagePeak || null, status: await status.innerText() });
  };
  await stage('cold starter', async () => { await page.goto('http://127.0.0.1:6973'); await page.locator('.settings-drawer > summary').click(); await expect(saveButton).toBeEnabled(); });
  assert.deepEqual(parseVersionedDesign(await save()).parameters, DEFAULT_PARAMETERS_V3);
  await stage('retained warm starter', async () => { await load(DEFAULT_PARAMETERS_V3); await expect(saveButton).toBeEnabled(); });
  const replacement = { ...DEFAULT_PARAMETERS_V3, minimumRelief: 21 };
  await stage('retained height replacement', async () => { await load(replacement); await expect(saveButton).toBeEnabled(); });
  const acceptedBytes = await save(); assert.deepEqual(parseVersionedDesign(acceptedBytes).parameters, replacement);
  for (const format of ['STEP', 'STL', '3MF']) await stage(`accepted ${format} export`, async () => {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: `Export ${format}`, exact: true }).click();
    const file = await pending; await file.saveAs(`${directory}/accepted.${format.toLowerCase()}`); assert.equal(await file.failure(), null);
    await page.getByRole('button', { name: 'Release downloaded file' }).click(); await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeEnabled();
  });
  for (const [name, parameters] of [
    ['512 curved-side pieces', { ...DEFAULT_PARAMETERS_V3, width: 1600, height: 800 }],
    ['ceiling triangular dense Spiral', { ...DEFAULT_PARAMETERS_V3, width: 2000, height: 2000, layout: 'triangular', topRatio: .99, family: 'spiral', spiralArms: 16, density: 12, stepBlend: 0 }],
    ['nonconvex dense curved Random', { ...DEFAULT_PARAMETERS_V3, width: 500, height: 500, outline: 'arch', layout: 'irregular', topRatio: 1, family: 'random', density: 12, stepBlend: 0 }],
  ]) {
    const started = performance.now(); stagePeak = 0; await load(parameters);
    await expect.poll(async () => await saveButton.isEnabled() || await page.locator('#wall-art-error').isVisible(), { timeout: 125000 }).toBe(true);
    const failed = await page.locator('#wall-art-error').isVisible();
    report.complexityAttempts.push({ name, parameters, failed, elapsedMs: performance.now() - started, sampledPeakBytes: stagePeak, status: await status.innerText() });
    if (failed) { await page.getByRole('button', { name: 'Revert to accepted design' }).click(); assert.deepEqual(await save(), acceptedBytes); }
    else { await load(replacement); await expect(saveButton).toBeEnabled(); }
  }
  await stage('cancel candidate', async () => {
    await load({ ...replacement, width: 1600, height: 800 });
    const started = performance.now(); await page.getByRole('button', { name: 'Cancel generation', exact: true }).click();
    await expect(saveButton).toBeEnabled(); report.cancelAcknowledgmentMs = performance.now() - started;
    assert.ok(report.cancelAcknowledgmentMs < 1000); assert.deepEqual(await save(), acceptedBytes);
  });
  for (const colorScheme of ['light', 'dark']) for (const width of [1280, 320]) {
    await page.emulateMedia({ colorScheme }); await page.setViewportSize({ width, height: 900 });
    await page.locator('#wall-art-family').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const name = `${colorScheme}-${width}.png`; await page.screenshot({ path: `${directory}/${name}` }); report.visuals.push(name);
  }
  await page.setViewportSize({ width: 1280, height: 900 }); await page.emulateMedia({ forcedColors: 'active' });
  await page.getByLabel('Top size range', { exact: true }).focus(); await page.screenshot({ path: `${directory}/forced-colors.png` }); report.visuals.push('forced-colors.png');
  await page.emulateMedia({ forcedColors: 'none' });
  if (zoomAvailable) {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const before = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    const zoom = await worker.evaluate(async () => { const tabs = await chrome.tabs.query({}); const tab = tabs.find(tab => tab.url?.startsWith('http://127.0.0.1:6973')); await chrome.tabs.setZoom(tab.id, 2); return chrome.tabs.getZoom(tab.id); });
    assert.equal(zoom, 2); const after = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    assert.equal(after.width, before.width / 2); assert.equal(after.dpr, before.dpr * 2); report.zoom = { zoom, before, after };
    for (const colorScheme of ['light', 'dark']) { await page.emulateMedia({ colorScheme }); await page.getByLabel('Top size (%)', { exact: true }).focus(); await page.screenshot({ path: `${directory}/zoom-${colorScheme}.png` }); report.visuals.push(`zoom-${colorScheme}.png`); }
  } else report.zoom = 'Unverified: retained zoom extension unavailable';
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (memory) { report.memory = await memory.stop(); if (report.memory.failure) { report.failure = report.memory.failure; process.exitCode = 1; } }
  await context?.close(); server.closeAllConnections(); await new Promise(accept => server.close(accept));
  await rm(`${directory}/profile`, { recursive: true, force: true });
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ directory, ...report }));
}
