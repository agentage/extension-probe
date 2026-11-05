#!/usr/bin/env bash
# A released version is never rebuilt: its images and record stay as first pushed.
# Usage: scripts/release-guard.sh <tag> <commit>. Prints `reuse` (the released record is now in
# dist/, only npm may still be missing) or `build`; exits 1 when the version cannot be released
# or when GitHub or the registry cannot say whether it was (each call is bounded by GUARD_TIMEOUT s).
set -euo pipefail

tag="${1:?usage: scripts/release-guard.sh <tag> <commit>}"
commit="${2:?usage: scripts/release-guard.sh <tag> <commit>}"
record=dist/agentage-extension.json
id=$(jq -r .agentage.id package.json)
version="${tag#v}"
err=$(mktemp)
trap 'rm -f "$err"' EXIT
limit="${GUARD_TIMEOUT:-60}"

# Every GitHub and registry call is bounded; a timeout reads as "cannot tell", never "not released".
bounded() {
  local rc=0
  if command -v timeout >/dev/null; then timeout "$limit" "$@" 2>"$err" || rc=$?; else "$@" 2>"$err" || rc=$?; fi
  if [ "$rc" = 124 ]; then echo "timed out after $limit s" >>"$err"; fi
  return "$rc"
}

# Only "not found" means "not released"; any other failure stops the release, never rebuilds it.
not_found() {
  if grep -qE "$1" "$err"; then return 0; fi
  echo "release-guard: cannot tell whether $2 exists:" >&2
  cat "$err" >&2
  exit 1
}

if json=$(bounded gh release download "$tag" -p agentage-extension.json -O -); then
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
not_found 'release not found|no assets match|no assets to download' "the $tag release record"

for part in $(jq -r '.agentage.parts | to_entries[] | select(.value != false) | .key' package.json); do
  case "$part" in pages | ui | api | mcp | worker) ;; *) continue ;; esac
  image="ghcr.io/agentage/$id-$part:$version"
  if bounded docker manifest inspect "$image" >/dev/null; then
    echo "release-guard: $image is already pushed but $tag has no record; release a new version" >&2
    exit 1
  fi
  # denied too: GHCR may answer it for a package that does not exist yet (a new part).
  not_found 'manifest unknown|no such manifest|denied' "$image"
done
echo build
