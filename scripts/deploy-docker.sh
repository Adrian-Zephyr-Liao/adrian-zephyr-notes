#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker/docker-compose.prod.yml"
ENV_FILE="${1:-$ROOT_DIR/deploy/docker/prod.env}"
SELECT_SERVICES_SCRIPT="$ROOT_DIR/scripts/select-deploy-services.sh"
DEPLOY_STATE_FILE="${DEPLOY_STATE_FILE:-$(git -C "$ROOT_DIR" rev-parse --git-path az-notes-last-deployed)}"
ALL_BUILD_SERVICES=("server" "website" "admin")

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but was not found in PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose v2 is required but was not found." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT_DIR/deploy/docker/prod.env.example" "$ENV_FILE"
  echo "Created $ENV_FILE from prod.env.example."
  echo "Edit it with real domains and secrets, then run this script again."
  exit 1
fi

required_vars=(
  WEBSITE_HOST
  ADMIN_HOST
  ACME_EMAIL
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  ADMIN_GITHUB_LOGINS
  GITHUB_OAUTH_CLIENT_ID
  GITHUB_OAUTH_CLIENT_SECRET
)

for name in "${required_vars[@]}"; do
  value="$(grep -E "^${name}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"

  if [[ -z "$value" || "$value" == replace-* || "$value" == *example.com ]]; then
    echo "$name must be set in $ENV_FILE before deployment." >&2
    exit 1
  fi
done

postgres_password="$(grep -E "^POSTGRES_PASSWORD=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
if [[ ! "$postgres_password" =~ ^[A-Za-z0-9._~-]+$ ]]; then
  echo "POSTGRES_PASSWORD may only contain URL-safe characters: A-Z a-z 0-9 . _ ~ -" >&2
  echo "Generate one with: openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 48; echo" >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null

reconcile_full_stack=false
record_deploy_state=true
selected_services=()

if [[ -n "${DEPLOY_SERVICES:-}" ]]; then
  if [[ "$DEPLOY_SERVICES" == "all" ]]; then
    selected_services=("${ALL_BUILD_SERVICES[@]}")
    reconcile_full_stack=true
  else
    read -r -a selected_services <<< "$DEPLOY_SERVICES"
    record_deploy_state=false
  fi
else
  base_sha="${DEPLOY_BASE_SHA:-}"

  if [[ -z "$base_sha" && -f "$DEPLOY_STATE_FILE" ]]; then
    base_sha="$(tr -d '[:space:]' < "$DEPLOY_STATE_FILE")"
  fi

  if [[ -n "$base_sha" ]] &&
    git -C "$ROOT_DIR" cat-file -e "${base_sha}^{commit}" 2>/dev/null &&
    git -C "$ROOT_DIR" merge-base --is-ancestor "$base_sha" HEAD; then
    changed_files=()
    while IFS= read -r changed_file; do
      [[ -n "$changed_file" ]] && changed_files+=("$changed_file")
    done < <(git -C "$ROOT_DIR" diff --name-only "$base_sha"...HEAD)

    selection="$("$SELECT_SERVICES_SCRIPT" "${changed_files[@]}")"

    if [[ "$selection" == "__full_stack__" ]]; then
      selected_services=("${ALL_BUILD_SERVICES[@]}")
      reconcile_full_stack=true
    elif [[ -n "$selection" ]]; then
      read -r -a selected_services <<< "$selection"
    fi
  else
    echo "No valid deployment baseline found; using a full rebuild."
    selected_services=("${ALL_BUILD_SERVICES[@]}")
    reconcile_full_stack=true
  fi
fi

for service in "${selected_services[@]}"; do
  case "$service" in
    server | website | admin) ;;
    *)
      echo "Unsupported deploy service: $service" >&2
      exit 1
      ;;
  esac
done

if [[ ${#selected_services[@]} -eq 0 ]]; then
  echo "No runtime-affecting changes detected; skipping image builds."
fi

for service in "${selected_services[@]}"; do
  echo "Building $service image..."
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build "$service"
done

if [[ "$reconcile_full_stack" == true ]]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up \
    -d --no-build --remove-orphans --wait --wait-timeout 180
elif [[ ${#selected_services[@]} -gt 0 ]]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up \
    -d --no-build --no-deps --wait --wait-timeout 180 "${selected_services[@]}"
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

if [[ "$record_deploy_state" == true ]]; then
  git -C "$ROOT_DIR" rev-parse HEAD > "$DEPLOY_STATE_FILE"
else
  echo "Partial DEPLOY_SERVICES override used; deployment baseline was not advanced."
fi
