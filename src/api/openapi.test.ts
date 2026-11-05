import { readFileSync, writeFileSync } from 'node:fs';
import { ErrorEnvelopeSchema } from '@agentage/extension';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EchoQuerySchema } from '../lib/echo.schema.js';
import { TicksQuerySchema } from '../lib/ticks.js';

const FILE = new URL('../../openapi.json', import.meta.url);
const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as {
  version: string;
};

const json = (schema: z.ZodType): Record<string, unknown> => {
  const doc = { ...(z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>) };
  delete doc['$schema'];
  return doc;
};

const parameters = (schema: z.ZodObject) => {
  const { properties = {}, required = [] } = json(schema) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return Object.entries(properties).map(([name, s]) => ({
    name,
    in: 'query',
    required: required.includes(name),
    schema: s,
  }));
};

const ok = (data: z.ZodType) => ({
  description: 'the envelope',
  content: {
    'application/json': {
      schema: json(
        z.object({
          success: z.literal(true),
          data,
          meta: z.record(z.string(), z.unknown()).optional(),
        })
      ),
    },
  },
});

const invalid = {
  description: 'VALIDATION_ERROR',
  content: { 'application/json': { schema: json(ErrorEnvelopeSchema) } },
};

const TickSchema = z.object({ id: z.string(), job: z.string(), tickedAt: z.iso.datetime() });

// The api's contract, generated from its Zod schemas; the kit serves the committed copy.
const generated = () => ({
  openapi: '3.1.0',
  info: { title: 'probe', version },
  paths: {
    '/api/v1/echo': {
      get: {
        operationId: 'echo',
        security: [],
        parameters: parameters(EchoQuerySchema),
        responses: { '200': ok(z.object({ msg: z.string() })), '400': invalid },
      },
    },
    '/api/v1/ticks': {
      get: {
        operationId: 'ticks',
        security: [],
        parameters: parameters(TicksQuerySchema),
        responses: { '200': ok(z.array(TickSchema)), '400': invalid },
      },
    },
  },
});

describe('openapi.json', () => {
  it('equals what the Zod schemas generate', () => {
    if (process.env['UPDATE_SNAPSHOT'])
      writeFileSync(FILE, `${JSON.stringify(generated(), null, 2)}\n`);
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(generated());
  });
});
