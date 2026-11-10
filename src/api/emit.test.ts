import { ErrorEnvelopeSchema } from '@agentage/extension/contracts';
import { createTestContext, startTestServer } from '@agentage/extension';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from './index.js';

const ctx = createTestContext({ store: true });
const event = vi.spyOn(ctx.log, 'event');
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
beforeEach(() => {
  ctx.logs.length = 0;
  ctx.spans.length = 0;
  ctx.exits.length = 0;
  event.mockClear();
});

const agcid = (n: number) => `e0${String(n).padStart(30, '0')}`;
const post = (id: string, body?: object) =>
  server.fetch('/api/v1/emit', {
    method: 'POST',
    headers: { agcid: id, 'content-type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  });

const errors = () => ctx.logs.filter(({ fields }) => 'err' in fields);

describe('POST /api/v1/emit', () => {
  it('writes a log, a span around store.query and the probe.emitted event, with the agcid', async () => {
    const res = await post(agcid(1));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { emitted: ['log', 'span', 'event'] },
    });
    expect(ctx.logs.map(({ message }) => message)).toContain(`emit ${agcid(1)}`);
    expect(ctx.spans).toEqual([{ name: 'store.query', ms: expect.any(Number), ok: true }]);
    expect(event.mock.calls).toEqual([
      ['probe.emitted', { 'agentage.probe.agcid': agcid(1), 'agentage.probe.n': 1 }],
    ]);
    expect(errors()).toEqual([]);
    expect(ctx.exits).toEqual([]);
  });

  it('with fail throws after the three lines: a 500 and one error line', async () => {
    const res = await post(agcid(2), { fail: true });
    expect(res.status).toBe(500);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error).toMatchObject({ code: 'INTERNAL', agcid: agcid(2) });
    expect(event).toHaveBeenCalledTimes(1);
    expect(errors().map(({ message }) => message)).toEqual(['forced']);
  });

  // ctx.exit inside a request ends the part after its answer (the kit's request line); here it records.
  it('with exit answers 202 and asks the kit to exit once', async () => {
    const res = await post(agcid(3), { exit: true });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ success: true, data: { exiting: true } });
    expect(ctx.exits).toHaveLength(1);
  });

  it('refuses an unknown or mistyped field', async () => {
    for (const body of [{ fail: 'yes' }, { other: true }]) {
      const res = await post(agcid(4), body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('VALIDATION_ERROR');
    }
    expect(ctx.exits).toEqual([]);
  });
});
