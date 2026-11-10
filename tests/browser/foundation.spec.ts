// Production acceptance journeys; the shared gate builds dist before this suite.
import { readFileSync, readdirSync } from 'node:fs';
import { test, expect } from './test.js';
import { installBrowserProbe, sentinelKey, themeKey } from './browser-probe.js';
import { verifyWorkspace } from './workspace-journey.mjs';
import { verifySupportDialogs } from './support-journey.mjs';
import { selectTheme } from './theme-actions.mjs';

for (const theme of ['light', 'dark'] as const) {
  for (const [width, height] of [[320, 800], [768, 1024], [959, 900], [960, 900], [1280, 800], [2560, 1440], [640, 400]] as const) {
    test(`Gridline ${theme} ${width}×${height}: stable canvas and reachable drawer`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const preview = page.locator('.workspace-preview');
      const before = await preview.boundingBox();
      const header = await page.locator('.app-header').boundingBox();
      if (!before || !header) throw new Error('Expected visible Gridline header and preview');
      expect(before.x).toBe(0);
      expect(before.width).toBe(width);
      expect(before.y).toBe(header.y + header.height);
      const summary = page.locator('.settings-drawer > summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      // Opening the drawer overlays the same preview, including in short windows.
      await expect(page.locator('.settings-drawer')).toHaveAttribute('open', '');
      expect((await preview.boundingBox())?.height).toBe(before?.height);
      for (const view of ['Design', 'Print layout', 'Assembly']) {
        await page.getByRole('link', { name: view, exact: true }).click();
        await expect(page.locator('.settings-drawer')).toHaveAttribute('open', '');
        await expect(page.locator('main details.settings-drawer')).toHaveCount(1);
        if (view === 'Design') await expect(page.locator('dd').last()).toHaveText('Not available');
        else await expect(page.locator('dd')).toHaveText(['Not available', 'Not available', 'Not available']);
        const grid = await page.locator('.settings-content').evaluate(element => {
          const tracks = getComputedStyle(element).gridTemplateColumns.split(' ').map(Number.parseFloat);
          return { activeTracks: tracks.filter(value => value > 0).length, groups: [...element.children].reduce((sum, child) => sum + (getComputedStyle(child).gridColumnEnd === '-1' ? tracks.length : 1), 0),
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
        });
        expect(grid.activeTracks).toBeLessThanOrEqual(grid.groups);
        expect(grid.overflow).toBe(false);
        await page.getByRole('radio', { name: 'Grid', exact: true }).focus();
        await page.keyboard.press('ArrowLeft');
        await expect(page.getByRole('radio', { name: 'Plain', exact: true })).toBeChecked();
        await expect(page.getByRole('radio', { name: 'Plain', exact: true })).toBeInViewport();
      }
      await page.reload();
      await expect(page.locator('.settings-drawer')).not.toHaveAttribute('open');
    });
  }

  test(`theme keyboard actions start from ${theme} System and restore focus`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    const opposite = theme === 'light' ? 'dark' : 'light';
    const toggle = page.locator('.theme-toggle');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', opposite);
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('#theme-mode')).toContainText('Manual');
    await page.getByRole('button', { name: 'Use system' }).focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toBeFocused();
    await expect(page.locator('#theme-mode')).toContainText('System');
    await expect(page.getByRole('button', { name: 'Use system' })).toHaveCount(0);
  });
}

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
    await selectTheme(page, theme);
    for (const [view, heading] of [
      ['Print layout', 'No print layout yet'], ['Assembly', 'No assembly guidance yet'],
    ]) {
      await page.getByRole('link', { name: view, exact: true }).click();
      for (const tips of [true, false]) {
        await page.locator('.settings-drawer > summary').click();
        await page.getByRole('checkbox',{name:'Show workspace tips',exact:true}).setChecked(tips);
        for (const background of ['Plain', 'Grid']) {
          await page.getByRole('radio', { name: background, exact: true }).check();
          await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
          await expect(page.locator('dd')).toHaveText(['Not available', 'Not available', 'Not available']);
          await expect(page.getByText('Model editing and presets are not available yet.', { exact: true })).toHaveCount(view === 'Design' ? 1 : 0);
          await expect(page.getByText('Plate configuration is not available yet.', { exact: true })).toHaveCount(view === 'Assembly' ? 0 : 1);
          await expect(page.getByText('Decorative grid — not to scale.', { exact: true })).toHaveCount(background === 'Grid' ? 1 : 0);
          await expect(page.locator('input[type=file], a[download], canvas, [role=progressbar]')).toHaveCount(0);
        }
        await page.locator('.settings-drawer > summary').click();
      }
    }
  });
}

for (const stored of ['', 'unknown', 'x'.repeat(16), 'x'.repeat(17), 'x'.repeat(4096)]) {
  test(`invalid stored theme is retained until explicit selection (${stored.length} chars)`, async ({ page }) => {
    await installBrowserProbe(page, stored);
    await page.goto('/');
    await expect(page.getByText(/The stored theme preference is invalid/)).toBeVisible();
    await expect(page.locator('#theme-mode')).toHaveText('Light · System');
    expect(await page.evaluate(key => localStorage.getItem(key), themeKey)).toBe(stored);
    expect(await page.evaluate(() => window.foundationProbe.writes)).toEqual([]);
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
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
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
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
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Retry theme storage' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), themeKey)).toBe('light');
  await page.locator('.settings-drawer > summary').click();
  await page.getByRole('checkbox',{name:'Show workspace tips',exact:true}).uncheck();
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
  const theme = page.locator('#theme-mode');
  await expect(theme).toHaveText('Light · System');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Help', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.foundationProbe.writes)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Use system' }).click();
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => window.foundationProbe.writes)).toEqual([[themeKey, 'light'], [themeKey, 'system']]);
  expect(await page.evaluate(key => localStorage.getItem(key), sentinelKey)).toBe('leave this design untouched');
  await page.reload();
  await expect(theme).toHaveText('Dark · System');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(key => localStorage.getItem(key), sentinelKey)).toBe('leave this design untouched');
});

test('unavailable system preference falls back to Light', async ({ page }) => {
  await page.addInitScript(() => { window.matchMedia = () => { throw new Error('Test unavailable media API'); }; });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
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
  expect(requests.every(path => path === '/' || /^\/assets\/[^/]+\.(js|css|wasm)$/.test(path))).toBe(true);
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
