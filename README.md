# extension-probe

The probe extension: one agentage extension with every part kind, the template every later
extension copies. Each part is only `create(ctx)` (the ui part a `widgets` map); the kit
[`@agentage/extension`](https://github.com/agentage/platform) owns servers, ports, `/health`,
discovery, the envelope, the store connection, the scheduler and the command line. There is no
Dockerfile and no compose file: the kit's tool builds one image per part and runs them locally.

| Part   | Source                                                                    | Serves                                                                                     |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| pages  | [`src/pages`](src/pages/index.ts)                                         | `/`: `probe {version} · {commit}`                                                          |
| ui     | [`src/ui`](src/ui/index.ts) (`<probe-echo>`, React on `@agentage/widget`) | `/ui/{version}/probe.js`, `harness.html`                                                   |
| api    | [`src/api`](src/api/index.ts)                                             | `GET /api/v1/echo?msg=` (`probe:read`), `GET /api/v1/ticks?limit=&cursor=`, `openapi.json` |
| mcp    | [`src/mcp`](src/mcp/index.ts)                                             | `POST /mcp`: `probe__echo` (`probe:read`; [`probe.mcpc.json`](probe.mcpc.json))            |
| worker | [`src/worker`](src/worker/index.ts)                                       | job `tick`, every minute, a row in `ticks`                                                 |
| store  | [`migrations/`](migrations), [`seeds/`](seeds)                            | postgres; the api image's `node dist/store/migrate.js` applies them                        |
| cli    | [`src/cli`](src/cli/index.ts)                                             | `agentage ping [msg]` prints `pong`                                                        |

## Install and run

Needs Node 22+, npm 10+, Docker, `git` and `jq`. On a clean machine, from nothing:

```bash
git clone https://github.com/agentage/extension-probe && cd extension-probe
npm ci                                   # the cli comes with it: npx agentage is the lockfile's
npx agentage extension up                # last line: ready    7 parts healthy    <n> s
echo "http://localhost:4280/ui/$(jq -r .version package.json)/harness.html"  # open, click ping: pong hi
curl -s localhost:4280/.well-known/agentage-extension.json
T=$(npx agentage extension token --scope probe:read)   # aga_... from the dev issuer on localhost:4281
curl -s -H "Authorization: Bearer $T" "localhost:4280/api/v1/echo?msg=hi"   # {"success":true,"data":{"msg":"hi","caller":"usr_dev"}}
npx agentage extension install .         # linked     @agentage/extension-probe (working copy)
npx agentage ping                        # pong
npx agentage extension down              # removed  8 containers · 1 network · 1 volume
```

A global `agentage` (0.42.0 or later) works the same as `npx agentage`. `up` builds the five part
images from the release recipe, writes `.agentage/record.json` from the local image digests (so
discovery is valid), starts postgres, runs the migrate job, the dev issuer (4281) and a Traefik
gateway (4280) with the URL layout of a deployment, then waits until every part is healthy and
prints `ready    7 parts healthy` and the seconds it took (15 to 35 s once the base images are pulled). Each checkout is
its own compose project, so `down` in one never touches another; a second checkout's `up` is
refused while the first holds 4280. On a kept volume (`down --keep-data`) the store line says
`1 migration already applied · 1 seed already applied`.

## Verify

What CI runs, in order, with the counts a green run prints (2026-11-06):

```bash
npm run verify                                     # 31 tests passed, coverage over 70 %
npx agentage extension check                       # six rules ok, PASS probe 0.4.1 conforms (6 rules)
npx agentage extension up                          # ready    7 parts healthy    <n> s
scripts/image-smoke.sh "$(git rev-parse HEAD)"     # 5 lines: PASS {part}  commit ...  ok
npx playwright install chromium                    # once; a bare Linux also needs --with-deps
npm run test:e2e                                   # 10 passed (smoke and the widget tests)
```

Then the gate of [agentage/e2e](https://github.com/agentage/e2e) (private: needs read access)
against the same `up`, from a checkout of that repo:

```bash
npm ci && npx playwright install --with-deps chromium
PROBE_DIR=/path/to/extension-probe npm run e2e -- probe gate local   # 55 passed, 5 skipped
```

`PROBE_DIR` lets the gate read `probe.mcpc.json`, `openapi.json` and the cli part from this
checkout; without it the cli part tests skip. The 5 skipped need a deployed release (the pinned
version, the release commit, the release record twice, the HTTPS redirect). CI fails a gate that
executed fewer than 30 tests or none of the cli part, and the job is bounded at 10 minutes (about 3
today).
Dependabot runs get no secrets, so they skip the agentage/e2e checkout and the gate (`up`, the
image smoke and `npm run test:e2e` still run).

## Release

A `v*` tag equal to the `package.json` version runs `.github/workflows/release.yml`: it builds and
pushes `ghcr.io/agentage/probe-{pages,ui,api,mcp,worker}:{version}`, attaches the build record with
the five digests to the GitHub release as `agentage-extension.json`, and publishes
`@agentage/extension-probe` to npm with provenance. A version's images never change: a re-run keeps
the released images and record and only retries npm, and a tag moved to another commit is refused
(`scripts/release-guard.sh`); a fix ships as a new version.
