#!/usr/bin/env bash
# A released version is never rebuilt: its images and record stay as first pushed.
# Usage: scripts/release-guard.sh <tag> <commit>. Prints `reuse` (the released record is now in
# dist/, only npm may still be missing) or `build`; exits 1 when the version cannot be released.
set -euo pipefail

tag="$1"
commit="$2"
record=dist/agentage-extension.json
id=$(jq -r .agentage.id package.json)
version="${tag#v}"

if json=$(gh release download "$tag" -p agentage-extension.json -O - 2>/dev/null); then
  released=$(jq -r .commit <<<"$json")
  if [ "$released" != "$commit" ]; then
    echo "release-guard: $tag was released from $released, not $commit; a version's images never change: release a new version" >&2
    exit 1
  fi
  mkdir -p dist
  printf '%s\n' "$json" >"$record"
  echo reuse
  exit 0
fi

for part in $(jq -r '.agentage.parts | to_entries[] | select(.value != false) | .key' package.json); do
  case "$part" in pages | ui | api | mcp | worker) ;; *) continue ;; esac
  image="ghcr.io/agentage/$id-$part:$version"
  if docker manifest inspect "$image" >/dev/null 2>&1; then
    echo "release-guard: $image is already pushed but $tag has no record; release a new version" >&2
    exit 1
  fi
done
echo build
