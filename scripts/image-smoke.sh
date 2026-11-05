#!/usr/bin/env bash
# After `agentage extension up`: every part image carries this commit and its /health on loopback
# answers ok with the part's own checks. Usage: scripts/image-smoke.sh <commit>
set -euo pipefail

commit="${1:?usage: scripts/image-smoke.sh <commit>}"
version=$(jq -r .version package.json)
probe="fetch('http://127.0.0.1:3000/health').then(async (r) => { process.stdout.write(await r.text()); })"
fail=0
for part in pages ui api mcp worker; do
  image="ghcr.io/agentage/probe-$part:$version"
  label=$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")
  health=$(docker compose -p agentage-probe exec -T "$part" node -e "$probe")
  status=$(jq -r .data.status <<<"$health")
  checks=$(jq -c .data.checks <<<"$health")
  if [ "$label" = "$commit" ] && [ "$(jq -r .data.commit <<<"$health")" = "$commit" ] && [ "$status" = ok ] && [ "$(jq -r .data.part <<<"$health")" = "$part" ]; then
    echo "PASS $part  commit ${commit:0:12}  $status  $checks"
  else
    echo "FAIL $part  label ${label:0:12}  health $health"
    fail=1
  fi
done
exit "$fail"
