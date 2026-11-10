import { ErrorEnvelopeSchema } from '@agentage/extension/contracts';
import { createTestContext, startTestServer } from '@agentage/extension';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { create } from './index.js';

const AGCID = /^[0-9a-f]{32}$/;

let server: Awaited<ReturnType<typeof startTestServer>>;
beforeAll(async () => {
  server = await startTestServer({ create, ctx: createTestContext() });
});
afterAll(() => server.close());

describe('GET /api/v1/echo', () => {
  it('echoes msg and names the caller in the envelope, with an agcid (C6)', async () => {
    const res = await server.fetch('/api/v1/echo?msg=hi');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"success":true,"data":{"msg":"hi","caller":"usr_test"}}');
    expect(res.headers.get('agcid')).toMatch(AGCID);
  });

  it('keeps the caller agcid', async () => {
    const res = await server.fetch('/api/v1/echo?msg=hi', {
      headers: { agcid: 'ec40000000000000000000000000000a' },
    });
    expect(res.headers.get('agcid')).toBe('ec40000000000000000000000000000a');
  });

  it('answers VALIDATION_ERROR without msg', async () => {
    const res = await server.fetch('/api/v1/echo', {
      headers: { agcid: 'ec40000000000000000000000000000b' },
    });
    expect(res.status).toBe(400);
    const body: unknown = await res.json();
    expect(ErrorEnvelopeSchema.parse(body)).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query',
        agcid: 'ec40000000000000000000000000000b',
        details: [{ field: 'msg', message: expect.any(String) }],
      },
    });
  });

  it('takes 200 characters, refuses an empty, repeated or oversized msg', async () => {
    expect((await server.fetch(`/api/v1/echo?msg=${'x'.repeat(200)}`)).status).toBe(200);
    for (const query of ['msg=', 'msg=a&msg=b', `msg=${'x'.repeat(201)}`]) {
      const res = await server.fetch(`/api/v1/echo?${query}`);
      expect(res.status, query).toBe(400);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code, query).toBe(
        'VALIDATION_ERROR'
      );
    }
  });
});
