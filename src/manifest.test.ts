import { readdirSync, readFileSync } from 'node:fs';
import { imageParts, validateManifest } from '@agentage/extension';
import { describe, expect, it } from 'vitest';
import * as api from './api/index.js';

const SRC = new URL('.', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', SRC), 'utf8')) as unknown;

const partSources = (): [string, string][] =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => [file, readFileSync(new URL(file, SRC), 'utf8')]);

describe('probe manifest', () => {
  it('is a valid agentage manifest with the api part only', () => {
    const manifest = validateManifest(pkg);
    expect(manifest.agentage.id).toBe('probe');
    expect(imageParts(manifest)).toEqual(['api']);
  });

  it('the api part exports create(ctx) and nothing else', () => {
    expect(Object.keys(api)).toEqual(['create']);
  });

  it('part code is sealed: no listen(), process.env or argv, no absolute agentage URL', () => {
    const sealing = /\.listen\(|process\.(env|argv)|https?:\/\/[^'"`\s]*agentage\.io/;
    expect(partSources().filter(([, text]) => sealing.test(text))).toEqual([]);
    expect(partSources().length).toBeGreaterThan(0);
  });
});
