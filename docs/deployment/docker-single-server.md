# Docker single-server deployment

Caddy routes HTTPS to the website, admin UI and API. PostgreSQL stays on the
private Docker network. Production runs **prebuilt linux/amd64 images**; it never
installs dependencies or builds application images.

## First installation

Use a fresh server with Docker Engine and Compose v2, DNS records for the website
and admin host, and ports 80/443 open. Configure the GitHub OAuth callback as
`https://<website-host>/api/auth/github/callback`.

1. Clone the repository to `/srv/adrian-zephyr-notes`.
2. Copy `deploy/docker/prod.env.example` to `deploy/docker/prod.env` and fill in
   real domains, database credentials and OAuth credentials.
3. Build all three application images on CI or a development machine using
   `scripts/build-release.sh`; transfer and verify the release before loading it.
4. Only on this empty installation, start the base stack with the release SHA:

```bash
RELEASE_SHA=<full-commit-sha> docker compose --env-file deploy/docker/prod.env \
  -f deploy/docker/docker-compose.prod.yml up -d --no-build --pull never --wait
```

The API starts with Prisma migrations. Back up the database before any migration
that changes existing data; image rollback cannot undo a schema migration.

## Subsequent releases

Follow [Prebuilt releases](prebuilt-releases.md). `scripts/deploy-docker.sh`
requires `RELEASE_SHA`; invoking it without a prebuilt release fails before
changing services. It does not recreate the database, proxy or ERP services.

Keep host-specific Compose additions in the ignored
`deploy/docker/docker-compose.host.yml`; the deployment script automatically
combines it with the tracked production configuration. The mounted Caddyfile
contains active frontend upstreams and any host-specific ERP routes. Do not
replace that file with a repository copy during deployment.

Frontend releases start a bounded candidate container, check its health, reload
Caddy, check HTTPS and drain the old frontend. Stopped previous containers and
`.git/az-notes-release/attempt.*` retain recovery evidence. The backend is a single
instance: automatic replacement is blocked until an explicit maintenance window
permits a restart. This avoids starting a second Assistant that would interrupt
existing tasks.

The server, website and admin have memory and CPU ceilings. These protect the
shared host but are capacity limits, not load-test results. Never run Docker
builds on this small production server, even sequentially.
