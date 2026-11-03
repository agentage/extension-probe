import { Router } from 'express';
import { ok, parse, type PartContext } from '@agentage/extension';
import { EchoQuerySchema } from './echo.schema.js';

// The api part: mounted by the kit at /api/v1/; the caller field arrives with the token check.
export const create = (_ctx: PartContext): Router => {
  const router = Router();
  router.get('/echo', (req, res) => {
    const { msg } = parse(EchoQuerySchema, req.query, 'Invalid query');
    res.json(ok({ msg }));
  });
  return router;
};
