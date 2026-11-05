import { createTestContext } from '@agentage/extension';
import { describe, expect, it } from 'vitest';
import { create } from './index.js';

describe('pages', () => {
  it('/ names the version and the commit that run', () => {
    const commit = 'c'.repeat(40);
    const site = create(
      createTestContext({ extension: { id: 'probe', version: '0.2.0', commit } })
    );
    expect(Object.keys(site)).toEqual(['/']);
    expect(site['/']).toContain(`probe 0.2.0 · <code>${commit}</code>`);
  });
});
