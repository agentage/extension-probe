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
  `npm run test:e2e` (the Playwright smoke through `localhost:4280`)
- until cli 0.41 is on npm, the kit's own tool: `node node_modules/@agentage/extension/dist/tool/cli.js
build|up|down|token` (the TEMPORARY branch in both workflows; delete it once cli 0.41 is published)
- before kit 0.2.0 and `@agentage/widget` are on npm: `npm pack` them from agentage/platform into
  `.kit/` (ignored) and `npm install ./.kit/*.tgz`; never commit a tarball or a `file:` spec
