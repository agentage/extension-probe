# extension-probe

The probe extension: one agentage extension with every part kind, the template every later
extension copies. Today it has the api part: `GET /api/v1/echo?msg=hi` answers
`{"success":true,"data":{"msg":"hi"}}` in the standard envelope, with an `agcid` header. The part
code is only `create(ctx)` in [`src/api/index.ts`](src/api/index.ts); the kit
[`@agentage/extension`](https://github.com/agentage/platform) owns the server, `/health`, the
discovery document and the envelope. There is no Dockerfile: the kit's build tool builds the image.

## Install

```bash
npm ci
npm run build
```

## Run the image locally

```bash
node node_modules/@agentage/extension/dist/tool/cli.js build   # or: agentage extension build
docker run --rm --network host ghcr.io/agentage/probe-api:0.1.0
curl -s 127.0.0.1:3000/health                     # loopback only; commit = the build commit
curl -s '127.0.0.1:3000/api/v1/echo?msg=hi'
curl -s 127.0.0.1:3000/.well-known/agentage-extension.json
```

## Verify

```bash
npm run verify
npm run test:e2e   # smoke: boots dist/ with the kit's image entry, no secrets
PROBE_BASE_URL=http://127.0.0.1:3000 npm run test:e2e   # the same suite against a running image
```

## Release

A `v*` tag equal to the `package.json` version runs `.github/workflows/release.yml`: it builds and
pushes `ghcr.io/agentage/probe-api:{version}`, attaches the build record with the image digests to
the GitHub release as `agentage-extension.json`, and publishes `@agentage/extension-probe` to npm
with provenance. A version's images never change: a re-run keeps the released images and record
and only retries npm, and a tag moved to another commit is refused (`scripts/release-guard.sh`);
a fix ships as a new version.
