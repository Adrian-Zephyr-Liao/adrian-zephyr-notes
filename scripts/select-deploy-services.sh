#!/usr/bin/env bash
set -euo pipefail

build_server=false
build_website=false
build_admin=false
reconcile_full_stack=false

for changed_file in "$@"; do
  case "$changed_file" in
    deploy/docker/*)
      reconcile_full_stack=true
      ;;
    package.json | pnpm-lock.yaml | pnpm-workspace.yaml | .dockerignore)
      build_server=true
      build_website=true
      build_admin=true
      ;;
    apps/server/*)
      build_server=true
      ;;
    apps/website/*)
      build_website=true
      ;;
    apps/admin/*)
      build_admin=true
      ;;
    packages/contracts/*)
      build_server=true
      build_website=true
      build_admin=true
      ;;
    packages/markdown/*)
      build_website=true
      build_admin=true
      ;;
    docs/* | .github/* | .agents/* | .codex/* | scripts/* | *.md)
      ;;
    *)
      build_server=true
      build_website=true
      build_admin=true
      ;;
  esac
done

if [[ "$reconcile_full_stack" == true ]]; then
  printf '%s\n' "__full_stack__"
  exit 0
fi

selected_services=""
[[ "$build_server" == true ]] && selected_services="server"
[[ "$build_website" == true ]] && selected_services="${selected_services:+$selected_services }website"
[[ "$build_admin" == true ]] && selected_services="${selected_services:+$selected_services }admin"

printf '%s\n' "$selected_services"
