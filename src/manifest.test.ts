import { readFileSync } from 'node:fs';
import { imageParts, validateManifest } from '@agentage/extension';
import { describe, expect, it } from 'vitest';
import * as api from './api/index.js';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as unknown;

describe('probe manifest', () => {
  it('is a valid agentage manifest with the api part only', () => {
    const manifest = validateManifest(pkg);
    expect(manifest.agentage.id).toBe('probe');
    expect(imageParts(manifest)).toEqual(['api']);
  });

  it('the api part exports create(ctx) and nothing else', () => {
    expect(Object.keys(api)).toEqual(['create']);
  });
});
