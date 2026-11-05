# CLAUDE.md - agentage/extension-probe

Public repo. The probe extension, the template every later extension copies; keep it minimal and
exactly on the kit's rules. Standards: the engineering standards batch (repo-baseline, typescript,
code-style, testing, ci-cd, backend, security); this file only adds what the tree does not say.

## Rules this repo proves (`src/manifest.test.ts` guards them)

- A part module exports `create(ctx)` and nothing else; `src/ui/index.ts` exports `widgets` only.
  Never `listen()`, `process.env`, a token check or an absolute agentage URL in `src/`.
- A part imports only its own folder and `src/lib/`: each image carries `dist/{part}` and
  `dist/lib` only, so a cross-part import would not start.
- No Dockerfile, no compose file: the kit tool builds `ghcr.io/agentage/probe-{part}:{version}`.
- The manifest is the `agentage` block of `package.json`.
- `probe.mcpc.json` and `openapi.json` are committed contracts: `src/mcp/index.test.ts` diffs the
  tool list from a 2025-11-25 and a 2026-07-28 client, `src/api/openapi.test.ts` the OpenAPI
  generated from the Zod schemas; `UPDATE_SNAPSHOT=1 npm test` rewrites both (bumping the version
  changes both).
- The release record `dist/agentage-extension.json` (images by digest) is written by
  `build --push` only, in `release.yml`; never by hand, never committed. `up` writes its own
  `.agentage/record.json` (ignored). `scripts/release-guard.sh` keeps a released version's images
  and record: never move a `v*` tag, release a new version.

## Commands

- `npm run verify`; `agentage extension up`, then `scripts/image-smoke.sh <commit>` and
  `npm run test:e2e` (the Playwright smoke and the widget axe test through `localhost:4280`);
  `agentage extension down` removes this working copy's compose project only (named in
  `.agentage/compose.json`, one per checkout), so scripts address it with `-f`, never `-p`
- no retries anywhere (`e2e/` and the gate): a flake is fixed at its cause; a test that needs
  the store boots it in `beforeAll` (PGlite's first use is a WASM boot), never inside a test's 5 s;
  the README's Verify section holds the counts a green run prints: change them with the tests
- `scripts/release-guard.sh` bounds every GitHub and registry call (`GUARD_TIMEOUT`, 60 s, then
  SIGKILL after 5 s; it refuses to run without GNU `timeout`); a timeout stops the release like
  any "cannot tell", it never counts as "not released"
- `@agentage/cli` is an exact devDependency: CI and the release run `node_modules/.bin/agentage`,
  so the cli and the kit tool that writes the image recipe are this lockfile's; a cli or kit patch
  reaches the images only through a probe commit (Dependabot's weekly group)
- to try an unreleased kit or widget: `npm pack` them from agentage/platform into `.kit/`
  (ignored) and `npm install ./.kit/*.tgz`, as platform CI does; never commit a tarball or a
  `file:` spec
