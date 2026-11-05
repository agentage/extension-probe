import { createTestContext } from '@agentage/extension';
import { afterAll, describe, expect, it } from 'vitest';
import { create } from './index.js';

const ctx = createTestContext({ extension: { id: 'probe' }, store: true });
afterAll(() => ctx.close());

describe('worker tick', () => {
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
