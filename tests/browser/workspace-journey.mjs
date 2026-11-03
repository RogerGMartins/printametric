// Shared real-page assertions used by the production and development browser suites.
import assert from 'node:assert/strict';
import { selectTheme } from './theme-actions.mjs';

export async function verifyWorkspace(page, baseURL) {
  await page.goto(baseURL);
  await page.getByRole('heading', { name: 'Design', exact: true }).waitFor();
  assert.equal(await page.title(), 'Design · Printametric');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BODY');
  const startingHistory = await page.evaluate(() => history.length);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').textContent(), 'Skip to workspace');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'), 'workspace');
  assert.equal(new URL(page.url()).hash, '');
  await page.getByRole('link', { name: 'Design', exact: true }).click();
  assert.equal(await page.evaluate(() => history.length), startingHistory);
  assert.equal(await page.locator(':focus').textContent(), 'Design');

  const settings = page.locator('.settings-drawer > summary');
  await settings.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('radio', { name: 'Grid', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Show workspace tips' }).uncheck();
  await settings.click();
  assert.equal(await page.locator('.settings-drawer').getAttribute('open'), null);
  assert.equal(await settings.textContent(), 'Workspace settings');
  await selectTheme(page, 'dark');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');

  for (const [label, hash, empty] of [
    ['Print layout', '#print-layout', 'No print layout yet'],
    ['Assembly', '#assembly', 'No assembly guidance yet'],
  ]) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await page.getByRole('heading', { name: empty, exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, hash);
    assert.equal(await page.title(), `${label} · Printametric`);
    assert.equal(await page.locator(':focus').textContent(), label);
    assert.equal(await page.getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'page');
    assert.equal(await page.getByLabel('Show workspace tips', { exact: true }).isChecked(), false);
    assert.equal(await page.locator('.settings-drawer').getAttribute('open'), null);
    assert.match(await page.locator('#background-heading').textContent(), /Grid/);
    assert.equal(await page.getByText('Decorative grid — not to scale.', { exact: true }).isVisible(), true);
    assert.equal(await page.locator('dd').allTextContents().then(values => values.join('|')), 'Not available|Not available|Not available');
  }
  assert.equal(await page.evaluate(() => history.length), startingHistory + 2);
  await page.getByRole('link', { name: 'Assembly', exact: true }).click();
  assert.equal(await page.evaluate(() => history.length), startingHistory + 2);
  await page.goBack();
  await page.waitForFunction(() => document.activeElement?.textContent === 'Print layout');
  await page.goBack();
  await page.waitForFunction(() => document.activeElement?.textContent === 'Design');
  await page.goForward();
  await page.waitForFunction(() => document.activeElement?.textContent === 'Print layout');
  await page.reload();
  await page.getByRole('heading', { name: 'Print layout', exact: true }).waitFor();
  assert.equal(await page.locator('#theme-mode').textContent(), 'Dark · Manual');
  assert.equal(await page.getByLabel('Show workspace tips', { exact: true }).isChecked(), true);
  assert.match(await page.locator('#background-heading').textContent(), /Plain/);
  assert.equal(await page.locator('.settings-drawer').getAttribute('open'), null);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BODY');

  await page.goto('about:blank');
  await page.goto(`${baseURL}/#%<unknown>`);
  await page.getByText('This view is not available. Showing Design.', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, '#design');
  assert.equal(await page.locator('unknown').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BODY');
  await page.getByRole('link', { name: 'Design', exact: true }).click();
  assert.equal(await page.getByText('This view is not available. Showing Design.', { exact: true }).count(), 0);
  assert.equal(await page.locator(':focus').textContent(), 'Design');
  for (const hash of ['#assembly', '#print-layout', '#design']) {
    await page.goto('about:blank');
    await page.goto(`${baseURL}/${hash}`);
    await page.waitForFunction(expected => document.querySelector('nav [aria-current="page"]')?.getAttribute('href') === expected, hash);
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BODY');
  }
  return 'Navigation, native controls, history, settings/reload, malformed route, and focus passed.';
}

export async function verifyWorkspaceErrors(page, baseURL) {
  await page.goto(`${baseURL}/tests/fixtures/workspace-errors.html`);
  const recovery = page.getByRole('button', { name: 'Review Preview background' });
  await recovery.waitFor();
  assert.equal(await page.locator('.settings-drawer').getAttribute('open'), null);
  assert.match(await page.locator('#background-heading').textContent(), /Grid/);
  assert.equal(await page.getByLabel('Show workspace tips', { exact: true }).isChecked(), true);
  await recovery.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.getAttribute('value') === 'grid');
  assert.equal(await page.locator('#background-error').isVisible(), true);
  assert.equal(await page.getByRole('radio', { name: 'Grid', exact: true }).getAttribute('aria-invalid'), 'true');
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => !document.getElementById('background-error'));
  assert.equal(await page.getByRole('radio', { name: 'Plain', exact: true }).isChecked(), true);
  assert.equal(await page.locator('#theme-error').isVisible(), true);
  assert.equal(await page.locator('#tips-error').isVisible(), true);
  await page.locator('.settings-drawer > summary').click();
  await page.getByRole('button', { name: 'Review Show workspace tips' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.getAttribute('type') === 'checkbox');
  assert.equal(await page.locator('#tips-error').isVisible(), true);
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#tips-error').count(), 0);
  await selectTheme(page, 'light');
  assert.equal(await page.locator('#theme-error').count(), 0);
  return 'Collapsed error remains visible, keyboard recovery retains value until valid edit, and independent errors clear correctly.';
}
