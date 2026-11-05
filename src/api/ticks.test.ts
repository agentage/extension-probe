import {
  createTestContext,
  ErrorEnvelopeSchema,
  OkEnvelopeSchema,
  startTestServer,
} from '@agentage/extension';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { create } from './index.js';

const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const ctx = createTestContext({ extension: { id: 'probe' }, store: true });
let server: Awaited<ReturnType<typeof startTestServer>>;
// The store boots (WASM, migrations, seed) on first use: here, not inside a test's 5 s.
beforeAll(async () => {
  await ctx.store.query('select 1');
  server = await startTestServer({ create, ctx });
}, 30_000);
afterAll(async () => {
  await server.close();
  await ctx.close();
});

const get = async (path: string) => {
  const res = await server.fetch(path);
  return { status: res.status, body: OkEnvelopeSchema.parse(await res.json()) };
};

describe('GET /api/v1/ticks', () => {
  it('starts from the seed, newest first, with an exact total and a default limit of 50', async () => {
    const { status, body } = await get('/api/v1/ticks?limit=1');
    expect(status).toBe(200);
    expect(body.data).toEqual([{ id: '1', job: 'seed', tickedAt: expect.stringMatching(ISO) }]);
    expect(body.meta).toEqual({ pagination: { limit: 1, total: 1 } });
    expect((await get('/api/v1/ticks')).body.meta).toEqual({ pagination: { limit: 50, total: 1 } });
  });

  it('pages by cursor once more ticks exist', async () => {
    await ctx.store.query("insert into ticks (job) values ('tick'), ('tick')");
    const first = await get('/api/v1/ticks?limit=2');
    expect((first.body.data as { id: string }[]).map((t) => t.id)).toEqual(['3', '2']);
    expect(first.body.meta).toEqual({ pagination: { limit: 2, total: 3, nextCursor: '2' } });
    const next = await get('/api/v1/ticks?limit=2&cursor=2');
    expect((next.body.data as { id: string }[]).map((t) => t.id)).toEqual(['1']);
    expect(next.body.meta).toEqual({ pagination: { limit: 2, total: 3 } });
  });

  it('clamps a limit above 200 and refuses a limit below 1 and a bad cursor', async () => {
    expect((await get('/api/v1/ticks?limit=500')).body.meta).toEqual({
      pagination: { limit: 200, total: 3 },
    });
    for (const query of ['limit=0', 'limit=1.5', 'limit=x', 'cursor=abc', 'other=1']) {
      const res = await server.fetch(`/api/v1/ticks?${query}`);
      expect(res.status, query).toBe(400);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code, query).toBe(
        'VALIDATION_ERROR'
      );
    }
  });
});
