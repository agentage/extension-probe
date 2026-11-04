import { defineConfig } from '@playwright/test';

// Against `agentage extension up` (the release images behind the local gateway); PROBE_BASE_URL elsewhere.
export default defineConfig({
  testDir: '.',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PROBE_BASE_URL ?? 'http://localhost:4280',
    extraHTTPHeaders: { 'x-client-type': 'test' },
  },
});
