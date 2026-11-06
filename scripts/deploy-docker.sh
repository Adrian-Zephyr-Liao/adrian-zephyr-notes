#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/deploy/docker/prod.env}"
COMPOSE_FILE="$ROOT_DIR/deploy/docker/docker-compose.prod.yml"
CADDY_FILE="$ROOT_DIR/deploy/docker/caddy/Caddyfile"
SHA="${RELEASE_SHA:?Use build-release.sh and publish-release.sh; production never builds images.}"
[[ "$SHA" =~ ^[a-f0-9]{40}$ && "$SHA" == "$(git -C "$ROOT_DIR" rev-parse HEAD)" ]] || {
  echo 'RELEASE_SHA must be the checked-out full commit SHA.' >&2; exit 1;
}
[[ -f "$ENV_FILE" ]] || { echo "Missing environment file: $ENV_FILE" >&2; exit 1; }
command -v flock >/dev/null
if [[ "${DEPLOY_LOCK_HELD:-0}" == 1 ]]; then
  [[ "$(readlink /proc/self/fd/9)" == "$ROOT_DIR/.git/az-notes-deploy.lock" ]] || {
    echo 'Invalid inherited deployment lock.' >&2; exit 1;
  }
else
  exec 9>"$ROOT_DIR/.git/az-notes-deploy.lock"
fi
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }

state_dir="$ROOT_DIR/.git/az-notes-release"
mkdir -p "$state_dir"
work_dir="$(mktemp -d "$state_dir/attempt.XXXXXX")"
compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
if [[ -f "$ROOT_DIR/deploy/docker/docker-compose.host.yml" ]]; then
  compose+=(-f "$ROOT_DIR/deploy/docker/docker-compose.host.yml")
fi
read -r -a services <<< "${DEPLOY_SERVICES:-website admin}"
[[ ${#services[@]} -gt 0 ]] || { echo 'Select at least one service.' >&2; exit 1; }

# Check every image and the restart policy before changing any live service.
for service in "${services[@]}"; do
  case "$service" in server | website | admin) ;; *) echo "Unsupported service: $service" >&2; exit 1 ;; esac
  image="adrian-zephyr-notes-$service:$SHA"
  [[ "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image")" == linux/amd64 ]] || {
    echo "Missing linux/amd64 release image: $image" >&2; exit 1;
  }
  if [[ "$service" == server && "${DEPLOY_ALLOW_SERVER_RESTART:-0}" != 1 ]]; then
    echo 'Server deployment requires a planned restart: set DEPLOY_ALLOW_SERVER_RESTART=1 during a maintenance window. Assistant task ownership does not support concurrent servers.' >&2
    exit 1
  fi
done
"${compose[@]}" config --quiet
available_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
[[ "$available_kb" -ge 524288 ]] || { echo 'Less than 512 MiB available; keeping all running services.' >&2; exit 1; }

caddy_id="$("${compose[@]}" ps -q caddy)"
[[ -n "$caddy_id" ]] || { echo 'Caddy must already be running.' >&2; exit 1; }
cp "$CADDY_FILE" "$work_dir/Caddyfile.before"
candidate=""
old_container=""
changed_proxy=false
server_changed=false
old_server_image=""

wait_healthy() {
  local container=$1 status attempt
  for ((attempt=0; attempt<90; attempt++)); do
    status="$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container")"
    [[ "$status" != 'running healthy' ]] || return 0
    [[ "$status" != *unhealthy* && "$status" != exited* && "$status" != dead* ]] || return 1
    sleep 2
  done
  return 1
}

reload_proxy() {
  docker exec "$caddy_id" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
}

rollback() {
  local status=$?
  trap - EXIT INT TERM
  if [[ $status -ne 0 ]]; then
    if [[ "$changed_proxy" == true ]]; then
      docker start "$old_container" > /dev/null || { echo "CRITICAL: cannot restart $old_container; retaining candidate." >&2; exit "$status"; }
      if ! wait_healthy "$old_container"; then
        echo "CRITICAL: previous frontend is not ready; retaining candidate $candidate and current routing." >&2
        exit "$status"
      fi
      cat "$work_dir/Caddyfile.before" > "$CADDY_FILE"
      if ! reload_proxy; then
        echo "CRITICAL: proxy rollback failed; keep candidate $candidate for recovery. See $work_dir" >&2
        exit "$status"
      fi
    fi
    if [[ -n "$candidate" ]]; then docker rm -f "$candidate" >/dev/null || true; fi
    if [[ "$server_changed" == true ]]; then
      printf 'services:\n  server:\n    image: %s\n' "$old_server_image" > "$work_dir/server-rollback.yml"
      "${compose[@]}" -f "$work_dir/server-rollback.yml" up -d --no-build --no-deps --wait --wait-timeout 180 server ||
        echo "CRITICAL: server rollback failed. See $work_dir" >&2
    fi
    echo "Deployment failed; rolled back the in-progress service. Previously completed services remain deployed. Evidence: $work_dir" >&2
  fi
  exit "$status"
}
trap rollback EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for service in "${services[@]}"; do
  image="adrian-zephyr-notes-$service:$SHA"
  if [[ "$service" == server ]]; then
    server_id="$("${compose[@]}" ps -q server)"
    [[ -n "$server_id" ]]
    old_server_image="$(docker inspect --format '{{.Image}}' "$server_id")"
    printf 'services:\n  server:\n    image: %s\n' "$image" > "$work_dir/server.yml"
    server_changed=true
    "${compose[@]}" -f "$work_dir/server.yml" up -d --no-build --no-deps --wait --wait-timeout 180 server
    curl --fail --silent --show-error --max-time 20 https://zephyrai.site/api/site-config > /dev/null
    server_changed=false
    continue
  fi

  port=80
  [[ "$service" != website ]] || port=3002
  # Route names are persisted in the mounted Caddyfile, including host-specific ERP configuration.
  upstream="$(awk -v port="$port" '$1 == "reverse_proxy" && NF == 2 && $2 ~ (":" port "$") && ($2 ~ /^website:/ || $2 ~ /^admin:/ || $2 ~ /^azn-(website|admin)-/) { print $2 }' "$CADDY_FILE")"
  [[ -n "$upstream" && "$upstream" != *$'\n'* ]] || { echo "Expected one $service upstream." >&2; exit 1; }
  old_container="${upstream%:*}"
  if [[ "$old_container" == "$service" ]]; then old_container="$("${compose[@]}" ps -q "$service")"; fi
  [[ -n "$old_container" ]]
  docker inspect "$old_container" > /dev/null
  candidate="azn-$service-${SHA:0:12}-$(date +%s)"
  printf 'services:\n  %s:\n    image: %s\n' "$service" "$image" > "$work_dir/$service.yml"
  "${compose[@]}" -f "$work_dir/$service.yml" run -d --no-deps --name "$candidate" "$service" > /dev/null
  wait_healthy "$candidate" || { echo "Candidate $candidate failed health checks." >&2; exit 1; }
  # Existing browser tabs can still request the previous build's hashed chunks.
  asset_path=/usr/share/nginx/html/assets
  [[ "$service" != website ]] || asset_path=/app/apps/website/.next/static
  docker cp "$old_container:$asset_path/." "$work_dir/$service-assets"
  tar -C "$work_dir/$service-assets" -cf - . | docker exec -i "$candidate" tar -xf - -C "$asset_path"
  rm -rf "$work_dir/$service-assets"
  docker update --restart unless-stopped "$candidate" > /dev/null

  # Write in place: atomic rename would leave Docker's file bind mount on the old inode.
  awk -v old="$upstream" -v new="$candidate:$port" '{if ($1 == "reverse_proxy" && NF == 2 && $2 == old) $2=new; print}' "$CADDY_FILE" > "$work_dir/Caddyfile.next"
  changed_proxy=true
  cat "$work_dir/Caddyfile.next" > "$CADDY_FILE"
  reload_proxy
  host_var=ADMIN_HOST
  [[ "$service" != website ]] || host_var=WEBSITE_HOST
  host="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$caddy_id" | sed -n "s/^$host_var=//p")"
  [[ -n "$host" ]]
  curl --fail --silent --show-error --max-time 20 --resolve "$host:443:127.0.0.1" "https://$host/" > /dev/null
  # Keep the old process alive while requests already assigned to it finish.
  sleep "${DEPLOY_DRAIN_SECONDS:-30}"
  docker stop --time 30 "$old_container" > /dev/null
  # Stopped previous containers are the rollback record; remove them only during explicit retention cleanup.
  printf '%s\n' "$candidate" > "$state_dir/$service.active"
  cp "$CADDY_FILE" "$work_dir/Caddyfile.before"
  changed_proxy=false
  candidate=""
done

baseline="$ROOT_DIR/.git/az-notes-last-deployed"
record_state=true
if [[ -f "$baseline" ]]; then
  previous="$(cat "$baseline")"
  if git -C "$ROOT_DIR" merge-base --is-ancestor "$previous" HEAD; then
    changed=()
    while IFS= read -r file; do [[ -z "$file" ]] || changed+=("$file"); done < <(git -C "$ROOT_DIR" diff --name-only "$previous" HEAD)
    required=""
    if [[ -n "${changed[*]:-}" ]]; then required="$("$ROOT_DIR/scripts/select-deploy-services.sh" "${changed[@]}")"; fi
    [[ "$required" != __full_stack__ ]] || required='server website admin'
    for service in $required; do
      case " ${services[*]} " in *" $service "*) ;; *) record_state=false ;; esac
    done
  else
    record_state=false
  fi
else
  record_state=false
fi
if [[ "$record_state" == true ]]; then
  printf '%s\n' "$SHA" > "$baseline"
else
  echo 'Partial release: the full deployment baseline was not advanced.'
fi
trap - EXIT INT TERM
echo "Deployed prebuilt release $SHA; databases, Caddy and ERP were not recreated."
