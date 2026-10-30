// Real modal regressions for dev and served production. T5 will add the CI runner.
import assert from 'node:assert/strict';

export async function verifySupportDialogs(page, baseURL, expectedLicense, theme = 'light') {
  await page.goto('about:blank');
  await page.goto(baseURL);
  await page.getByRole('combobox', { name: 'Theme' }).selectOption(theme);
  await page.getByRole('checkbox', { name: 'Show workspace tips' }).uncheck();
  const originalHistory = await page.evaluate(() => history.length);
  const originalURL = page.url();
  const dialog = page.getByRole('dialog');

  for (const title of ['Help', 'About']) {
    const opener = page.getByRole('button', { name: title, exact: true });
    await opener.focus();
    await page.keyboard.press('Enter');
    await dialog.waitFor();
    assert.equal(await dialog.getAttribute('aria-labelledby'), 'support-title');
    assert.equal(await page.locator(':focus').textContent(), title);
    assert.equal(await dialog.evaluate(element => element.matches(':modal')), true);
    assert.equal(await page.locator('dialog').count(), 1);
    const close = dialog.getByRole('button', { name: `Close ${title}` });
    const last = title === 'About' ? dialog.locator('summary') : close;

    // Backward wrap from initial heading; both ends of the tab sequence stay inside.
    await page.keyboard.press('Shift+Tab');
    assert.equal(await last.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await close.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await last.evaluate(element => element === document.activeElement), true);
    await page.locator('h1').evaluate(element => element.focus());
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true);
    await page.mouse.click(2, 2);
    assert.equal(await dialog.isVisible(), true); // Backdrop must not dismiss.
    await page.keyboard.press('Shift+Tab');
    assert.equal(await last.evaluate(element => element === document.activeElement), true);

    if (title === 'Help') {
      for (const name of ['Workspace views', 'Display settings', 'Keyboard', 'Theme storage', 'Not available yet']) {
        assert.equal(await dialog.getByRole('heading', { name, exact: true }).count(), 1);
      }
      assert.match(await dialog.textContent(), /Planned model formats: STEP, STL, and standard 3MF\./);
      assert.match(await dialog.textContent(), /Only the theme preference is remembered/);
      assert.match(await dialog.textContent(), /They are not required steps/);
    } else {
      assert.equal(await dialog.locator('.support-about > p').first().textContent(),
        'Printametric is a personal-use source-available project, not open source.');
      await last.focus();
      await page.keyboard.press('Enter');
      assert.equal(await dialog.locator('details').evaluate(element => element.open), true);
      assert.equal(await dialog.locator('pre').textContent(), expectedLicense);
      await page.keyboard.press('Control+End');
      await page.waitForFunction(() => {
        const element = document.querySelector('dialog');
        return element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
      });
      assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), true);
      // Keyboard wrap returns from the disclosure to the reachable Close action.
      await last.focus();
      await page.keyboard.press('Tab');
      assert.equal(await close.evaluate(element => element === document.activeElement), true);
    }

    await close.focus();
    await page.keyboard.press('Enter');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await opener.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Space');
    await dialog.waitFor();
    if (title === 'About') assert.equal(await dialog.locator('details').evaluate(element => element.open), false);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await opener.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.getByRole('checkbox').isChecked(), false);
    assert.equal(page.url(), originalURL);
    assert.equal(await page.evaluate(() => history.length), originalHistory);
  }

  await page.getByRole('link', { name: 'Print layout', exact: true }).click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector('dialog') && document.activeElement?.textContent === 'Design');
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await page.goForward();
  await page.waitForFunction(() => !document.querySelector('dialog') && document.activeElement?.textContent === 'Print layout');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.evaluate(() => { location.hash = '#%<unknown>'; });
  await page.waitForFunction(() => !document.querySelector('dialog') && document.activeElement?.textContent === 'Design');
  assert.equal(new URL(page.url()).hash, '#design');
  assert.equal(await page.getByText('This view is not available. Showing Design.', { exact: true }).isVisible(), true);
  return 'Help/About content, exact license, keyboard wrapping, inert background, Close/Escape, history and recovery focus passed.';
}
