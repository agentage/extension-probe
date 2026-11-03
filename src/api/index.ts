import { Router } from 'express';
import { ok, parse, type PartContext } from '@agentage/extension';
import { EchoQuerySchema } from './echo.schema.js';

// The kit mounts this router at /api/v1/.
export const create = (_ctx: PartContext): Router => {
  const router = Router();
  router.get('/echo', (req, res) => {
    const { msg } = parse(EchoQuerySchema, req.query, 'Invalid query');
    res.json(ok({ msg }));
  });
  return router;
};
