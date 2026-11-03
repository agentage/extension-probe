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

Until `@agentage/extension` is on npm, install it from a packed kit (see `scripts/kit-lock.mjs`):

```bash
(cd ../platform && npm ci && npm run build && npm pack -w @agentage/extension --pack-destination ../extension-probe/.kit)
node scripts/kit-lock.mjs local .kit/agentage-extension-0.1.0.tgz && npm ci
node scripts/kit-lock.mjs registry   # before committing
```

## Run the image locally

```bash
node ../platform/packages/extension/dist/tool/cli.js build     # or: agentage extension build
docker run --rm --network host ghcr.io/agentage/probe-api:0.1.0
curl -s 127.0.0.1:3000/health                     # loopback only; commit = the build commit
curl -s '127.0.0.1:3000/api/v1/echo?msg=hi'
curl -s 127.0.0.1:3000/.well-known/agentage-extension.json
```

## Verify

```bash
npm run verify
```

## Release

A `v*` tag equal to the `package.json` version runs `.github/workflows/release.yml`: it builds and
pushes `ghcr.io/agentage/probe-api:{version}`, attaches the build record with the image digests to
the GitHub release as `agentage-extension.json`, and publishes `@agentage/extension-probe` to npm
with provenance.
