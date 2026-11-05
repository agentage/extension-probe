import { type McpContext } from '@agentage/extension';
import { z } from 'zod';

// The kit serves this tool as probe__echo on POST /mcp.
export function create(ctx: McpContext) {
  ctx.tool(
    'echo',
    {
      description: 'Echo a message back',
      input: z.object({ msg: z.string().max(200) }),
      output: z.object({ msg: z.string() }),
    },
    async ({ msg }) => ({ msg: `pong ${msg}` })
  );
}
