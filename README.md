# extension-probe

The probe extension: a small agentage extension that has every part kind. It is for extension
authors, as the proof that the shape works, and for the maintainers' tests. To start your own
extension, use `npx @agentage/cli@latest extension create <id>`; the starting point is
[agentage/extension-template](https://github.com/agentage/extension-template).

To use only its command, with no clone and no Docker (no sign-in either):

```bash
agentage extension install probe    # from npm: @agentage/extension-probe
agentage ping                       # pong
```

A **part** is one folder of the extension that does one job: `pages`, `ui`, `api`, `mcp`, `worker`,
`cli`, plus `store` (postgres). Each part is only `create(ctx)` (the ui part a `widgets` map). The
**kit**, the library [`@agentage/extension`](https://github.com/agentage/platform), owns servers,
ports, `/health`, discovery, the response envelope, the store connection, the scheduler and the
command line. There is no Dockerfile and no compose file: the kit's tool builds one image per part
and runs them locally.

| Part   | Source                                                                    | Serves                                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pages  | [`src/pages`](src/pages/index.ts)                                         | `/`: `probe {version} · {commit}`                                                                                                                                                                                                                                                                                            |
| ui     | [`src/ui`](src/ui/index.ts) (`<probe-echo>`, React on `@agentage/widget`) | `/ui/{version}/probe.js`, `harness.html`                                                                                                                                                                                                                                                                                     |
| api    | [`src/api`](src/api/index.ts)                                             | `GET /api/v1/echo?msg=` (`probe:read`; msg 1 to 200 characters), `GET /api/v1/ticks?limit=&cursor=` (newest first; default limit 50, above 200 is clamped to 200), `POST /api/v1/emit` (`probe:write`; `exit` ends the part cleanly after its 202, the estate restarts it, local `up` does not: run it last), `openapi.json` |
| mcp    | [`src/mcp`](src/mcp/index.ts)                                             | `POST /mcp`: `probe__echo` (`probe:read`; msg up to 200 characters, answers `pong <msg>`; [`probe.mcpc.json`](probe.mcpc.json))                                                                                                                                                                                              |
| worker | [`src/worker`](src/worker/index.ts)                                       | job `tick`, every minute, one row in `ticks`                                                                                                                                                                                                                                                                                 |
| store  | [`migrations/`](migrations), [`seeds/`](seeds)                            | postgres; the api image's `node dist/store/migrate.js` applies them                                                                                                                                                                                                                                                          |
| cli    | [`src/cli`](src/cli/index.ts)                                             | `agentage ping [msg]` prints `pong`                                                                                                                                                                                                                                                                                          |

## Run it from a clone

Needs Node 22 or newer, npm 10 or newer, Docker and git. Nothing needs a sign-in.

```bash
git clone https://github.com/agentage/extension-probe && cd extension-probe
npm ci                                   # the cli comes with it: npx agentage is the lockfile's
npx agentage extension up                # last line: ready    7 parts healthy    <n> s
# open http://localhost:4280/ui/<version>/harness.html (version from package.json), click ping
curl -s localhost:4280/.well-known/agentage-extension.json
T=$(npx agentage extension token --scope probe:read)   # from the dev issuer on localhost:4281
curl -s -H "Authorization: Bearer $T" "localhost:4280/api/v1/echo?msg=hi"
npx agentage extension install .         # linked: the working copy
npx agentage ping                        # pong
npx agentage extension down              # removes the containers, network and volume
```

Use `npx agentage` inside the clone. A global `agentage` can be older than the pinned one and lack
`extension up`.

- **7 parts** is what `up` reports. Five run as containers: pages, ui, api, mcp and worker.
  `store` runs as postgres, and `cli` runs on your machine with no container.
- `up` builds the five part images from the release recipe and writes `.agentage/record.json`
  from the local image digests, so discovery is valid. It starts postgres, runs the migrate job,
  the dev issuer (4281) and a Traefik gateway (4280) with the URL layout of a deployment. It waits
  until every part is healthy.
- Each checkout is its own compose project, so `down` in one never touches another. A second
  checkout's `up` is refused while the first holds port 4280 or 4281.
- On a kept volume (`down --keep-data`) the store line says
  `1 migration already applied · 1 seed already applied`.

## Verify

What CI runs, in order:

```bash
npm run verify                    # type-check, lint, format, tests with coverage, build
npx agentage extension check      # six rules; PASS probe <version> conforms
npx agentage extension up         # each part's /health body is asserted
npx playwright install chromium   # once; a bare Linux also needs --with-deps
npm run test:e2e                  # smoke and the widget tests
```

CI then runs the gate of agentage/e2e against the same `up`. That repository is private, so only
maintainers run the gate. With `up` running, from a checkout of agentage/e2e:

```bash
npm ci && npx playwright install --with-deps chromium
PROBE_DIR=/path/to/extension-probe npm run e2e -- probe gate local
```

`PROBE_DIR` lets the gate read `probe.mcpc.json`, `openapi.json` and the cli part from this
checkout. Some gate tests skip locally: they need a deployed release.

CI fails a gate that ran fewer tests than `MIN_EXECUTED` in `.github/workflows/ci.yml`, or none of
the cli part. The job is bounded at 10 minutes. Dependabot runs get no secrets, so they skip the
agentage/e2e checkout and the gate; `up` and `npm run test:e2e` still run.

## Release

A `v*` tag equal to the `package.json` version runs `.github/workflows/release.yml`: it builds and
pushes `ghcr.io/agentage/probe-{pages,ui,api,mcp,worker}:{version}`, attaches the build record with
the five image digests to the GitHub release as `agentage-extension.json`, and publishes
`@agentage/extension-probe` to npm with provenance. A version's images never change: a re-run keeps
the released images and record and only retries npm, and a tag moved to another commit is refused
(`agentage extension release`); a fix ships as a new version.

To release: bump `version` in `package.json`, run `npx agentage extension check --write` and
`npm run format`, commit, tag `v<version>`.
