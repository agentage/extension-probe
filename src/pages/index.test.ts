import { createTestContext } from '@agentage/extension';
import { describe, expect, it } from 'vitest';
import { create } from './index.js';

describe('pages', () => {
  it('/ names the version and the commit that run', () => {
    const commit = 'c'.repeat(40);
    const ctx = createTestContext({ extension: { version: '0.2.0', commit } });
    const site = create(ctx);
    expect(Object.keys(site)).toEqual(['/']);
    expect(site['/']).toContain(`${ctx.extension.id} 0.2.0 · <code>${commit}</code>`);
  });
});
