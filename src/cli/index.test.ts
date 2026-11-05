import { createTestContext } from '@agentage/extension';
import { describe, expect, it } from 'vitest';
import { create } from './index.js';

describe('agentage ping', () => {
  it('answers pong', async () => {
    const ctx = createTestContext({ args: {} });
    expect(await create(ctx).ping()).toBe(0);
    expect(ctx.output.stdout).toEqual(['pong']);
  });

  it('answers pong and the message', async () => {
    const ctx = createTestContext({ args: { msg: 'hi' } });
    await create(ctx).ping();
    expect(ctx.output).toEqual({ stdout: ['pong hi'], stderr: [] });
  });
});
