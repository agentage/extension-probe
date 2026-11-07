import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const GUARD = new URL('./release-guard.sh', import.meta.url).pathname;
const SHA = 'a'.repeat(40);
const { id } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).agentage;
const RECORD = { id, version: '0.1.0', commit: SHA, parts: {} };
const API = `ghcr.io/agentage/${id}-api:0.1.0`;
const PAGES = `ghcr.io/agentage/${id}-pages:0.1.0`; // the first image part the guard asks about

// gh and docker answer as the real ones do (messages checked against both); FAKE_*_ERROR overrides.
const SHIMS = {
  gh: [
    '[ -n "$FAKE_GH_SLEEP" ] && sleep "$FAKE_GH_SLEEP"',
    '[ -n "$FAKE_GH_ERROR" ] && { echo "$FAKE_GH_ERROR" >&2; exit 1; }',
    '[ -f "$FAKE_RECORD" ] && { cat "$FAKE_RECORD"; exit 0; }',
    'echo "release not found" >&2; exit 1',
  ],
  docker: [
    '[ -n "$FAKE_DOCKER_SLEEP" ] && sleep "$FAKE_DOCKER_SLEEP"',
    '[ -n "$FAKE_DOCKER_ERROR" ] && { echo "$FAKE_DOCKER_ERROR" >&2; exit 1; }',
    'case " $FAKE_IMAGES " in *" $3 "*) exit 0 ;; esac',
    'echo "manifest unknown" >&2; exit 1',
  ],
};

// Only the tools the guard needs, timeout left out: how it runs on a machine without coreutils.
const pathWithoutTimeout = (dir: string): string => {
  const tools = join(dir, 'tools');
  mkdirSync(tools);
  for (const tool of ['bash', 'jq', 'mktemp', 'grep', 'cat', 'rm', 'mkdir']) {
    const found = execFileSync('bash', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).trim();
    symlinkSync(found, join(tools, tool));
  }
  return `${join(dir, 'bin')}:${tools}`;
};

interface Released {
  record?: object;
  images?: string[];
  ghError?: string;
  dockerError?: string;
  ghSleep?: string;
  dockerSleep?: string;
  noTimeout?: boolean;
}

const guard = (released: Released, args = ['v0.1.0', SHA]) => {
  const dir = mkdtempSync(join(tmpdir(), 'release-guard-'));
  mkdirSync(join(dir, 'bin'));
  for (const [name, lines] of Object.entries(SHIMS)) {
    writeFileSync(join(dir, 'bin', name), `#!/bin/sh\n${lines.join('\n')}\n`);
    chmodSync(join(dir, 'bin', name), 0o755);
  }
  const parts = {
    pages: true,
    ui: true,
    api: true,
    mcp: true,
    worker: true,
    cli: true,
    store: 'postgres',
  };
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ agentage: { id, parts } }));
  const { record, images = [] } = released;
  if (record) writeFileSync(join(dir, 'released.json'), `${JSON.stringify(record, null, 2)}\n`);
  const env = {
    ...process.env,
    PATH: released.noTimeout
      ? pathWithoutTimeout(dir)
      : `${join(dir, 'bin')}:${process.env['PATH'] ?? ''}`,
    FAKE_RECORD: join(dir, 'released.json'),
    FAKE_IMAGES: images.join(' '),
    FAKE_GH_ERROR: released.ghError ?? '',
    FAKE_DOCKER_ERROR: released.dockerError ?? '',
    FAKE_GH_SLEEP: released.ghSleep ?? '',
    FAKE_DOCKER_SLEEP: released.dockerSleep ?? '',
    GUARD_TIMEOUT: '1',
  };
  const bash = released.noTimeout ? join(dir, 'tools', 'bash') : 'bash';
  const run = spawnSync(bash, [GUARD, ...args], { cwd: dir, env, encoding: 'utf8' });
  return { dir, code: run.status, out: run.stdout.trim(), err: run.stderr.trim() };
};

describe('release guard', () => {
  it('builds a version with no release and no image', () => {
    expect(guard({})).toMatchObject({ code: 0, out: 'build', err: '' });
  });

  it('builds when the release exists with no record yet (a fresh tag)', () => {
    expect(guard({ ghError: 'no assets to download' })).toMatchObject({ code: 0, out: 'build' });
  });

  it('builds the first image of a part when the registry denies a package it has never seen', () => {
    expect(
      guard({ dockerError: 'Get "https://ghcr.io/v2/x/manifests/0.1.0": denied' })
    ).toMatchObject({ code: 0, out: 'build' });
  });

  it('reuses the released record on a re-run of the same commit', () => {
    const run = guard({ record: RECORD, images: [API] });
    expect(run).toMatchObject({ code: 0, out: 'reuse' });
    const kept = readFileSync(join(run.dir, 'dist', 'agentage-extension.json'), 'utf8');
    expect(kept).toBe(`${JSON.stringify(RECORD, null, 2)}\n`);
  });

  it('refuses a tag moved to another commit', () => {
    const run = guard({ record: RECORD }, ['v0.1.0', 'b'.repeat(40)]);
    expect(run.code).toBe(1);
    expect(run.err).toContain(`v0.1.0 was released from ${SHA}`);
  });

  it('refuses an image already pushed without a record, whichever part it is', () => {
    for (const image of [API, `ghcr.io/agentage/${id}-worker:0.1.0`]) {
      const run = guard({ images: [image] });
      expect(run).toMatchObject({ code: 1, out: '' });
      expect(run.err).toBe(
        `release-guard: ${image} is already pushed but v0.1.0 has no record; release a new version`
      );
    }
  });

  it('stops when GitHub or the registry cannot answer, instead of rebuilding', () => {
    const gh = guard({ ghError: 'HTTP 401: Bad credentials' });
    expect(gh).toMatchObject({ code: 1, out: '' });
    expect(gh.err).toContain('cannot tell whether the v0.1.0 release record exists');
    expect(gh.err).toContain('HTTP 401: Bad credentials');
    const registry = guard({ dockerError: 'received unexpected HTTP status: 503' });
    expect(registry).toMatchObject({ code: 1, out: '' });
    expect(registry.err).toContain(`cannot tell whether ${PAGES} exists`);
  });

  it('stops on a GitHub or registry call that hangs, naming the timeout', () => {
    const gh = guard({ ghSleep: '5' });
    expect(gh).toMatchObject({ code: 1, out: '' });
    expect(gh.err).toContain('cannot tell whether the v0.1.0 release record exists');
    expect(gh.err).toContain('timed out after 1 s');
    const registry = guard({ dockerSleep: '5' });
    expect(registry).toMatchObject({ code: 1, out: '' });
    expect(registry.err).toContain(`cannot tell whether ${PAGES} exists`);
    expect(registry.err).toContain('timed out after 1 s');
  });

  it('refuses to run where timeout is missing, rather than call GitHub unbounded', () => {
    const run = guard({ noTimeout: true });
    expect(run).toMatchObject({ code: 1, out: '' });
    expect(run.err).toContain('timeout (GNU coreutils) is not on PATH');
  });

  it('says how to call it', () => {
    const run = guard({}, ['v0.1.0']);
    expect(run).toMatchObject({ code: 1, out: '' });
    expect(run.err).toContain('usage: scripts/release-guard.sh <tag> <commit>');
  });
});
