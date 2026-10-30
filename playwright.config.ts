// Own both servers: never reuse a developer's potentially stale build or fixture.
import { defineConfig } from '@playwright/test';

const productionURL = 'http://127.0.0.1:4273';
const developmentURL = 'http://127.0.0.1:5273';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'production', testMatch: '**/foundation.spec.ts', use: { baseURL: productionURL } },
    { name: 'development', testMatch: '**/development.spec.ts', use: { baseURL: developmentURL } },
  ],
  webServer: [
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4273 --strictPort',
      url: productionURL,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5273 --strictPort',
      url: developmentURL,
      reuseExistingServer: false,
    },
  ],
});
