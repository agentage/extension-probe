import { createTestContext } from '@agentage/extension';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { create } from './index.js';

const ctx = createTestContext({ extension: { id: 'probe' }, store: true });
// The store boots (WASM, migrations, seed) on first use: here, not inside a test's 5 s.
beforeAll(() => ctx.store.query('select 1'), 30_000);
afterAll(() => ctx.close());

describe('worker tick', () => {
  it('schedules tick every minute with a 30 s timeout (the p0 waits 60 s for a row)', () => {
    const schedule = vi.fn<typeof ctx.schedule>();
    create({ ...ctx, schedule });
    expect(schedule.mock.calls.map(([name, cron, , options]) => [name, cron, options])).toEqual([
      ['tick', '* * * * *', { timeout: '30s' }],
    ]);
  });

  it('writes one tick per run and logs it into the run', async () => {
    create(ctx);
    const run = await ctx.runJob('tick');
    expect(run).toMatchObject({
      job: 'tick',
      status: 'ok',
      log: 'info tick 2\n',
      timeoutMs: 30_000,
    });
    const { rows } = await ctx.store.query('select job from ticks order by id');
    expect(rows).toEqual([{ job: 'seed' }, { job: 'tick' }]);
  });
});
