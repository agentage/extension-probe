import { ErrorEnvelopeSchema } from '@agentage/extension/contracts';
import { createTestContext, startTestServer } from '@agentage/extension';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crash } from '../lib/crash.js';
import { create } from './index.js';

vi.mock('../lib/crash.js', () => ({ crash: vi.fn() }));

const ctx = createTestContext({ store: true });
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
  vi.mocked(crash).mockClear();
});

const post = (agcid: string, body?: object) =>
  server.fetch('/api/v1/emit', {
    method: 'POST',
    headers: { agcid, 'content-type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  });

const errors = () => ctx.logs.filter(({ fields }) => 'err' in fields);

describe('POST /api/v1/emit', () => {
  it('writes a log, a span around store.query and the probe.emitted event, with the agcid', async () => {
    const res = await post('emit-test-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { emitted: ['log', 'span', 'event'] },
    });
    const messages = ctx.logs.map(({ message }) => message);
    expect(messages).toEqual(expect.arrayContaining(['emit emit-test-1', 'span', 'probe.emitted']));
    expect(ctx.spans).toEqual([{ name: 'store.query', ms: expect.any(Number), ok: true }]);
    expect(ctx.logs.find(({ message }) => message === 'probe.emitted')?.fields).toEqual({
      'event.name': 'probe.emitted',
      'agentage.probe.agcid': 'emit-test-1',
      'agentage.probe.n': 1,
    });
    expect(errors()).toEqual([]);
  });

  it('with fail throws after the three lines: a 500 and one error line', async () => {
    const res = await post('emit-test-2', { fail: true });
    expect(res.status).toBe(500);
    const body = ErrorEnvelopeSchema.parse(await res.json());
    expect(body.error).toMatchObject({ code: 'INTERNAL', agcid: 'emit-test-2' });
    expect(ctx.logs.map(({ message }) => message)).toContain('probe.emitted');
    expect(errors().map(({ message }) => message)).toEqual(['forced']);
  });

  it('with exit answers 202, then calls the exit hook once the answer is sent', async () => {
    const res = await post('emit-test-3', { exit: true });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ success: true, data: { exiting: true } });
    await vi.waitFor(() => expect(crash).toHaveBeenCalledTimes(1));
  });

  it('refuses an unknown or mistyped field', async () => {
    for (const body of [{ fail: 'yes' }, { other: true }]) {
      const res = await post('emit-test-4', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.code).toBe('VALIDATION_ERROR');
    }
    expect(crash).not.toHaveBeenCalled();
  });
});
