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
  `build --push` only, in `release.yml`; never by hand, never committed.

## Commands

- `npm run verify`; the kit tool: `agentage extension build [--push]`, or from a platform checkout
  `node ../platform/packages/extension/dist/tool/cli.js build --dir .`

## TEMPORARY until the kit and the cli 0.41 are on npm

- `scripts/kit-lock.mjs local <tgz>` points `@agentage/extension` at a packed kit, `registry`
  points it back; the committed `package.json` and lockfile always hold the registry form.
- `ci.yml` and `release.yml` check out agentage/platform at `PLATFORM_SHA` when the packages are
  not on npm. Remove the steps marked TEMPORARY and this section once both are published.
