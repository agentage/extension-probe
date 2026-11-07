import { type Store } from '@agentage/extension';
import { z } from 'zod';

// api-standards section 3: default 50, a limit above 200 is clamped, not refused.
const MAX_LIMIT = 200;

export const TicksQuerySchema = z.strictObject({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(50)
    .describe(`page size; a limit above ${MAX_LIMIT} is clamped to ${MAX_LIMIT}`)
    .transform((limit) => Math.min(limit, MAX_LIMIT)),
  cursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,26}$/)
    .transform((cursor, ctx) => {
      const id = Buffer.from(cursor, 'base64url').toString();
      if (/^[0-9]{1,19}$/.test(id) && encodeCursor(id) === cursor) return id;
      ctx.issues.push({ code: 'custom', message: 'Invalid cursor', input: cursor });
      return z.NEVER;
    })
    .optional(),
});

// api-standards section 3: the cursor is opaque to clients.
export const encodeCursor = (id: string): string => Buffer.from(id).toString('base64url');

export type TicksQuery = z.infer<typeof TicksQuerySchema>;

export interface Tick {
  id: string;
  job: string;
  tickedAt: string;
}

interface TickRow {
  id: string | number;
  job: string;
  ticked_at: Date | string;
  [key: string]: unknown;
}

const PAGE = `select id, job, ticked_at from ticks
  where ($1::bigint is null or id < $1::bigint) order by id desc limit $2`;

// Newest first; one row past the page says whether a next page exists, its cursor wraps the last id.
export const recentTicks = async (store: Store, query: TicksQuery) => {
  const { rows: page } = await store.query<TickRow>(PAGE, [query.cursor ?? null, query.limit + 1]);
  const rows = page.slice(0, query.limit);
  const { rows: count } = await store.query<{ n: number }>('select count(*)::int as n from ticks');
  const ticks: Tick[] = rows.map((row) => ({
    id: String(row.id),
    job: row.job,
    tickedAt: new Date(row.ticked_at).toISOString(),
  }));
  const last = page.length > query.limit ? ticks.at(-1)?.id : undefined;
  return { ticks, total: count[0]?.n ?? 0, nextCursor: last && encodeCursor(last) };
};
