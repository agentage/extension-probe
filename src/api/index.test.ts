import { createTestContext, ErrorEnvelopeSchema, startTestServer } from '@agentage/extension';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { create } from './index.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let server: Awaited<ReturnType<typeof startTestServer>>;
beforeAll(async () => {
  server = await startTestServer({
    create,
    ctx: createTestContext({ extension: { id: 'probe' } }),
  });
});
afterAll(() => server.close());

describe('GET /api/v1/echo', () => {
  it('echoes msg in the envelope, with an agcid', async () => {
    const res = await server.fetch('/api/v1/echo?msg=hi');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"success":true,"data":{"msg":"hi"}}');
    expect(res.headers.get('agcid')).toMatch(UUID_V7);
  });

  it('keeps the caller agcid', async () => {
    const res = await server.fetch('/api/v1/echo?msg=hi', { headers: { agcid: 'probe-test-1' } });
    expect(res.headers.get('agcid')).toBe('probe-test-1');
  });

  it('answers VALIDATION_ERROR without msg', async () => {
    const res = await server.fetch('/api/v1/echo', { headers: { agcid: 'probe-test-2' } });
    expect(res.status).toBe(400);
    const body: unknown = await res.json();
    expect(ErrorEnvelopeSchema.parse(body)).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query',
        agcid: 'probe-test-2',
        details: [{ field: 'msg', message: expect.any(String) }],
      },
    });
  });

  it('refuses a repeated or oversized msg', async () => {
    expect((await server.fetch('/api/v1/echo?msg=a&msg=b')).status).toBe(400);
    expect((await server.fetch(`/api/v1/echo?msg=${'x'.repeat(201)}`)).status).toBe(400);
  });
});
