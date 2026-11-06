#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 FULL_COMMIT_SHA OUTPUT_DIRECTORY" >&2
  exit 64
fi
revision=$1
output=$(cd "$2" && pwd)
: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
: "${DEPLOY_USER:?Set DEPLOY_USER}"
port=${DEPLOY_PORT:-22}
allow_server=${DEPLOY_ALLOW_SERVER_RESTART:-0}
[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ && "$DEPLOY_USER" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]*$ ]] || {
  echo "Invalid SSH host or user." >&2; exit 64;
}
[[ "$port" =~ ^[0-9]{1,5}$ ]] && ((10#$port >= 1 && 10#$port <= 65535)) || {
  echo "Invalid SSH port." >&2; exit 64;
}
[[ "$allow_server" == 0 || "$allow_server" == 1 ]] || exit 64

(
  cd "$output"
  [[ $(wc -l < SHA256SUMS | tr -d ' ') == 4 ]]
  awk 'NF != 2 || ($2 != "release-images.tar.gz" && $2 != "source.bundle" && $2 != "services.txt" && $2 != "images.txt") { exit 1 }
    { seen[$2]++ } END { for (name in seen) { count++; if (seen[name] != 1) exit 1 } if (count != 4) exit 1 }' SHA256SUMS
  shasum -a 256 --check SHA256SUMS
)
[[ $(git bundle list-heads "$output/source.bundle" HEAD | awk '{print $1}') == "$revision" ]] || {
  echo "Source bundle does not match the release." >&2; exit 1;
}

target="$DEPLOY_USER@$DEPLOY_HOST"
options=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)
upload_bytes=0
for file in release-images.tar.gz source.bundle services.txt images.txt SHA256SUMS; do
  bytes=$(wc -c < "$output/$file" | tr -d ' ')
  upload_bytes=$((upload_bytes + bytes))
done
upload=$(ssh "${options[@]}" -p "$port" "$target" bash -s -- "$revision" "$upload_bytes" <<'PREPARE'
set -euo pipefail
revision=$1
upload_bytes=$2
[[ "$revision" =~ ^[0-9a-f]{40}$ && "$upload_bytes" =~ ^[0-9]+$ ]]
cd /srv/adrian-zephyr-notes
free_kb=$(df -Pk "$PWD" | awk 'END { print $4 }')
required_kb=$(((upload_bytes + 1023) / 1024 + 2097152))
[[ "$free_kb" -ge "$required_kb" ]] || {
  echo "Not enough free space for the upload plus 2 GiB of headroom." >&2; exit 1;
}
umask 077
mkdir -p ".git/releases/$revision"
mktemp -d "$PWD/.git/releases/$revision/upload.XXXXXX"
PREPARE
)
[[ "$upload" =~ ^/srv/adrian-zephyr-notes/\.git/releases/$revision/upload\.[A-Za-z0-9]{6}$ ]] || exit 1
scp "${options[@]}" -P "$port" \
  "$output/release-images.tar.gz" "$output/source.bundle" "$output/services.txt" \
  "$output/images.txt" "$output/SHA256SUMS" "$target:$upload/"

ssh "${options[@]}" -p "$port" "$target" bash -s -- "$revision" "$allow_server" "$upload" <<'REMOTE'
set -euo pipefail
revision=$1
allow_server=$2
release=$3
[[ "$revision" =~ ^[0-9a-f]{40}$ && "$allow_server" =~ ^[01]$ ]]
[[ "$release" =~ ^/srv/adrian-zephyr-notes/\.git/releases/$revision/upload\.[A-Za-z0-9]{6}$ ]]
cd /srv/adrian-zephyr-notes
command -v flock >/dev/null
command -v ionice >/dev/null
command -v nice >/dev/null
exec 9>.git/az-notes-deploy.lock
flock -n 9 || { echo "Another release is being published." >&2; exit 1; }
(
  cd "$release"
  [[ $(wc -l < SHA256SUMS | tr -d ' ') == 4 ]]
  awk 'NF != 2 || ($2 != "release-images.tar.gz" && $2 != "source.bundle" && $2 != "services.txt" && $2 != "images.txt") { exit 1 }
    { seen[$2]++ } END { for (name in seen) { count++; if (seen[name] != 1) exit 1 } if (count != 4) exit 1 }' SHA256SUMS
  sha256sum --check SHA256SUMS
)
services=()
seen=" "
while IFS= read -r service || [[ -n "$service" ]]; do
  case "$service" in server|website|admin) ;; *) echo "Invalid release service." >&2; exit 1 ;; esac
  [[ "$seen" != *" $service "* ]] || exit 1
  seen+="$service "
  services+=("$service")
done < "$release/services.txt"
[[ ${#services[@]} -gt 0 ]]
if [[ "$seen" == *" server "* && "$allow_server" != 1 ]]; then
  echo "A server release requires an explicit maintenance window: DEPLOY_ALLOW_SERVER_RESTART=1." >&2
  exit 1
fi
[[ $(wc -l < "$release/images.txt" | tr -d ' ') == ${#services[@]} ]]
for service in "${services[@]}"; do
  tag="adrian-zephyr-notes-$service:$revision"
  expected=$(awk -v tag="$tag" '$1 == tag && NF == 2 { print $2 }' "$release/images.txt")
  [[ "$expected" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1
  if existing=$(docker image inspect --format '{{.Id}}' "$tag" 2>/dev/null); then
    [[ "$existing" == "$expected" ]] || { echo "Immutable tag already points to another image: $tag" >&2; exit 1; }
  fi
done

git bundle verify "$release/source.bundle"
git fetch --no-tags "$release/source.bundle" HEAD
[[ $(git rev-parse FETCH_HEAD) == "$revision" ]]
git merge-base --is-ancestor HEAD "$revision"
deploy_source=$(git show "$revision:scripts/deploy-docker.sh")
[[ "$deploy_source" == *RELEASE_SHA* ]] || {
  echo "Release lacks the prebuilt deployment mode; refusing an online build." >&2; exit 1;
}

available_kb=$(awk '/MemAvailable:/ { print $2 }' /proc/meminfo)
docker_root=$(docker info --format '{{.DockerRootDir}}')
disk_kb=$(df -Pk "$docker_root" | awk 'END { print $4 }')
[[ "$available_kb" -ge 786432 && "$disk_kb" -ge 2097152 ]] || {
  echo "Loading needs at least 768 MiB available memory and 2 GiB free Docker storage." >&2; exit 1;
}
# Priority applies to the client; the existing Docker daemon is not cgroup-isolated.
ionice -c 2 -n 7 nice -n 10 docker load --input "$release/release-images.tar.gz"

for service in "${services[@]}"; do
  tag="adrian-zephyr-notes-$service:$revision"
  expected=$(awk -v tag="$tag" '$1 == tag { print $2 }' "$release/images.txt")
  [[ $(docker image inspect --format '{{.Id}}' "$tag") == "$expected" ]]
  [[ $(docker image inspect --format '{{.Os}}/{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}' "$tag") == "linux/amd64 $revision" ]]
done

while IFS= read -r file; do
  case "$file" in
    deploy/docker/caddy/Caddyfile) ;;
    *) echo "Unexpected production source change: $file" >&2; exit 1 ;;
  esac
done < <(git diff --name-only HEAD)
protected=(deploy/docker/caddy/Caddyfile)
if [[ -f deploy/docker/docker-compose.host.yml ]]; then protected+=(deploy/docker/docker-compose.host.yml); fi
config_before=$(sha256sum "${protected[@]}")
git merge --ff-only "$revision"
[[ $(git rev-parse HEAD) == "$revision" ]]
[[ $(sha256sum "${protected[@]}") == "$config_before" ]] || {
  echo "Protected production configuration changed; deployment stopped." >&2; exit 1;
}
RELEASE_SHA="$revision" DEPLOY_SERVICES="${services[*]}" \
  DEPLOY_ALLOW_SERVER_RESTART="$allow_server" DEPLOY_LOCK_HELD=1 \
  ./scripts/deploy-docker.sh deploy/docker/prod.env
REMOTE
