import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const GUARD = new URL('./release-guard.sh', import.meta.url).pathname;
const SHA = 'a'.repeat(40);
const RECORD = { id: 'probe', version: '0.1.0', commit: SHA, parts: {} };

// gh hands out the released record when one is given; docker knows only the images given.
const SHIMS = {
  gh: '[ -f "$FAKE_RECORD" ] && cat "$FAKE_RECORD"',
  docker: 'case " $FAKE_IMAGES " in *" $3 "*) exit 0 ;; esac\nexit 1',
};

interface Released {
  record?: object;
  images?: string[];
}

const guard = ({ record, images = [] }: Released, commit = SHA) => {
  const dir = mkdtempSync(join(tmpdir(), 'release-guard-'));
  mkdirSync(join(dir, 'bin'));
  for (const [name, text] of Object.entries(SHIMS)) {
    writeFileSync(join(dir, 'bin', name), `#!/bin/sh\n${text}\n`);
    chmodSync(join(dir, 'bin', name), 0o755);
  }
  const parts = { api: true, cli: false, store: 'postgres' };
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ agentage: { id: 'probe', parts } }));
  if (record) writeFileSync(join(dir, 'released.json'), `${JSON.stringify(record, null, 2)}\n`);
  const env = {
    ...process.env,
    PATH: `${join(dir, 'bin')}:${process.env['PATH'] ?? ''}`,
    FAKE_RECORD: join(dir, 'released.json'),
    FAKE_IMAGES: images.join(' '),
  };
  const run = spawnSync('bash', [GUARD, 'v0.1.0', commit], { cwd: dir, env, encoding: 'utf8' });
  return { dir, code: run.status, out: run.stdout.trim(), err: run.stderr.trim() };
};

describe('release guard', () => {
  it('builds a version with no release and no image', () => {
    expect(guard({})).toMatchObject({ code: 0, out: 'build' });
  });

  it('reuses the released record on a re-run of the same commit', () => {
    const run = guard({ record: RECORD, images: ['ghcr.io/agentage/probe-api:0.1.0'] });
    expect(run).toMatchObject({ code: 0, out: 'reuse' });
    const kept = readFileSync(join(run.dir, 'dist', 'agentage-extension.json'), 'utf8');
    expect(kept).toBe(`${JSON.stringify(RECORD, null, 2)}\n`);
  });

  it('refuses a tag moved to another commit', () => {
    const run = guard({ record: RECORD }, 'b'.repeat(40));
    expect(run.code).toBe(1);
    expect(run.err).toContain(`v0.1.0 was released from ${SHA}`);
  });

  it('refuses an image already pushed without a record', () => {
    const run = guard({ images: ['ghcr.io/agentage/probe-api:0.1.0'] });
    expect(run.code).toBe(1);
    expect(run.err).toContain('ghcr.io/agentage/probe-api:0.1.0 is already pushed');
  });
});
