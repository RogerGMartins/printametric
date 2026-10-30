// Exercise the real StrictMode entry and the isolated rejected-input fixture.
import { readFileSync } from 'node:fs';
import { test, expect } from './test.js';
import { installBrowserProbe, sentinelKey, themeKey } from './browser-probe.js';
import { verifyWorkspace, verifyWorkspaceErrors } from './workspace-journey.mjs';
import { verifySupportDialogs } from './support-journey.mjs';

test('development navigation and retained settings', async ({ page, baseURL }) => {
  await verifyWorkspace(page, baseURL);
});

test('development support dialogs and license', async ({ page, baseURL }) => {
  const license = readFileSync(new URL('../../LICENSE', import.meta.url), 'utf8');
  await verifySupportDialogs(page, baseURL, license, 'dark');
});

test('collapsed rejected input retains value and recovers independently', async ({ page, baseURL }) => {
  await verifyWorkspaceErrors(page, baseURL);
});

test('StrictMode balances subscriptions and performs no duplicate history or writes', async ({ page }) => {
  await installBrowserProbe(page);
  await page.goto('/tests/fixtures/workspace-errors.html');
  await expect(page.getByRole('heading', { name: 'Design', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.foundationProbe.mediaListeners)).toBe(1);
  const initial = await page.evaluate(() => window.foundationProbe);
  expect(initial.reads).toEqual([themeKey]);
  expect(initial.writes).toEqual([]);
  expect(initial.navigationListeners).toBe(1);
  expect(initial.mediaAdds).toBeGreaterThanOrEqual(2);
  expect(initial.mediaRemoves).toBe(initial.mediaAdds - 1);
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: 'Print layout', exact: true }).click();
  await page.getByRole('link', { name: 'Print layout', exact: true }).click();
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
  await expect.poll(() => page.evaluate(() => window.foundationProbe.mediaListeners)).toBe(0);
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('system');
  await expect.poll(() => page.evaluate(() => window.foundationProbe.mediaListeners)).toBe(1);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.foundationProbe.writes)).toEqual([[themeKey, 'dark'], [themeKey, 'system']]);
  expect(await page.evaluate(key => localStorage.getItem(key), sentinelKey)).toBe('leave this design untouched');
  await page.evaluate(async () => {
    const path = '/tests/fixtures/workspace-errors.tsx';
    const fixture = await import(path);
    fixture.unmountWorkspace();
  });
  await expect(page.locator('#root')).toBeEmpty();
  const final = await page.evaluate(() => window.foundationProbe);
  expect(final.navigationListeners).toBe(0);
  expect(final.mediaListeners).toBe(0);
  expect(final.mediaAdds).toBe(final.mediaRemoves);
});
