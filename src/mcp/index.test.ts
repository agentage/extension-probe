import { readFileSync, writeFileSync } from 'node:fs';
import {
  canonical,
  createTestContext,
  mcpSnapshot,
  PROTOCOL_VERSIONS,
  startTestMcp,
} from '@agentage/extension';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { create } from './index.js';

const SNAPSHOT = new URL('../../probe.mcpc.json', import.meta.url);
const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as {
  version: string;
};
const ctx = createTestContext({ extension: { id: 'probe', version } });
let server: Awaited<ReturnType<typeof startTestMcp>>;
beforeAll(async () => {
  server = await startTestMcp({ create, ctx });
});
afterAll(() => server.close());

// The contract: what each protocol version's client lists equals the committed probe.mcpc.json.
describe('probe.mcpc.json', () => {
  for (const version of PROTOCOL_VERSIONS) {
    it(`a ${version} client lists exactly the committed snapshot`, async () => {
      const snapshot = await mcpSnapshot(`${server.url}/mcp`, version);
      if (process.env['UPDATE_SNAPSHOT'])
        writeFileSync(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`);
      expect(snapshot).toEqual(canonical(JSON.parse(readFileSync(SNAPSHOT, 'utf8'))));
    });
  }
});

describe('probe__echo', () => {
  it('needs probe:read: the scope it declares beside its schemas (C7)', () => {
    const recorded = createTestContext({ extension: { id: 'probe' } });
    create(recorded);
    expect(recorded.tools.map(({ name, spec }) => [name, spec.scope])).toEqual([['echo', 'read']]);
  });

  it('answers pong and the message', async () => {
    const res = await server.fetch('/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'probe__echo', arguments: { msg: 'hi' } },
      }),
    });
    const data = (await res.text()).split('\n').find((line) => line.startsWith('data:')) ?? '';
    expect(JSON.parse(data.slice(5))).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [{ type: 'text', text: '{"msg":"pong hi"}' }],
        structuredContent: { msg: 'pong hi' },
      },
    });
  });
});
