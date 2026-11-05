import { defineConfig } from '@playwright/test';

// Against `agentage extension up` (the release images behind the local gateway); PROBE_BASE_URL elsewhere.
export default defineConfig({
  testDir: '.',
  forbidOnly: !!process.env.CI,
  // No retries: a flake is a bug to fix at its cause, never a second chance.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PROBE_BASE_URL ?? 'http://localhost:4280',
    extraHTTPHeaders: { 'x-client-type': 'test' },
  },
});
