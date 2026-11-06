#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 FULL_COMMIT_SHA OUTPUT_DIRECTORY [server|website|admin ...]" >&2
  exit 64
fi

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
revision=$1
output=$2
shift 2
[[ $(git -C "$root" rev-parse HEAD) == "$revision" ]] || {
  echo "The release must match the checked-out HEAD." >&2
  exit 1
}
[[ -z $(git -C "$root" status --porcelain --untracked-files=normal) ]] || {
  echo "Commit source changes or use a separate clean checkout before building." >&2
  exit 1
}

services=("$@")
if [[ ${#services[@]} -eq 0 ]]; then services=(website admin); fi
seen=" "
for service in "${services[@]}"; do
  case "$service" in server|website|admin) ;; *) echo "Unsupported service: $service" >&2; exit 64 ;; esac
  [[ "$seen" != *" $service "* ]] || { echo "Duplicate service: $service" >&2; exit 64; }
  seen+="$service "
done

command -v docker >/dev/null
command -v shasum >/dev/null
docker buildx version >/dev/null
mkdir -p "$output"
output=$(cd "$output" && pwd)
for file in release-images.tar.gz source.bundle services.txt images.txt SHA256SUMS; do
  [[ ! -e "$output/$file" ]] || { echo "Release output already exists: $output/$file" >&2; exit 1; }
done

stage=$(mktemp -d "${TMPDIR:-/tmp}/azn-release.XXXXXX")
trap 'rm -rf "$stage"' EXIT
mkdir "$stage/context"
# Only committed files enter the context, including when ignored local files exist.
git -C "$root" archive "$revision" | tar -xf - -C "$stage/context"
git -C "$root" bundle create "$stage/source.bundle" HEAD
printf '%s\n' "${services[@]}" > "$stage/services.txt"
tags=()
: > "$stage/images.txt"

for service in "${services[@]}"; do
  tag="adrian-zephyr-notes-$service:$revision"
  if ! docker image inspect "$tag" >/dev/null 2>&1; then
    args=(--platform linux/amd64 --load --tag "$tag"
      --label "org.opencontainers.image.revision=$revision"
      --build-arg "NPM_CONFIG_REGISTRY=${RELEASE_NPM_REGISTRY:-https://registry.npmjs.org}"
      --file "$stage/context/apps/$service/Dockerfile")
    case "$service" in
      website) args+=(--build-arg BACKEND_API_BASE_URL=http://server:3001) ;;
      admin) args+=(--build-arg "VITE_BACKEND_API_BASE_URL=${ADMIN_BACKEND_API_BASE_URL:-}") ;;
    esac
    docker buildx build "${args[@]}" "$stage/context"
  fi
  identity=$(docker image inspect --format '{{.Os}}/{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}' "$tag")
  [[ "$identity" == "linux/amd64 $revision" ]] || {
    echo "Refusing to reuse a tag with the wrong platform or revision: $tag" >&2
    exit 1
  }
  image_id=$(docker image inspect --format '{{.Id}}' "$tag")
  [[ "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1
  printf '%s %s\n' "$tag" "$image_id" >> "$stage/images.txt"
  tags+=("$tag")
done

docker image save "${tags[@]}" | gzip > "$stage/release-images.tar.gz"
(
  cd "$stage"
  shasum -a 256 release-images.tar.gz source.bundle services.txt images.txt > SHA256SUMS
)
for file in release-images.tar.gz source.bundle services.txt images.txt SHA256SUMS; do
  mv "$stage/$file" "$output/$file"
done
echo "Release $revision ready: $output"
