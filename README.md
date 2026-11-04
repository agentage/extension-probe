# extension-probe

The probe extension: one agentage extension with every part kind, the template every later
extension copies. Today it has the api part: `GET /api/v1/echo?msg=hi` answers
`{"success":true,"data":{"msg":"hi"}}` in the standard envelope, with an `agcid` header. The part
code is only `create(ctx)` in [`src/api/index.ts`](src/api/index.ts); the kit
[`@agentage/extension`](https://github.com/agentage/platform) owns the server, `/health`, the
discovery document and the envelope. There is no Dockerfile: the kit's build tool builds the image.

## Install and run

Needs Node 22+; Docker only for the image.

```bash
npm ci
npm run build
PORT=3000 node node_modules/@agentage/extension/dist/runtime/main.js api   # what the image runs
curl -s '127.0.0.1:3000/api/v1/echo?msg=hi'
curl -s 127.0.0.1:3000/health                    # loopback only; commit is zeros outside an image
curl -s 127.0.0.1:3000/.well-known/agentage-extension.json
```

## Run the image

```bash
node node_modules/@agentage/extension/dist/tool/cli.js build   # or: agentage extension build
docker run -d --name probe-api -p 3000:3000 ghcr.io/agentage/probe-api:0.1.0
curl -s '127.0.0.1:3000/api/v1/echo?msg=hi'
docker exec probe-api wget -qO- 127.0.0.1:3000/health   # 404 through -p: /health is loopback only
docker rm -f probe-api
```

## Verify

```bash
npm run verify
npm run test:e2e   # smoke: boots dist/ with the kit's image entry, no secrets
docker run -d --name probe-api --network host ghcr.io/agentage/probe-api:0.1.0
COMMIT_SHA=$(git rev-parse HEAD) PROBE_BASE_URL=http://127.0.0.1:3000 npm run test:e2e   # the image
docker rm -f probe-api
```

## Release

A `v*` tag equal to the `package.json` version runs `.github/workflows/release.yml`: it builds and
pushes `ghcr.io/agentage/probe-api:{version}`, attaches the build record with the image digests to
the GitHub release as `agentage-extension.json`, and publishes `@agentage/extension-probe` to npm
with provenance. A version's images never change: a re-run keeps the released images and record
and only retries npm, and a tag moved to another commit is refused (`scripts/release-guard.sh`);
a fix ships as a new version.
