import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { imageParts, validateManifest } from '@agentage/extension';
import { describe, expect, it } from 'vitest';
import * as ui from './ui/index.js';

const SRC = new URL('.', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', SRC), 'utf8')) as {
  exports: Record<string, unknown>;
};

const sources = (): [string, string][] =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'))
    .map((file) => [file, readFileSync(new URL(file, SRC), 'utf8')]);

const relativeImports = (text: string): string[] =>
  [...text.matchAll(/from '(\.[^']+)'/g)].map((match) => match[1] ?? '');

describe('the manifest', () => {
  it('is a valid agentage manifest with all seven parts', () => {
    const manifest = validateManifest(pkg);
    expect(imageParts(manifest)).toEqual(['pages', 'ui', 'api', 'mcp', 'worker']);
    expect(manifest.agentage.parts).toEqual({
      ...{ pages: true, ui: true, api: true, mcp: true, worker: true, cli: true },
      store: 'postgres',
    });
    expect(manifest.agentage.commands?.map(({ name }) => name)).toEqual(['ping']);
  });

  it('ui exports its widgets map; the package exports no part code', () => {
    expect(Object.keys(ui)).toEqual(['widgets']);
    expect(Object.keys(pkg.exports)).toEqual(['./agentage-extension.json', './package.json']);
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
