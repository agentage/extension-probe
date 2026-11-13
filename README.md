# extension-probe

The probe is a small agentage extension that has one of every part kind. Extension authors use it
as proof that the shape works. Maintainers test with it. To start your own
extension, run `npx @agentage/cli@latest extension create <id>` or copy
[agentage/extension-template](https://github.com/agentage/extension-template).

## Use its command

You need the agentage command line, installed globally. You do not need a clone, Docker or a
sign-in.

```bash
npm install -g @agentage/cli
agentage extension install probe    # installs @agentage/extension-probe from npm
agentage ping                       # prints pong
```

## Parts

A part is one folder of the extension that does one job. Each part exports only `create(ctx)`.
The ui part exports a `widgets` map instead. The kit is the library
[`@agentage/extension`](https://github.com/agentage/platform). It owns the servers, ports,
`/health` and discovery. It also owns the response format, the store connection, the scheduler and
the command line. The repo has no Dockerfile and no compose file: the kit's tool builds one image
per part.

| Part   | Serves                                                                       |
| ------ | ---------------------------------------------------------------------------- |
| pages  | `/`: `probe {version} · {commit}`                                            |
| ui     | `/ui/{version}/probe.js`, `harness.html`                                     |
| api    | `GET /api/v1/echo`, `GET /api/v1/ticks`, `POST /api/v1/emit`, `openapi.json` |
| mcp    | `POST /mcp`: tool `probe__echo`                                              |
| worker | job `tick`, one row in `ticks` per minute                                    |
| store  | postgres                                                                     |
| cli    | `agentage ping [msg]`                                                        |

More: [docs/parts.md](docs/parts.md)

## Run it from a clone

You need Node 22 or newer, npm 10 or newer, Docker and git. Nothing needs a sign-in.

```bash
git clone https://github.com/agentage/extension-probe && cd extension-probe
npm ci                                   # installs the cli pinned in the lockfile
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

`up` reports 7 parts. Five run as containers: pages, ui, api, mcp and worker. `store` runs as
postgres. `cli` runs on your machine with no container.

More: [docs/develop.md](docs/develop.md#run-it-from-a-clone)

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
maintainers run the gate.

More: [docs/develop.md](docs/develop.md#verify)

## Release

A `v*` tag runs `.github/workflows/release.yml`. It builds and pushes
`ghcr.io/agentage/probe-{pages,ui,api,mcp,worker}:{version}`. It attaches the build record with the
five image digests to the GitHub release as `agentage-extension.json`. It publishes
`@agentage/extension-probe` to npm with provenance.

1. Bump `version` in `package.json`.
2. Run `npx agentage extension check --write` and `npm run format`.
3. Commit to `master`, then tag `v<version>`. The tag must equal the version.

A released version never changes. A re-run keeps its images and record and only retries npm. `agentage extension release`
refuses a tag moved to another commit. Ship a fix as a new version.

## Documentation

- [docs/parts.md](docs/parts.md): each part's routes, scopes and limits.
- [docs/develop.md](docs/develop.md): what `up` does; the e2e gate.

## License

MIT. See [LICENSE](LICENSE).
