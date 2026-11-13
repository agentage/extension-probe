# Parts

Each part of the probe, its source, what it serves, and its scopes and limits. A scope is the
permission a token must carry: `probe:read` or `probe:write`. The full contracts are
[`openapi.json`](../openapi.json) for the api part and [`probe.mcpc.json`](../probe.mcpc.json) for
the mcp part.

## pages

Source: [`src/pages`](../src/pages/index.ts).

- `/` shows `probe {version} · {commit}`.

## ui

Source: [`src/ui`](../src/ui/index.ts). The widget is `<probe-echo>`, written in React on
`@agentage/widget`.

- `/ui/{version}/probe.js` serves the widget bundle.
- `harness.html` is a test page for the widget.

## api

Source: [`src/api`](../src/api/index.ts).

- `GET /api/v1/echo?msg=` needs `probe:read`. `msg` is 1 to 200 characters.
- `GET /api/v1/ticks?limit=&cursor=` returns ticks, newest first. The default limit is 50. A limit
  above 200 is clamped to 200.
- `GET /api/v1/ticks` needs no token.
- `POST /api/v1/emit` needs `probe:write`. With `exit`, the part answers 202 and then stops
  cleanly. The estate starts it again. Local `up` does not, so call it last.
- `emit` also accepts `fail`. It throws after the log, span and event rows are written. The
  answer is 500 with the error code `INTERNAL`.
- `openapi.json` describes these routes.

## mcp

Source: [`src/mcp`](../src/mcp/index.ts).

- `POST /mcp` serves the tool `probe__echo`. It needs `probe:read`.
- `msg` is up to 200 characters. The tool answers `pong <msg>`.
- The tool list is in [`probe.mcpc.json`](../probe.mcpc.json).

## worker

Source: [`src/worker`](../src/worker/index.ts).

- The job `tick` runs every minute. Each run writes one row in `ticks`.

## store

Source: [`migrations/`](../migrations), [`seeds/`](../seeds).

- The store is postgres.
- The api image's `node dist/store/migrate.js` applies the migrations and seeds.

## cli

Source: [`src/cli`](../src/cli/index.ts).

- `agentage ping [msg]` prints `pong`. With a message it prints `pong <msg>`.
