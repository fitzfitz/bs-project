# Deployment Guide — TMNG SaaS API

## Architecture

The API runs as a Node.js server (Hono + `@hono/node-server`) inside a Docker container on the VPS. PostgreSQL runs on the same host, giving sub-millisecond database latency.

```
Internet ──> Nginx (port 80/443) ──> Docker: saas-api (port 8787) ──> PostgreSQL (localhost:5432)
```

## Prerequisites

| Component  | Version  | Notes                          |
| ---------- | -------- | ------------------------------ |
| Docker     | 24+      | With Docker Compose v2         |
| Nginx      | any      | Reverse proxy                  |
| PostgreSQL | 15+      | Running on the VPS host        |
| Portainer  | 2.x      | Optional — for UI management   |
| Node.js    | 22 LTS   | Used inside the Docker image   |

## Environment Variables

Copy `apps/api/.env.production.example` to `/opt/tmng/.env` on the VPS and fill in real values:

| Variable              | Required | Description                                |
| --------------------- | -------- | ------------------------------------------ |
| `DATABASE_URL`        | Yes      | PostgreSQL connection string               |
| `JWT_SECRET`          | Yes      | Min 32 chars, used for access tokens       |
| `JWT_REFRESH_SECRET`  | Yes      | Min 32 chars, used for refresh tokens      |
| `JWT_ACCESS_EXPIRY`   | No       | Default: `15m`                             |
| `JWT_REFRESH_EXPIRY`  | No       | Default: `7d`                              |
| `PUSHER_APP_ID`       | Yes      | Soketi app ID                              |
| `PUSHER_KEY`          | Yes      | Soketi key                                 |
| `PUSHER_SECRET`       | Yes      | Soketi secret                              |
| `PUSHER_CLUSTER`      | No       | Default: `mt1`                             |
| `PUSHER_HOST`         | Yes      | Soketi server hostname                     |
| `PUSHER_PORT`         | No       | Default: `443`                             |
| `PUSHER_USE_TLS`      | No       | Default: `true`                            |
| `XENDIT_SECRET_KEY`   | No       | Xendit payment gateway (omit for CASH)     |
| `XENDIT_WEBHOOK_TOKEN`| No       | Xendit webhook verification token          |

> **Important:** When PostgreSQL runs on the VPS host (not in Docker), set `DATABASE_URL` to use `host.docker.internal` as the hostname, e.g.: `postgresql://user:pass@host.docker.internal:5432/saas-api`

## CI/CD Pipeline (GitHub Actions)

### How it works

1. Push to `main` branch (changes in `apps/api/` or `pnpm-lock.yaml`)
2. GitHub Actions builds a Docker image and pushes it to GHCR (GitHub Container Registry)
3. The deploy job SSHs into the VPS, pulls the new image, and restarts the container
4. The workflow can also be triggered manually via `workflow_dispatch`

### Required GitHub Secrets

Set these in your repo: **Settings > Secrets and variables > Actions**

| Secret           | Value                                    |
| ---------------- | ---------------------------------------- |
| `VPS_HOST`       | VPS IP address (e.g. `57.128.251.45`)    |
| `VPS_USER`       | SSH username on the VPS                  |
| `VPS_SSH_KEY`    | Private SSH key (the full PEM content)   |
| `GHCR_USERNAME`  | Your GitHub username                     |
| `GHCR_PAT`       | GitHub PAT with `read:packages` scope    |

> The `GHCR_PAT` is needed on the VPS side to pull private images from GHCR. Generate one at: GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic) > `read:packages` scope.

### First-time VPS setup

```bash
# 1. Create the env file directory
sudo mkdir -p /opt/tmng

# 2. Copy the .env.production.example, fill in real values
sudo nano /opt/tmng/.env

# 3. Ensure Docker can reach the host's PostgreSQL
# In /etc/postgresql/15/main/pg_hba.conf, allow connections from Docker:
#   host all all 172.17.0.0/16 md5
# Then: sudo systemctl reload postgresql

# 4. Configure Nginx (see apps/api/nginx.conf.example)
sudo cp nginx.conf.example /etc/nginx/sites-available/saas-api
sudo ln -s /etc/nginx/sites-available/saas-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Manual Deployment (Portainer)

If you prefer not to use the GitHub Actions pipeline:

1. **Build locally and push:**
   ```bash
   docker build -t ghcr.io/YOUR_USERNAME/saas-api:latest -f apps/api/Dockerfile .
   docker push ghcr.io/YOUR_USERNAME/saas-api:latest
   ```

2. **In Portainer** > Containers > Add container:
   - Image: `ghcr.io/YOUR_USERNAME/saas-api:latest`
   - Port mapping: `8787:8787`
   - Env file: `/opt/tmng/.env`
   - Extra host: `host.docker.internal:host-gateway`
   - Restart policy: `unless-stopped`

3. **Or use docker-compose** (`apps/api/docker-compose.yml`):
   ```bash
   cd apps/api
   GHCR_OWNER=YOUR_USERNAME docker compose up -d
   ```

## Operations

### View logs
```bash
docker logs -f saas-api
```

### Restart
```bash
docker restart saas-api
```

### Update manually
```bash
docker pull ghcr.io/YOUR_USERNAME/saas-api:latest
docker stop saas-api && docker rm saas-api
docker run -d --name saas-api --restart unless-stopped \
  --env-file /opt/tmng/.env -p 8787:8787 \
  --add-host=host.docker.internal:host-gateway \
  ghcr.io/YOUR_USERNAME/saas-api:latest
```

### Rollback
```bash
# List available image tags
docker images ghcr.io/YOUR_USERNAME/saas-api

# Run a specific version (use the SHA tag from the GitHub Actions build)
docker stop saas-api && docker rm saas-api
docker run -d --name saas-api --restart unless-stopped \
  --env-file /opt/tmng/.env -p 8787:8787 \
  --add-host=host.docker.internal:host-gateway \
  ghcr.io/YOUR_USERNAME/saas-api:<commit-sha>
```

### Health check
```bash
curl http://localhost:8787/api/health
```

## Database Backups

The project includes automated database backups via `pg_dump`, with gzip compression and a 7-day retention policy. Backups are stored in `/var/backups/tmng-db` by default.

### Strategy

| Setting        | Default              | Description                          |
| -------------- | -------------------- | ------------------------------------ |
| Backup tool    | `pg_dump`            | Full logical dump                     |
| Compression    | gzip                 | Reduces storage                      |
| Retention      | 7 days               | Older backups are deleted            |
| Backup dir     | `/var/backups/tmng-db` | Override with `BACKUP_DIR` env var |

### Setting up the cron job

1. Copy the example and edit:
   ```bash
   cp scripts/backup-cron.example /tmp/tmng-backup-cron
   nano /tmp/tmng-backup-cron
   ```

2. Set `DATABASE_URL` to your production connection string. Use the same host as the API (e.g. `localhost` or `host.docker.internal` if PostgreSQL is on the host).

3. Replace `/path/to/tmng-saas-platform` with the actual project path on the VPS.

4. Add to crontab:
   ```bash
   crontab -e
   # Paste the line from backup-cron.example
   ```

5. Ensure the log file is writable:
   ```bash
   sudo touch /var/log/tmng-backup.log
   sudo chown $(whoami) /var/log/tmng-backup.log
   ```

### Manual backup

Run the backup script manually:

```bash
cd /path/to/tmng-saas-platform
DATABASE_URL="postgresql://user:pass@localhost:5432/saas-api" ./scripts/backup-db.sh
```

Or with individual PG vars:

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=saas-api PGPASSWORD=xxx ./scripts/backup-db.sh
```

### Restoring from a backup

1. List available backups:
   ```bash
   ls -lh /var/backups/tmng-db/barber_*.sql.gz
   ```

2. Run the restore script (it will prompt for confirmation):
   ```bash
   DATABASE_URL="postgresql://..." ./scripts/restore-db.sh /var/backups/tmng-db/barber_20250228_020001.sql.gz
   ```

> **Warning:** Restore overwrites the current database. Stop the API or ensure no writes occur during restore.

### Verifying backups

- Check that files exist and have non-zero size:
  ```bash
  ls -lh /var/log/tmng-backup.log
  tail -20 /var/log/tmng-backup.log
  ls -lh /var/backups/tmng-db/
  ```

- Test restore on a staging database before relying on backups in production.

## Local Development

No Docker needed for local dev. The API runs directly with Node.js + tsx:

```bash
cd apps/api
pnpm dev          # Starts on http://localhost:8787 (watches for changes)
```

Environment variables are loaded from `apps/api/.dev.vars` (same format as Wrangler).
