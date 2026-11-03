// Drive real actions, including an explicit choice when System already has this scheme.
export async function selectTheme(page, theme) {
  if (theme === 'system') {
    const restore = page.getByRole('button', { name: 'Use system', exact: true });
    if (await restore.count()) await restore.click();
    return;
  }
  const desired = page.getByRole('button', { name: `Switch to ${theme} theme`, exact: true });
  if (!await desired.count()) {
    if ((await page.locator('#theme-mode').textContent()).includes('Manual')) return;
    await page.getByRole('button', { name: /^Switch to .* theme$/ }).click();
  }
  await page.getByRole('button', { name: `Switch to ${theme} theme`, exact: true }).click();
}
