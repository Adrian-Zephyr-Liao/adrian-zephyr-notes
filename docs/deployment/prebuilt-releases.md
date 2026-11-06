# Prebuilt production releases

Build on a development machine or CI runner. Production receives an image archive
and the matching Git commit; it never installs packages or builds application code.

## Build a release

Use a clean checkout of the exact commit. The script rejects a different HEAD,
tracked changes and untracked files that Git does not ignore. It builds the context
from `git archive`, so ignored local files cannot enter an image either.

```bash
revision=$(git rev-parse HEAD)
./scripts/build-release.sh "$revision" /tmp/azn-release website admin
```

Omitting the service list selects `website admin`. Include `server` explicitly only
when an API deployment is intended. Supported services are `server`, `website` and
`admin`; duplicate and unknown names are rejected.

Images target `linux/amd64`, including when the builder is an Apple Silicon Mac.
The host needs Docker Buildx with support for that target. Each image is tagged
`adrian-zephyr-notes-SERVICE:FULL_COMMIT_SHA` and carries the OCI
`org.opencontainers.image.revision` label. An existing tag is reused after checking
its platform and revision, rather than overwritten by another build.

`RELEASE_NPM_REGISTRY` optionally changes the package registry; the default is
`https://registry.npmjs.org`. `ADMIN_BACKEND_API_BASE_URL` optionally supplies the
admin build's public backend URL; leaving it empty uses the existing same-origin
configuration. Production credentials are not build arguments.

The output directory must not already contain release files. It receives:

- `release-images.tar.gz`: selected Docker images.
- `services.txt`: the selected services, one per line.
- `images.txt`: exact image tags and IDs.
- `source.bundle`: the committed source with its release HEAD.
- `SHA256SUMS`: checksums of those four files.

Checksums detect corruption; they are not signatures. Build and publish artifacts
from a trusted checkout and transfer them over authenticated SSH.

## Publish a release

Reuse the CI SSH configuration step: install the private key and trusted host keys
with private file permissions, then map the existing production SSH secrets to
`DEPLOY_HOST`, `DEPLOY_USER` and `DEPLOY_PORT`. The script uses batch mode and strict
host-key checking, and does not accept passwords or disable host verification.

```bash
export DEPLOY_HOST=production.example.com
export DEPLOY_USER=root
export DEPLOY_PORT=22
./scripts/publish-release.sh "$revision" /tmp/azn-release
```

For manual publishing from this workstation, the existing SSH configuration can
be used with `DEPLOY_HOST=zephyr-ecs DEPLOY_USER=root`; the script retains normal
SSH identity and host-alias handling. This does not establish a public CI route.

The deploy job in `.github/workflows/ci.yml` is gated by the repository variable
`PRODUCTION_DEPLOY_ENABLED=true`. Leave it disabled until the production SSH
secrets (`PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_SSH_PORT`,
`PRODUCTION_SSH_PRIVATE_KEY`, `PRODUCTION_SSH_KNOWN_HOSTS`) and a reachable SSH
network are configured. The current Tailscale-only connection from this workstation
does not make the server reachable from a GitHub-hosted runner automatically.
Configuring that network path and enabling the job are separate deployment setup
steps; the workflow does not provision them.

Each upload gets its own directory below
`/srv/adrian-zephyr-notes/.git/releases/FULL_COMMIT_SHA`, so another upload cannot
overwrite files being verified or loaded.
Before uploading, available storage under `/srv` must cover all five files plus
2 GiB of headroom. The later Docker-data storage check still applies. Uploads use
unique directories, but this preflight does not reserve disk space against other
concurrent uploads or unrelated writes.

Publishing validates local and remote checksums, bundle identity and service names;
takes the shared server-side `.git/az-notes-deploy.lock`; rejects conflicting immutable image tags; and
loads the archive before changing source or touching running services. A failed
image load leaves running services unchanged. Uploaded artifacts remain available
for diagnosis and deliberate cleanup.

Loading requires at least 768 MiB of available memory and 2 GiB of free storage on
Docker's data filesystem. A server-side lock serializes publication; the image-load
client uses low CPU and I/O priority through `nice` and `ionice`. A failed resource
check or missing command stops publication before loading.

The Docker daemon performs image extraction outside that client process. Neither
client priorities nor a client-only systemd scope establish a hard memory limit on
the daemon. Avoiding production builds removes the main deployment memory spike;
inspect daemon memory and service health during image loading as part of production
acceptance. Resource thresholds are preconditions, not a guarantee against unrelated
load arriving later.

After loading, the script verifies image IDs, platform and revision again. It
fetches the bundled commit and only permits a fast-forward from production HEAD.
It never uses `git reset`, forced checkout or a production `git pull` that could
select a newer, untested commit. The tracked production Compose file must be clean
so normal base configuration changes can fast-forward. Put host-specific ERP/DNS/
network settings in the ignored `deploy/docker/docker-compose.host.yml` override,
which the deployment script includes when present. Existing Caddyfile modifications
are permitted. That file and an existing host override are checksum-protected
across the merge; other tracked source changes stop publishing. Reconcile changes
to protected host configuration separately before publishing.

The exact release must already include the prebuilt mode in `deploy-docker.sh`.
An older deployment script is rejected to prevent an accidental online build.
The final call is:

```bash
RELEASE_SHA="$revision" DEPLOY_SERVICES='website admin' \
  DEPLOY_ALLOW_SERVER_RESTART=0 \
  ./scripts/deploy-docker.sh deploy/docker/prod.env
```

The actual service list comes from `services.txt`. The publisher forwards
`DEPLOY_LOCK_HELD=1` and the open lock descriptor to the deployment script, which
validates the inherited lock rather than opening a second, independent lock.
Frontend deployment uses healthy
candidate containers and a Caddy routing switch in the deployment script. Reloads
pass the persisted host configuration through stdin, since an existing file bind
mount may still refer to an older inode. Before retiring the old frontend, the
script checks Caddy's live admin API for both the new upstream and removal of the
old upstream, then repeats health and HTTPS checks after draining. Python 3 is
required on the production host for the JSON configuration check. Database,
Caddy and ERP containers must remain running; candidate readiness, public requests,
rollback and the deployment marker are the deployment script's responsibility.

## API maintenance boundary

The API currently has single-instance Assistant recovery: starting another API
instance can mark the old instance's active turns interrupted. It cannot safely
use frontend-style parallel candidate instances without execution ownership and
handoff changes.

By default, a release containing `server` is rejected before image loading. If a
maintenance window has been explicitly accepted, publish with
`DEPLOY_ALLOW_SERVER_RESTART=1`; that value is forwarded to the deployment script
for a bounded single-instance restart with failure rollback. It is not a zero
downtime API deployment, and image rollback cannot reverse incompatible database
migrations. Frontend-only releases do not need this override.

Before advancing a deployment marker, verify actual public routes, no new OOM
events or unrelated container restarts, and the expected image IDs. Retain the
previous serving images until rollback is no longer required. Do not use global
image or volume pruning as part of a release.
