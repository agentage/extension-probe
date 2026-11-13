# Develop

## Run it from a clone

- `up` builds the five part images from the release recipe and writes `.agentage/record.json`
  from the local image digests, so discovery is valid. It starts postgres, runs the migrate job,
  the dev issuer (4281) and a Traefik gateway (4280) with the URL layout of a deployment. It waits
  until every part is healthy.
- Each checkout is its own compose project, so `down` in one never touches another. A second
  checkout's `up` is refused while the first holds port 4280 or 4281.
- On a kept volume (`down --keep-data`) the store line says
  `1 migration already applied · 1 seed already applied`.

## Verify

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
