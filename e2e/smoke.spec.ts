import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { ErrorEnvelopeSchema, HealthSchema } from '@agentage/extension';
import { expect, test } from '@playwright/test';

// Boot-proving smoke of the api part, against the image in CI: no secrets, no record mounted.
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };
const AGCID = /^[A-Za-z0-9._:-]{8,128}$/;
// An image carries the commit it was built from; a bare dist/ run has none and reports zeros.
const COMMIT = process.env.COMMIT_SHA ?? '0'.repeat(40);
const EXTERNAL_IPV4 = Object.values(networkInterfaces())
  .flat()
  .find((address) => address?.family === 'IPv4' && !address.internal)?.address;

test('/health on loopback is the kit envelope with the build commit', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('no-store');
  expect(res.headers()['agcid']).toMatch(AGCID);
  const { data } = HealthSchema.parse(await res.json());
  expect(data).toMatchObject({ status: 'ok', extension: 'probe', part: 'api', version });
  expect(data.commit).toBe(COMMIT);
});

test('/health off loopback is the NOT_FOUND envelope', async ({ request, baseURL }) => {
  test.skip(!EXTERNAL_IPV4, 'needs a non-loopback IPv4 address on this host');
  const url = new URL('/health', baseURL);
  url.hostname = EXTERNAL_IPV4 ?? '';
  const res = await request.get(url.href);
  expect(res.status()).toBe(404);
  expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('NOT_FOUND');
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
    const { error } = ErrorEnvelopeSchema.parse(await res.json());
    expect(error.code).toBe('NOT_FOUND');
    expect(res.headers()['agcid']).toBe(error.agcid);
  });
}

test('discovery is public and names the image of this version', async ({ request }) => {
  const res = await request.get('/.well-known/agentage-extension.json', {
    headers: { origin: 'https://any.example' },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()['access-control-allow-origin']).toBe('*');
  expect(res.headers()['agcid']).toMatch(AGCID);
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
  expect(res.headers()['agcid']).toMatch(AGCID);
  expect(res.headers()['access-control-allow-origin']).toBe('*');
  expect(res.headers()['access-control-allow-credentials']).toBeUndefined();
});
