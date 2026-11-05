# extension-probe

The probe extension: one agentage extension with every part kind, the template every later
extension copies. Each part is only `create(ctx)` (the ui part a `widgets` map); the kit
[`@agentage/extension`](https://github.com/agentage/platform) owns servers, ports, `/health`,
discovery, the envelope, the store connection, the scheduler and the command line. There is no
Dockerfile and no compose file: the kit's tool builds one image per part and runs them locally.

| Part   | Source                                                                    | Serves                                                                          |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| pages  | [`src/pages`](src/pages/index.ts)                                         | `/`: `probe {version} · {commit}`                                               |
| ui     | [`src/ui`](src/ui/index.ts) (`<probe-echo>`, React on `@agentage/widget`) | `/ui/{version}/probe.js`, `harness.html`                                        |
| api    | [`src/api`](src/api/index.ts)                                             | `GET /api/v1/echo?msg=`, `GET /api/v1/ticks?limit=&cursor=`, `openapi.json`     |
| mcp    | [`src/mcp`](src/mcp/index.ts)                                             | `POST /mcp`: tool `probe__echo` (snapshot [`probe.mcpc.json`](probe.mcpc.json)) |
| worker | [`src/worker`](src/worker/index.ts)                                       | job `tick`, every minute, a row in `ticks`                                      |
| store  | [`migrations/`](migrations), [`seeds/`](seeds)                            | postgres; the api image's `node dist/store/migrate.js` applies them             |
| cli    | [`src/cli`](src/cli/index.ts)                                             | `agentage ping [msg]` prints `pong`                                             |

## Install and run

Needs Node 22+ and Docker.

```bash
npm ci
agentage extension up          # until cli 0.41: node node_modules/@agentage/extension/dist/tool/cli.js up
open http://localhost:4280/ui/0.2.0/harness.html   # click ping: pong hi
curl -s localhost:4280/.well-known/agentage-extension.json
agentage extension token --scope probe:read        # a dev token from localhost:4281
agentage extension install . && agentage ping      # pong
agentage extension down        # --keep-data keeps the store volume
```

`up` builds the five part images from the release recipe, writes `.agentage/record.json` from the
local image digests (so discovery is valid), starts postgres, runs the migrate job, the dev issuer
(4281) and a Traefik gateway (4280) with the URL layout of a deployment, then waits until every part
is healthy and prints `ready 7 parts healthy`.

## Verify

```bash
npm run verify                         # unit: every part on createTestContext, a throwaway store
agentage extension up && scripts/image-smoke.sh "$(git rev-parse HEAD)" && npm run test:e2e
```

CI runs both, then the `agentage/e2e` gate against the same `up`: `npm run e2e -- probe gate local`.

## Release

A `v*` tag equal to the `package.json` version runs `.github/workflows/release.yml`: it builds and
pushes `ghcr.io/agentage/probe-{pages,ui,api,mcp,worker}:{version}`, attaches the build record with
the five digests to the GitHub release as `agentage-extension.json`, and publishes
`@agentage/extension-probe` to npm with provenance. A version's images never change: a re-run keeps
the released images and record and only retries npm, and a tag moved to another commit is refused
(`scripts/release-guard.sh`); a fix ships as a new version.
