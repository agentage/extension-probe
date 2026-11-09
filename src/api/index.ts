import { Router } from 'express';
import { ok, parse, type PartContext } from '@agentage/extension';
import { EchoQuerySchema } from '../lib/echo.schema.js';
import { recentTicks, TicksQuerySchema } from '../lib/ticks.js';
import { emit } from './emit.js';

// The kit mounts this router at /api/v1/.
export const create = (ctx: PartContext): Router => {
  const router = Router();
  router.get('/echo', (req, res) => {
    const { msg } = parse(EchoQuerySchema, req.query, 'Invalid query');
    res.json(ok({ msg, caller: ctx.auth.caller(req)?.sub }));
  });
  router.get('/ticks', async (req, res) => {
    const query = parse(TicksQuerySchema, req.query, 'Invalid query');
    const { ticks, total, nextCursor } = await recentTicks(ctx.store, query);
    const pagination = { limit: query.limit, total, ...(nextCursor ? { nextCursor } : {}) };
    res.json(ok(ticks, { pagination }));
  });
  router.post('/emit', emit(ctx));
  return router;
};
