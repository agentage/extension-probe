import { readFileSync } from 'node:fs';
import { ErrorEnvelopeSchema, HealthSchema } from '@agentage/extension';
import { expect, test } from '@playwright/test';

// Boot-proving smoke of the api part, against the image in CI: no secrets, no record mounted.
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };
const AGCID = /^[A-Za-z0-9._:-]{8,128}$/;

test('/health on loopback is the kit envelope with the build commit', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('no-store');
  const { data } = HealthSchema.parse(await res.json());
  expect(data).toMatchObject({ status: 'ok', extension: 'probe', part: 'api', version });
  const commit = process.env.COMMIT_SHA;
  if (commit) expect(data.commit).toBe(commit);
});

test('GET /api/v1/echo answers the envelope with an agcid', async ({ request }) => {
  const res = await request.get('/api/v1/echo?msg=hi');
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe('{"success":true,"data":{"msg":"hi"}}');
  expect(res.headers()['agcid']).toMatch(AGCID);
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['x-powered-by']).toBeUndefined();
});

test('a bad query is VALIDATION_ERROR carrying the caller agcid', async ({ request }) => {
  const res = await request.get('/api/v1/echo', { headers: { agcid: 'probe-smoke-400' } });
  expect(res.status()).toBe(400);
  expect(ErrorEnvelopeSchema.parse(await res.json()).error).toMatchObject({
    code: 'VALIDATION_ERROR',
    agcid: 'probe-smoke-400',
  });
  expect(res.headers()['agcid']).toBe('probe-smoke-400');
});

for (const path of ['/api/v1/nope', '/api/', '/mcp/x', '/']) {
  test(`a miss at ${path} is the NOT_FOUND envelope`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(404);
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('NOT_FOUND');
  });
}

test('discovery is public and names the image of this version', async ({ request }) => {
  const res = await request.get('/.well-known/agentage-extension.json', {
    headers: { origin: 'https://any.example' },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()['access-control-allow-origin']).toBe('*');
  expect(await res.json()).toMatchObject({
    id: 'probe',
    version,
    parts: { api: { image: `ghcr.io/agentage/probe-api:${version}` } },
  });
});

test('/api/ answers a CORS preflight without credentials', async ({ request }) => {
  const res = await request.fetch('/api/v1/echo', {
    method: 'OPTIONS',
    headers: { origin: 'https://any.example', 'access-control-request-method': 'GET' },
  });
  expect(res.status()).toBe(204);
  expect(res.headers()['access-control-allow-origin']).toBe('*');
  expect(res.headers()['access-control-allow-credentials']).toBeUndefined();
});
