#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker/docker-compose.prod.yml"
ENV_FILE="${1:-$ROOT_DIR/deploy/docker/prod.env}"

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

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --remove-orphans
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
