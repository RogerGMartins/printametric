// Real worker, renderer and user-action exports, against both served build and StrictMode.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { serializeDesign } from '../../src/tools/wall-art/model/design-file.ts';
import { DEFAULT_PARAMETERS } from '../../src/tools/wall-art/model/parameters.ts';

test('core controls, retained revisions, JSON recovery, camera and all assembled exports', async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [], downloads: string[] = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('download', d => downloads.push(d.suggestedFilename()));
  await page.goto('/'); await expect(page.getByText('Model ready.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('canvas')).toHaveCount(1);
  for (const name of ['Front view', 'Rotate left', 'Rotate right', 'Zoom in', 'Zoom out', 'Isometric view', 'Fit view']) await page.getByRole('button', { name, exact: true }).click();
  await page.locator('.settings-drawer > summary').click();
  await expect(page.locator('dd')).toHaveText(['497.5 × 497.5 × 30 mm', '100', 'Not available']);
  const width = page.getByLabel('Panel width (mm)'); await width.fill(''); await width.press('Enter');
  await expect(width).toHaveAttribute('aria-invalid', 'true'); await expect(page.getByRole('button', { name: 'Export STL', exact: true })).toBeDisabled();
  await page.locator('.settings-drawer > summary').click(); await page.getByRole('button', { name: 'Review model settings' }).click();
  await expect(width).toBeFocused(); await width.fill('250'); await width.press('Enter');
  await expect(page.locator('dd').nth(1)).toHaveText('50');
  await page.getByRole('link', { name: 'Assembly', exact: true }).click(); await expect(page.getByText('No assembly guidance yet', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Design', exact: true }).click(); await expect(width).toHaveValue('250');
  await page.getByLabel('Load design JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"formatVersion":2}') });
  await expect(page.locator('#wall-art-error')).toBeVisible(); await expect(width).toHaveValue('250');
  await expect(page.locator('dd').nth(1)).toHaveText('50');
  await page.getByRole('button', { name: 'Revert to accepted design' }).click();
  const bytes = serializeDesign({ ...DEFAULT_PARAMETERS, width: 80, height: 80, pitch: 200, reliefHeight: 0 });
  await page.getByLabel('Load design JSON').setInputFiles({ name: 'one-part.json', mimeType: 'application/json', buffer: Buffer.from(bytes) });
  await expect(width).toHaveValue('80'); await expect(page.locator('dd').nth(1)).toHaveText('1');
  await expect(page.getByLabel('Top width ratio (ratio)')).toBeDisabled();
  expect(downloads).toEqual([]);
  for (const format of ['STEP', 'STL', '3MF', 'JSON']) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: format === 'JSON' ? 'Save design JSON' : `Export ${format}`, exact: true }).click();
    const downloaded = await pending, path = await downloaded.path(); if (!path) throw new Error('Missing download');
    const contents = await readFile(path); expect(contents.length).toBeGreaterThan(80);
    if (format === 'STEP') expect(contents.toString()).toContain('MANIFOLD_SOLID_BREP');
    if (format === 'STL') expect(contents.length).toBe(84 + contents.readUInt32LE(80) * 50);
    if (format === 'JSON') expect(JSON.parse(contents.toString()).parameters.width).toBe(80);
    if (format === '3MF') {
      // Independent reader runs in a browser (DOMParser), isolated from the application.
      const reader = await context.newPage(); await reader.goto('http://127.0.0.1:5273');
      const result = await reader.evaluate(async data => {
        const modulePath = '/node_modules/three/examples/jsm/loaders/3MFLoader.js';
        const { ThreeMFLoader } = await import(/* @vite-ignore */ modulePath);
        const object = new ThreeMFLoader().parse(new Uint8Array(data).buffer);
        const meshes: number[][] = [];
        object.traverse((child: { isMesh?: boolean; geometry: { computeBoundingBox(): void; boundingBox: { min: { toArray(): number[] }; max: { toArray(): number[] } } } }) => {
          if (child.isMesh) { child.geometry.computeBoundingBox(); meshes.push([...child.geometry.boundingBox.min.toArray(), ...child.geometry.boundingBox.max.toArray()]); }
        });
        return meshes;
      }, [...contents]);
      expect(result).toEqual([[-38.75, -38.75, 0, 38.75, 38.75, 10]]); await reader.close();
    }
  }
  expect(downloads).toHaveLength(4); expect(errors).toEqual([]);
  await testInfo.attach('core-checks', { body: 'Actual worker: generation, JSON, camera, three selected formats and independent browser 3MF reader passed.', contentType: 'text/plain' });
});

test('failed kernel retains controls and allows explicit ungenerated save; Retry recovers', async ({ page }) => {
  await page.route('**/*.wasm*', route => route.abort());
  await page.goto('/'); await expect(page.getByText('CAD unavailable.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.locator('.settings-drawer > summary').click();
  await expect(page.getByRole('button', { name: 'Export STEP' })).toBeDisabled();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save ungenerated parameters' }).click();
  expect((await pending).suggestedFilename()).toBe('wall-art-ungenerated.json');
  await page.unroute('**/*.wasm*'); await page.getByRole('button', { name: 'Retry generation', exact: true }).click();
  await expect(page.getByText('Model ready.', { exact: true })).toBeVisible({ timeout: 30_000 });
});

test('CAD and exports remain usable without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('/'); await expect(page.getByText('Model ready.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: '3D preview unavailable' })).toBeVisible();
  await page.locator('.settings-drawer > summary').click(); await expect(page.getByRole('button', { name: 'Export STL' })).toBeEnabled();
});

test('independent 3MF reader preserves all 100 assembly placements at millimeter scale', async ({ page, context }) => {
  await page.goto('/'); await expect(page.getByText('Model ready.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.locator('.settings-drawer > summary').click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export 3MF', exact: true }).click();
  const path = await (await pending).path(); if (!path) throw new Error('Missing 3MF download');
  const reader = await context.newPage();
  try {
    await reader.goto('http://127.0.0.1:5273');
    const assembly = await reader.evaluate(async bytes => {
      const loaderPath = '/node_modules/three/examples/jsm/loaders/3MFLoader.js';
      const threePath = '/node_modules/three/build/three.module.js';
      const { ThreeMFLoader } = await import(/* @vite-ignore */ loaderPath);
      const { Box3 } = await import(/* @vite-ignore */ threePath);
      const object = new ThreeMFLoader().parse(new Uint8Array(bytes).buffer);
      const bounds = new Box3().setFromObject(object); let count = 0;
      object.traverse((child: { isMesh?: boolean }) => { if (child.isMesh) count++; });
      return { count, min: bounds.min.toArray(), max: bounds.max.toArray() };
    }, [...await readFile(path)]);
    expect(assembly).toEqual({ count: 100, min: [-248.75, -248.75, 0], max: [248.75, 248.75, 30] });
  } finally { await reader.close(); }
});

test('the rendered model stays visible above the open settings drawer', async ({ page }) => {
  await page.goto('/'); await expect(page.getByText('Model ready.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await page.locator('.settings-drawer > summary').click();
  const stage = await page.locator('.model-canvas').boundingBox();
  const drawer = await page.locator('.settings-drawer').boundingBox();
  if (!stage || !drawer) throw new Error('Missing preview bounds');
  // Inspect the composited image, not merely canvas existence or its hidden buffer.
  const image = await page.screenshot({ clip: { ...stage, height: drawer.y - stage.y } });
  const neutralPixels = await page.evaluate(async encoded => {
    const blob = await (await fetch(`data:image/png;base64,${encoded}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]!, g = pixels[i + 1]!, b = pixels[i + 2]!;
      if (r > 80 && r < 230 && Math.abs(g - r) < 22 && Math.abs(b - r) < 22) count++;
    }
    return count;
  }, image.toString('base64'));
  expect(neutralPixels).toBeGreaterThan(1_000);
});
