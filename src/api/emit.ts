import { type Request, type Response } from 'express';
import { ok, parse, type PartContext } from '@agentage/extension';
import { EmitBodySchema } from '../lib/emit.schema.js';

// One request writes a log, a span and an event row; fail and exit force the error and edge rows.
export const emit = (ctx: PartContext) => async (req: Request, res: Response) => {
  const { fail, exit } = parse(EmitBodySchema, req.body ?? {}, 'Invalid body');
  const agcid = String(res.locals['agcid']);
  ctx.log.info(`emit ${agcid}`);
  const { rows } = await ctx.span('store.query', () => ctx.store.query('select 1 as n'));
  ctx.log.event('probe.emitted', {
    'agentage.probe.agcid': agcid,
    'agentage.probe.n': rows[0]?.['n'],
  });
  if (fail) throw new Error('forced');
  if (!exit) return void res.json(ok({ emitted: ['log', 'span', 'event'] }));
  res.status(202).json(ok({ exiting: true }));
  ctx.exit();
};
