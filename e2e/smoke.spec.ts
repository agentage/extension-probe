import { readFileSync } from 'node:fs';
import {
  DiscoveryDocumentSchema,
  ErrorEnvelopeSchema,
  OkEnvelopeSchema,
} from '@agentage/extension/contracts';
import { expect, test } from '@playwright/test';

// Boot-proving smoke of every part through the local gateway: no secrets, the URL layout as on next.
const { version, agentage } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string; agentage: { id: string } };
const { id } = agentage;
const AGCID = /^[A-Za-z0-9._:-]{8,128}$/;
// The dev issuer of `up`, and the 401 challenge naming the resource document (C5).
const ISSUER = 'http://localhost:4281';
const RESOURCE =
  'Bearer resource_metadata="http://localhost:4280/.well-known/oauth-protected-resource"';

const mcp = (method: string) => ({
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
  data: { jsonrpc: '2.0', id: 1, method, params: {} },
});

test('discovery is valid, lists five images by digest, a postgres store and the echo tool', async ({
  request,
}) => {
  const res = await request.get('/.well-known/agentage-extension.json', {
    headers: { origin: 'https://any.example' },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()['access-control-allow-origin']).toBe('*');
  const doc = DiscoveryDocumentSchema.parse(await res.json());
  const tools = [{ name: `${id}__echo`, scope: `${id}:read` }];
  expect(doc).toMatchObject({ id, version, tools, commands: ['ping'] });
  expect(Object.keys(doc.parts).sort()).toEqual(['api', 'mcp', 'pages', 'store', 'ui', 'worker']);
  expect(doc.parts.store).toEqual({ kind: 'postgres', migrations: 1 });
});

test('the resource document names the issuer and the read scope', async ({ request }) => {
  const res = await request.get('/.well-known/oauth-protected-resource');
  expect(await res.json()).toEqual({
    resource: 'http://localhost:4280',
    authorization_servers: ['http://issuer:3000'],
    scopes_supported: [`${id}:read`],
    bearer_methods_supported: ['header'],
  });
});

test('pages names the version and the commit', async ({ request }) => {
  const res = await request.get('/');
  expect(res.headers()['content-type']).toContain('text/html');
  expect(await res.text()).toMatch(new RegExp(`${id} ${version} · <code>[0-9a-f]{40}</code>`));
});

test('the api answers echo to a read token and ticks to anyone, with an agcid', async ({
  request,
}) => {
  const none = await request.get('/api/v1/echo?msg=hi');
  expect([none.status(), none.headers()['www-authenticate']]).toEqual([401, RESOURCE]);
  const minted = await request.post(`${ISSUER}/token`, { data: { scope: `${id}:read` } });
  const { token } = (await minted.json()) as { token: string };
  const echo = await request.get('/api/v1/echo?msg=hi', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(await echo.text()).toBe('{"success":true,"data":{"msg":"hi","caller":"usr_dev"}}');
  expect(echo.headers()['agcid']).toMatch(AGCID);
  const ticks = OkEnvelopeSchema.parse(await (await request.get('/api/v1/ticks?limit=1')).json());
  expect(ticks.data).toEqual([expect.objectContaining({ job: expect.any(String) })]);
  const bad = await request.get('/api/v1/ticks?limit=0');
  expect(ErrorEnvelopeSchema.parse(await bad.json()).error.code).toBe('VALIDATION_ERROR');
});

test('/mcp is POST only and lists the echo tool anonymously', async ({ request }) => {
  expect((await request.get('/mcp')).status()).toBe(405);
  const res = await request.post('/mcp', mcp('tools/list'));
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain(`"name":"${id}__echo"`);
});

test('the ui bundle and the harness are served, immutable', async ({ request }) => {
  for (const file of [`${id}.js`, 'harness.html', 'widgets.json']) {
    const res = await request.get(`/ui/${version}/${file}`);
    expect(res.status(), file).toBe(200);
    expect(res.headers()['cache-control'], file).toContain('immutable');
  }
});

test('/health and a reserved miss are the gateway 404, never a part', async ({ request }) => {
  for (const path of ['/health', '/api/', '/mcp/x']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
    expect(res.headers()['content-type'] ?? '', path).not.toContain('application/json');
  }
});
