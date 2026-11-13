# Develop

Details for running and testing the probe from a clone. The commands are in the
[README](../README.md#run-it-from-a-clone).

## Run it from a clone

- `up` builds the five part images from the release recipe. It writes `.agentage/record.json` from
  the local image digests, so the discovery document is valid.
- `up` starts postgres and runs the migrate job. It also starts the dev issuer on port 4281 and a
  Traefik gateway on port 4280. The dev issuer mints local tokens. The gateway gives the URL layout
  of a deployment.
- `up` waits until every part is healthy.
- Each checkout is its own compose project, so `down` in one never touches another.
- A second checkout's `up` is refused while the first holds port 4280 or 4281.
- On a kept volume (`down --keep-data`) the store line says
  `1 migration already applied · 1 seed already applied`.

## Verify

After the README's Verify commands, CI runs the gate of agentage/e2e against the same `up`. The gate is the shared end-to-end test
suite. That repository is private, so only maintainers run the gate. With `up` running, from a
checkout of agentage/e2e:

```bash
npm ci && npx playwright install --with-deps chromium
PROBE_DIR=/path/to/extension-probe npm run e2e -- probe gate local
```

`PROBE_DIR` lets the gate read `probe.mcpc.json`, `openapi.json` and the cli part from this
checkout. Some gate tests skip locally: they need a deployed release.

- CI fails a gate that ran fewer tests than `MIN_EXECUTED` in `.github/workflows/ci.yml`.
- CI also fails a gate that ran none of the cli part tests.
- The job is bounded at 10 minutes.
- Dependabot runs get no secrets. So they skip the agentage/e2e checkout and the gate. `up` and
  `npm run test:e2e` still run.
