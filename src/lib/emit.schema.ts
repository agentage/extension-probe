import { z } from 'zod';

export const EmitBodySchema = z.strictObject({
  fail: z.boolean().optional(),
  exit: z.boolean().optional(),
});
