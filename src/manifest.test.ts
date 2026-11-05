import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { imageParts, validateManifest } from '@agentage/extension';
import { describe, expect, it } from 'vitest';
import * as api from './api/index.js';
import * as cli from './cli/index.js';
import * as mcp from './mcp/index.js';
import * as pages from './pages/index.js';
import * as ui from './ui/index.js';
import * as worker from './worker/index.js';

const SRC = new URL('.', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', SRC), 'utf8')) as {
  exports: Record<string, unknown>;
  dependencies: Record<string, string>;
};

const sources = (): [string, string][] =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'))
    .map((file) => [file, readFileSync(new URL(file, SRC), 'utf8')]);

const relativeImports = (text: string): string[] =>
  [...text.matchAll(/from '(\.[^']+)'/g)].map((match) => match[1] ?? '');

describe('probe manifest', () => {
  it('is a valid agentage manifest with all seven parts', () => {
    const manifest = validateManifest(pkg);
    expect(manifest.agentage.id).toBe('probe');
    expect(imageParts(manifest)).toEqual(['pages', 'ui', 'api', 'mcp', 'worker']);
    expect(manifest.agentage.parts).toMatchObject({ cli: true, store: 'postgres' });
  });

  it('every part exports create(ctx) and nothing else; ui exports its widgets map', () => {
    for (const part of [api, cli, mcp, pages, worker])
      expect(Object.keys(part)).toEqual(['create']);
    expect(Object.keys(ui)).toEqual(['widgets']);
  });

  it('the package exports no part code and depends on no other extension', () => {
    expect(Object.keys(pkg.exports)).toEqual(['./agentage-extension.json', './package.json']);
    expect(Object.keys(pkg.dependencies).filter((name) => name.includes('extension-'))).toEqual([]);
  });

  it('part code is sealed: no listen(), process.env or argv, no absolute agentage URL', () => {
    const sealing = /\.listen\(|process\.(env|argv)|https?:\/\/[^'"`\s]*agentage\.io/;
    expect(sources().filter(([, text]) => sealing.test(text))).toEqual([]);
    expect(sources().length).toBeGreaterThan(7);
  });

  it('a part imports only its own folder and src/lib: each image carries just those', () => {
    const crossing = sources().flatMap(([file, text]) => {
      const part = file.split(/[\\/]/)[0] ?? '';
      return relativeImports(text)
        .map((spec) => normalize(join(dirname(file), spec)).split(/[\\/]/)[0] ?? '')
        .filter((target) => target !== part && target !== 'lib')
        .map((target) => `${file} -> ${target}`);
    });
    expect(crossing).toEqual([]);
  });
});
