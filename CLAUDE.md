# CLAUDE.md - agentage/extension-probe

Public repo. The probe extension, the template every later extension copies; keep it minimal and
exactly on the kit's rules. Standards: the engineering standards batch (repo-baseline, typescript,
code-style, testing, ci-cd, backend, security); this file only adds what the tree does not say.

## Rules this repo proves

- A part module exports `create(ctx)` and nothing else (`src/manifest.test.ts` guards it); never
  `listen()`, `process.env`, a token check or an absolute agentage URL in `src/`.
- No Dockerfile, no compose file: the kit tool builds `ghcr.io/agentage/probe-{part}:{version}`.
- The manifest is the `agentage` block of `package.json`; parts not built yet stay out of it.
- The release record `dist/agentage-extension.json` (images by digest) is written by
  `build --push` only, in `release.yml`; never by hand, never committed. The estate deploys from
  the release asset, so `scripts/release-guard.sh` keeps a released version's images and record:
  never move a `v*` tag, release a new version.

## Commands

- `npm run verify`; `npm run test:e2e` is the Playwright smoke (`e2e/`), hermetic by default,
  against a running image with `PROBE_BASE_URL` (CI does this after building the image)
- the kit tool: `agentage extension build [--push]`; until cli 0.41 is on npm,
  `node node_modules/@agentage/extension/dist/tool/cli.js build` (the TEMPORARY branch in both
  workflows; delete it once cli 0.41 is published)
