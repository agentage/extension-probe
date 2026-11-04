import { type Store } from '@agentage/extension';
import { z } from 'zod';

export const TicksQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z
    .string()
    .regex(/^[0-9]{1,19}$/)
    .optional(),
});

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

// Newest first; one row past the page says whether a next page exists, its cursor is the last id.
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
  return { ticks, total: count[0]?.n ?? 0, nextCursor: last };
};
