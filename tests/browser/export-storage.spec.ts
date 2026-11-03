// Experimental export lifecycle regressions; fixture is excluded from the app build.
import { test, expect } from '@playwright/test';

type ExportFixture = typeof window & {
  startExport(options: { kind: 'bytes'; bytes: number; maxBytes?: number }): Promise<string>;
  waitExport(id: string): Promise<{ bytes: number }>;
  cancelExport(id: string): void;
  releaseExport(id: string): Promise<void>;
  cleanExports(): Promise<void>;
  exportIDs(): Promise<string[]>;
};

test('cancelled and over-budget disk exports close native file locks before cleanup', async ({ page }) => {
  await page.goto('/tests/fixtures/export-profile/');
  await page.waitForFunction(() => typeof (window as ExportFixture).startExport === 'function');
  const id = await page.evaluate(() => (window as ExportFixture).startExport({ kind: 'bytes', bytes: 2 * 1024 ** 3 }));
  await page.evaluate(id => (window as ExportFixture).cancelExport(id), id);
  await expect(page.evaluate(id => (window as ExportFixture).waitExport(id), id)).rejects.toThrow('cancelled');
  expect(await page.evaluate(() => (window as ExportFixture).exportIDs())).toEqual([]);
  await expect(page.evaluate(async () => {
    const fixture = window as ExportFixture;
    const id = await fixture.startExport({ kind: 'bytes', bytes: 1024, maxBytes: 32 });
    return fixture.waitExport(id);
  })).rejects.toThrow('limit');
  expect(await page.evaluate(() => (window as ExportFixture).exportIDs())).toEqual([]);
});

test('export cleanup respects live tabs and removes abandoned output after tab closure', async ({ page, context }) => {
  await page.goto('/tests/fixtures/export-profile/');
  await page.waitForFunction(() => typeof (window as ExportFixture).startExport === 'function');
  const id = await page.evaluate(() => (window as ExportFixture).startExport({ kind: 'bytes', bytes: 1024 }));
  expect(await page.evaluate(id => (window as ExportFixture).waitExport(id), id)).toMatchObject({ bytes: 1024 });
  const other = await context.newPage();
  await other.goto('/tests/fixtures/export-profile/');
  await other.waitForFunction(() => typeof (window as ExportFixture).cleanExports === 'function');
  await other.evaluate(() => (window as ExportFixture).cleanExports());
  expect(await other.evaluate(() => (window as ExportFixture).exportIDs())).toEqual([id]);
  await expect(other.evaluate(() => (window as ExportFixture).startExport({ kind: 'bytes', bytes: 1, maxBytes: 1 }))).rejects.toThrow('reserved');
  await page.close();
  await expect.poll(() => other.evaluate(async () => {
    const fixture = window as ExportFixture;
    await fixture.cleanExports(); return fixture.exportIDs();
  })).toEqual([]);
});
