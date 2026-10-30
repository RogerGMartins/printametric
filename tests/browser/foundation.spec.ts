// Production acceptance journeys; the shared gate builds dist before this suite.
import { readFileSync, readdirSync } from 'node:fs';
import { test, expect } from './test.js';
import { installBrowserProbe, sentinelKey, themeKey } from './browser-probe.js';
import { verifyWorkspace } from './workspace-journey.mjs';
import { verifySupportDialogs } from './support-journey.mjs';

const license = readFileSync(new URL('../../LICENSE', import.meta.url), 'utf8');

test('navigation, history, retained settings and reload defaults', async ({ page, baseURL }) => {
  await verifyWorkspace(page, baseURL);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1280, 320]) {
    test(`support keyboard and exact license: ${theme}, ${width}px`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height: 800 });
      await verifySupportDialogs(page, baseURL, license, theme);
    });
  }
  test(`honest empty states: ${theme}, all tips/background combinations`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Theme' }).selectOption(theme);
    for (const [view, heading] of [
      ['Design', 'No model yet'], ['Print layout', 'No print layout yet'], ['Assembly', 'No assembly guidance yet'],
    ]) {
      await page.getByRole('link', { name: view, exact: true }).click();
      for (const tips of [true, false]) {
        await page.getByRole('checkbox').setChecked(tips);
        await page.locator('summary').click();
        for (const background of ['Plain', 'Grid']) {
          await page.getByRole('radio', { name: background, exact: true }).check();
          await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
          await expect(page.locator('dd')).toHaveText(['Not available', 'Not available', 'Not available']);
          await expect(page.getByText('Model editing and presets are not available yet.', { exact: true })).toHaveCount(view === 'Design' ? 1 : 0);
          await expect(page.getByText('Plate configuration is not available yet.', { exact: true })).toHaveCount(view === 'Assembly' ? 0 : 1);
          await expect(page.getByText('Decorative grid — not to scale.', { exact: true })).toHaveCount(background === 'Grid' ? 1 : 0);
          await expect(page.locator('input[type=file], a[download], canvas, [role=progressbar]')).toHaveCount(0);
        }
        await page.locator('summary').click();
      }
    }
  });
}

for (const stored of ['', 'unknown', 'x'.repeat(16), 'x'.repeat(17), 'x'.repeat(4096)]) {
  test(`invalid stored theme is retained until explicit selection (${stored.length} chars)`, async ({ page }) => {
    await installBrowserProbe(page, stored);
    await page.goto('/');
    await expect(page.getByText(/The stored theme preference is invalid/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Theme' })).toHaveValue('system');
    expect(await page.evaluate(key => localStorage.getItem(key), themeKey)).toBe(stored);
    expect(await page.evaluate(() => window.foundationProbe.writes)).toEqual([]);
    await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
    await expect(page.getByText(/The stored theme preference is invalid/)).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), themeKey)).toBe('dark');
  });
}

test('denied storage property keeps navigation and dialogs usable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {
    get() { throw new DOMException('Test storage denial', 'SecurityError'); },
  }));
  await page.goto('/');
  await expect(page.getByText(/The theme preference could not be read/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Assembly', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assembly', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Retry theme storage' })).toBeVisible();
});

test('failed write retains memory and bytes; same-value retry recovers', async ({ page }) => {
  await installBrowserProbe(page, 'light');
  await page.goto('/');
  await page.evaluate(() => { window.foundationProbe.denyWrite = true; });
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Retry theme storage' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), themeKey)).toBe('light');
  await page.getByRole('checkbox').uncheck();
  await expect(page.getByRole('button', { name: 'Retry theme storage' })).toBeVisible();
  await page.evaluate(() => { window.foundationProbe.denyWrite = false; });
  await page.getByRole('button', { name: 'Retry theme storage' }).click();
  await expect(page.getByRole('button', { name: 'Retry theme storage' })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), themeKey)).toBe('dark');
  expect(await page.evaluate(() => window.foundationProbe.writes)).toEqual([[themeKey, 'dark'], [themeKey, 'dark']]);
});

test('System follows OS changes in dialogs; explicit theme ignores them', async ({ page }) => {
  await installBrowserProbe(page);
  await page.goto('/');
  const theme = page.getByRole('combobox', { name: 'Theme' });
  await expect(theme).toHaveValue('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Help', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.foundationProbe.writes)).toEqual([]);
  await page.keyboard.press('Escape');
  await theme.selectOption('light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await theme.selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => window.foundationProbe.writes)).toEqual([[themeKey, 'light'], [themeKey, 'system']]);
  expect(await page.evaluate(key => localStorage.getItem(key), sentinelKey)).toBe('leave this design untouched');
  await page.reload();
  await expect(theme).toHaveValue('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(key => localStorage.getItem(key), sentinelKey)).toBe('leave this design untouched');
});

test('unavailable system preference falls back to Light', async ({ page }) => {
  await page.addInitScript(() => { window.matchMedia = () => { throw new Error('Test unavailable media API'); }; });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('production output has no fixture paths and requests only bundled assets', async ({ page }) => {
  const files = readdirSync('dist', { recursive: true }).map(String);
  expect(files.some(file => /tests|fixtures|opencode|\.map$/.test(file))).toBe(false);
  const requests: string[] = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('/');
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await page.getByText('Read full license', { exact: true }).click();
  await expect(page.locator('pre')).toHaveText(license);
  expect(requests.every(path => path === '/' || /^\/assets\/[^/]+\.(js|css)$/.test(path))).toBe(true);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('startup notice is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('noscript')).toBeVisible();
    // Playwright's text matcher deliberately excludes noscript; read the DOM text.
    expect(await page.locator('noscript').textContent()).toBe('Printametric needs JavaScript to display the workspace.');
  });
});
