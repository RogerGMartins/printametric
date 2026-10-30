// Fail every journey on uncaught application errors or unexpected downloads.
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ browserHealth: void }>({
  browserHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    const downloads: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('download', download => downloads.push(download.suggestedFilename()));
    await use();
    expect(errors, 'Uncaught browser errors').toEqual([]);
    expect(downloads, 'Foundation must not create downloads').toEqual([]);
  }, { auto: true }],
});
export { expect };
