import { readFileSync } from 'node:fs';
import { ErrorEnvelopeSchema } from '@agentage/extension/contracts';
import { createTestContext } from '@agentage/extension';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EchoQuerySchema } from '../lib/echo.schema.js';
import { TicksQuerySchema } from '../lib/ticks.js';
import { create } from './index.js';

const FILE = new URL('../../openapi.json', import.meta.url);
const { version, agentage } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as { version: string; agentage: { id: string } };
const { id } = agentage;

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

const PaginationSchema = z.object({
  pagination: z.object({
    nextCursor: z.string().optional().describe('opaque; absent on the last page'),
    limit: z.int(),
    total: z.int(),
  }),
});

const ok = (data: z.ZodType, meta: z.ZodType = z.record(z.string(), z.unknown())) => ({
  description: 'the envelope',
  content: {
    'application/json': {
      schema: json(
        z.object({
          success: z.literal(true),
          data,
          meta: meta.optional(),
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
  info: { title: id, version },
  // C6: the only place a route names its scope; the kit asks for it before the route runs.
  components: { securitySchemes: { pat: { type: 'http', scheme: 'bearer' } } },
  paths: {
    '/api/v1/echo': {
      get: {
        operationId: 'echo',
        security: [{ pat: [`${id}:read`] }],
        parameters: parameters(EchoQuerySchema),
        responses: { '200': ok(z.object({ msg: z.string(), caller: z.string() })), '400': invalid },
      },
    },
    '/api/v1/ticks': {
      get: {
        operationId: 'ticks',
        security: [],
        parameters: parameters(TicksQuerySchema),
        responses: { '200': ok(z.array(TickSchema), PaginationSchema), '400': invalid },
      },
    },
  },
});

describe('openapi.json', () => {
  it('equals what the Zod schemas generate', () => {
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(generated());
  });

  // A route outside openapi.json would get no declared access once tokens are on (M3); no sub-routers.
  it('documents every route the api part serves, and nothing else', () => {
    const { stack } = create(createTestContext());
    expect(stack.filter((layer) => !layer.route).map((layer) => layer.name)).toEqual([]);
    const served = stack.flatMap(({ route }) =>
      route ? route.stack.map(({ method }) => `${method} /api/v1${route.path}`) : []
    );
    const documented = Object.entries(generated().paths).flatMap(([path, ops]) =>
      Object.keys(ops).map((method) => `${method} ${path}`)
    );
    expect(served.sort()).toEqual(documented.sort());
  });
});
