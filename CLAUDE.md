# CLAUDE.md - agentage/extension-probe

Public repo. The probe extension: it has every part kind and the shape every later extension
copies. Keep it minimal and exactly on the kit's rules. The human guide is [README.md](README.md):
run, verify and release. This file adds only what the tree does not say.

## Where facts live

- The parts at a glance, the kit: `README.md` "Parts".
- api routes, scopes, limits, `emit` `exit`/`fail`: `docs/parts.md` "api"; proof `openapi.json` (generated).
- The MCP tool and its input: `docs/parts.md` "mcp"; proof `probe.mcpc.json` (generated).
- pages, ui, worker, cli: `docs/parts.md` "pages", "ui", "worker", "cli"; proof `src/{part}/index.ts`.
- Database, seeds, the migrate entry: `docs/parts.md` "store"; proof `migrations/`, `seeds/`.
- Clone commands and tokens: `README.md` "Run it from a clone"; what `up` does, ports: `docs/develop.md` "Run it from a clone".
- What CI runs: `README.md` "Verify"; the e2e gate, `MIN_EXECUTED`: `docs/develop.md` "Verify"; proof `.github/workflows/ci.yml`.
- Release steps and refusals: `README.md` "Release"; proof `.github/workflows/release.yml`.
- The manifest, commands, settings and secrets: the `agentage` block of `package.json`.

Read the file named here before you read `src/`.

## Rules this repo proves (the kit's `agentage extension check` and `src/manifest.test.ts`)

- A part module exports `create(ctx)` and nothing else; `src/ui/index.ts` exports `widgets` only.
  Never `listen()`, the `process` global, a token check or an absolute agentage URL in `src/`.
- A part imports only its own folder and `src/lib/`: each image carries `dist/{part}` and
  `dist/lib` only, so a cross-part import would not start.
- No Dockerfile, no compose file: the kit tool builds `ghcr.io/agentage/probe-{part}:{version}`.
- The manifest is the `agentage` block of `package.json`.
- `probe.mcpc.json` and `openapi.json` are committed contracts: `src/mcp/index.test.ts` diffs the
  tool list from a 2025-11-25 and a 2026-07-28 client, `src/api/openapi.test.ts` the OpenAPI
  generated from the Zod schemas. Regenerate with `npx agentage extension check --write` and `npm run format`.
  The release steps are in the README.
- The release record `dist/agentage-extension.json` (images by digest) is written by
  `build --push` only, in `release.yml`; never by hand, never committed. `up` writes its own
  `.agentage/record.json` (ignored). `agentage extension release` keeps a released version's images
  and record: never move a `v*` tag, release a new version.

## Commands

- `npm run verify`; `agentage extension up` (asserts each part's `/health` body), then
  `npm run test:e2e` (the Playwright smoke and the widget axe test through `localhost:4280`);
  `agentage extension down` removes this working copy's compose project only (named in
  `.agentage/compose.json`, one per checkout), so scripts address it with `-f`, never `-p`
- a flake is fixed at its cause: the gate runs with no retries, `e2e/` retries once in CI only to
  keep a trace and fails a test that passed on it (`failOnFlakyTests`); a test that needs
  the store boots it in `beforeAll` (PGlite's first use is a WASM boot), never inside a test's 5 s.
- `@agentage/cli` is an exact devDependency: CI and the release run `node_modules/.bin/agentage`,
  so the cli and the kit tool that writes the image recipe are this lockfile's; a cli or kit patch
  reaches the images only through a probe commit (Dependabot's weekly group)
- to try an unreleased kit or widget: `npm pack` them from agentage/platform into `.kit/`
  (ignored) and `npm install ./.kit/*.tgz`, as platform CI does; never commit a tarball or a
  `file:` spec
