import { readFileSync } from 'node:fs';
import { createTestContext, startTestMcp } from '@agentage/extension';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { create } from './index.js';

const { version, agentage } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as { version: string; agentage: { id: string } };
const { id } = agentage;
const ctx = createTestContext({ extension: { id, version } });
let server: Awaited<ReturnType<typeof startTestMcp>>;
beforeAll(async () => {
  server = await startTestMcp({ create, ctx });
});
afterAll(() => server.close());

describe(`${id}__echo`, () => {
  it(`needs ${id}:read: the scope it declares beside its schemas (C7)`, () => {
    const recorded = createTestContext({ extension: { id } });
    create(recorded);
    expect(recorded.tools.map(({ name, spec }) => [name, spec.scope])).toEqual([['echo', 'read']]);
  });

  it('answers pong and the message', async () => {
    expect(await server.call('echo', { msg: 'hi' })).toEqual({ msg: 'pong hi' });
  });
});
