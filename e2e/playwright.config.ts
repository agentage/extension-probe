import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const PORT = 3100;
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };

// Hermetic by default (the kit's image entry over dist/, no secrets); PROBE_BASE_URL: an image.
export default defineConfig({
  testDir: '.',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PROBE_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    extraHTTPHeaders: { 'x-client-type': 'test' },
  },
  webServer: process.env.PROBE_BASE_URL
    ? undefined
    : {
        command: 'node node_modules/@agentage/extension/dist/runtime/main.js api',
        cwd: '..',
        url: `http://127.0.0.1:${PORT}/health`,
        env: { PORT: String(PORT), AGENTAGE_IMAGE: `ghcr.io/agentage/probe-api:${version}` },
        reuseExistingServer: !process.env.CI,
      },
});
