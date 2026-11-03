// Optional production-browser evidence; no application debug flags or globals.
import { chromium, firefox } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { verifySupportDialogs } from '../tests/browser/support-journey.mjs';
import { selectTheme } from '../tests/browser/theme-actions.mjs';
const url = process.env.WALL_ART_URL ?? 'http://127.0.0.1:6473';
const folder = 'artifacts/wall-art-core';
await mkdir(folder, { recursive: true });
const results = { cold: [], warm: [], exports: [], layouts: [], zoom: [], browsers: [] };
const save = () => writeFile(`${folder}/browser-qualification.json`, JSON.stringify(results, null, 2));
const ready = page => page.getByText('Model ready.', { exact: true }).waitFor({ timeout: 30_000 });
const layout = page => page.evaluate(() => {
  const r = document.querySelector('.workspace-preview').getBoundingClientRect();
  return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scrollWidth: document.documentElement.scrollWidth, preview: { x: r.x, y: r.y + scrollY, width: r.width, height: r.height } };
});
// The approved desktop timing profile uses the integrated GPU, not SwiftShader.
const browser = await chromium.launch({ channel: 'chromium', headless: false, args: ['--use-angle=d3d11', '--force-low-power-gpu'] });
try {
  for (let run = 0; run < 5; run++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      window.__cadMeasurements = [];
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        constructor(...args) { super(...args); this.addEventListener('message', ({ data }) => {
          if (data.type === 'generated') window.__cadMeasurements.push({ ...data.result.budget, revision: data.result.revision, received: performance.now() });
        }); }
      };
    });
    const page = await context.newPage(), start = performance.now();
    await page.goto(url); await ready(page);
    if (run === 0) results.renderer = await page.evaluate(() => {
      const gl = document.querySelector('canvas')?.getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'Unavailable';
    });
    results.cold.push({ run, readyMs: performance.now() - start, ...(await page.evaluate(() => window.__cadMeasurements.at(-1))) });
    if (run === 4) {
      await page.locator('.settings-drawer > summary').click();
      for (const relief of [20, 120]) for (let index = 0; index < 20; index++) {
        await page.getByLabel('Relief height (mm)').fill(String(relief));
        await page.getByLabel('Base thickness (mm)').fill(relief === 120 ? '40' : '10');
        await page.getByLabel('Top width ratio (ratio)').fill(relief === 120 ? '0.1' : '0.12');
        // Inert seed changes the revision without changing the measured geometry.
        await page.getByLabel('Seed', { exact: true }).fill(String(index + 2));
        const count = await page.evaluate(() => window.__cadMeasurements.length);
        const began = performance.now(); await page.getByLabel('Seed', { exact: true }).press('Enter');
        await page.waitForFunction(n => window.__cadMeasurements.length > n, count); await ready(page);
        results.warm.push({ relief, index, readyMs: performance.now() - began, ...(await page.evaluate(() => window.__cadMeasurements.at(-1))) });
      }
      await page.getByLabel('Panel width (mm)').fill('400');
      await page.getByLabel('Panel width (mm)').press('Enter');
      const cancel = page.getByRole('button', { name: 'Cancel generation', exact: true });
      const began = performance.now(); await cancel.click();
      results.cancelAckMs = performance.now() - began; await ready(page);
      await page.getByRole('button', { name: 'Revert to accepted design' }).click();
      for (let index = 0; index < 20; index++) {
        const count = await page.evaluate(() => window.__cadMeasurements.length);
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export STEP', exact: true }).click();
        const file = await download; assert.equal(await file.failure(), null);
        await page.waitForFunction(n => window.__cadMeasurements.length > n, count); await ready(page);
        const measurement = await page.evaluate(() => window.__cadMeasurements.at(-1));
        assert(measurement.wasmBytes < 256 * 1024 * 1024);
        results.exports.push(measurement);
      }
    }
    await context.close(); await save();
  }
} finally { await browser.close(); }
for (const [engine, launcher] of [['chromium', chromium], ['firefox', firefox]]) {
  const browser = await launcher.launch();
  try {
    results.browsers.push({ engine, version: browser.version() });
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: theme });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      for (const [width, height] of [[1280, 800], [768, 1024], [320, 800]]) {
        await page.setViewportSize({ width, height }); await page.goto(url); await ready(page); await selectTheme(page, theme);
        await page.getByRole('button', { name: 'Fit view', exact: true }).click();
        const closed = await layout(page); assert.equal(closed.scrollWidth, width);
        await page.screenshot({ path: `${folder}/${engine}-${theme}-${width}-closed.png`, fullPage: true });
        await page.locator('.settings-drawer > summary').click(); const opened = await layout(page);
        await page.getByRole('button', { name: 'Fit view', exact: true }).click();
        assert.deepEqual(opened.preview, closed.preview); assert.equal(opened.scrollWidth, width);
        await page.getByLabel('Panel width (mm)').focus();
        await page.screenshot({ path: `${folder}/${engine}-${theme}-${width}-open.png`, fullPage: true });
        await page.getByLabel('Panel width (mm)').fill(''); await page.getByLabel('Panel width (mm)').press('Enter');
        await page.locator('.settings-drawer > summary').click(); await page.getByRole('button', { name: 'Review model settings' }).click();
        assert(await page.getByLabel('Panel width (mm)').evaluate(e => e === document.activeElement));
        await page.getByRole('button', { name: 'Revert to accepted design' }).click();
        results.layouts.push({ engine, theme, closed, opened });
      }
      await verifySupportDialogs(page, url, await readFile('LICENSE', 'utf8'), theme);
      assert.deepEqual(errors, []); await context.close(); await save();
    }
  } finally { await browser.close(); }
}
// Genuine page zoom, using the retained local T6 extension (not CSS/pinch zoom).
const extension = resolve('artifacts/t6/zoom-extension');
const context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, viewport: null, args: ['--window-size=1280,900', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const page = await context.newPage(); await page.goto(url); await ready(page); const baseline = await layout(page);
  const zoom = await worker.evaluate(async () => { const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' }); await chrome.tabs.setZoom(tab.id, 2); return chrome.tabs.getZoom(tab.id); });
  await page.waitForFunction(dpr => devicePixelRatio >= dpr * 1.99, baseline.dpr);
  for (const theme of ['light', 'dark']) {
    await selectTheme(page, theme); const measured = await layout(page); assert.equal(zoom, 2); assert(Math.abs(measured.width * 2 - baseline.width) <= 2); assert.equal(measured.scrollWidth, measured.width);
    await page.locator('.settings-drawer > summary').click(); await page.getByLabel('Panel width (mm)').focus(); await page.keyboard.press('Tab');
    await page.screenshot({ path: `${folder}/zoom-200-${theme}.png` });
    await verifySupportDialogs(page, url, await readFile('LICENSE', 'utf8'), theme); await page.goto(url); await ready(page);
    results.zoom.push({ theme, zoom, baseline, measured }); await save();
  }
} finally { await context.close(); }
const p95 = values => [...values].sort((a,b) => a-b)[Math.ceil(values.length * 0.95) - 1];
console.log(JSON.stringify({ cold: results.cold.map(r => r.readyMs), warmP95: [20,120].map(relief => ({ relief, ms: p95(results.warm.filter(r => r.relief === relief).map(r => r.readyMs)) })), cancelAckMs: results.cancelAckMs, layouts: results.layouts.length, browsers: results.browsers, zoom: results.zoom }, null, 2));
