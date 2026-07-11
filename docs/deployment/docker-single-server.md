# Docker Single-Server Deployment

This deployment runs the full project on one Alibaba Cloud ECS instance:

- Caddy terminates HTTPS and routes traffic.
- Next.js website runs on the internal Docker network.
- The admin console is built as static files and served by Nginx.
- NestJS API runs on the internal Docker network.
- PostgreSQL stores data in a Docker volume and is not exposed publicly.

## Prerequisites

1. Point two DNS records to the ECS public IP. Keep them under the same
   registrable domain so SameSite cookies work between admin and API requests:
   - `notes.example.com`
   - `admin.example.com`
2. Open ECS security group ports `80` and `443`.
3. Install Docker Engine with Docker Compose v2 on the server.
4. Create a GitHub OAuth app with this callback URL:

```text
https://notes.example.com/api/auth/github/callback
```

The website host also carries `/api/*`. The admin frontend calls that same host
for API and auth requests, so OAuth cookies stay on one host.

## First Deploy

```bash
git clone <repo-url> /srv/adrian-zephyr-notes
cd /srv/adrian-zephyr-notes

./scripts/deploy-docker.sh
```

The first run creates `deploy/docker/prod.env` and stops. Edit that file with
real domains, database credentials, GitHub OAuth credentials, and optional LLM
settings. Then run:

```bash
./scripts/deploy-docker.sh
```

The script validates required variables, builds images, applies Prisma
migrations, starts containers, and prints container status.

`prod.env` defaults `PNPM_REGISTRY` to `https://registry.npmmirror.com`, which
is usually faster on Alibaba Cloud ECS in mainland China. Change it to
`https://registry.npmjs.org` if you prefer the official npm registry.

## Update Deploy

```bash
cd /srv/adrian-zephyr-notes
git pull
./scripts/deploy-docker.sh
```

## Verify

```bash
docker compose --env-file deploy/docker/prod.env -f deploy/docker/docker-compose.prod.yml ps
curl -I https://notes.example.com
curl -I https://admin.example.com
curl -I https://notes.example.com/api/site-config
```

## Rollback

```bash
cd /srv/adrian-zephyr-notes
git checkout <previous-known-good-commit>
./scripts/deploy-docker.sh
```

The `postgres-data` Docker volume is preserved across redeploys. Back it up
before migrations that may rewrite or delete production data.
