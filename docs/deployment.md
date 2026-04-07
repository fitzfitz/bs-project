# Deployment Guide — TMNG SaaS Platform

## Architecture

The platform consists of three Docker images:

| Image | Base | Port | Description |
|-------|------|------|-------------|
| `saas-api` | Node.js 22 + `@hono/node-server` | 8787 | REST API server |
| `barber-client` | Nginx (Alpine) | 80 | Customer PWA (static SPA) |
| `barber-admin` | Nginx (Alpine) | 80 | Admin dashboard (static SPA) |

PostgreSQL runs on the same VPS host for sub-millisecond database latency.

```
Internet ──> Nginx (reverse proxy, port 80/443)
               ├── /api/*   ──> Docker: saas-api      (port 8787)
               ├── /        ──> Docker: barber-client  (port 3000→80)
               └── /admin/* ──> Docker: barber-admin   (port 3001→80)
               └── PostgreSQL (localhost:5432)
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
| `PUSHER_APP_ID`       | Yes      | Soketi app ID (e.g. `app-id` if using default) |
| `PUSHER_KEY`          | Yes      | Soketi key (e.g. `app-key` if using default) |
| `PUSHER_SECRET`       | Yes      | Soketi secret (e.g. `app-secret` if using default)|
| `PUSHER_CLUSTER`      | No       | Default: `mt1`                             |
| `PUSHER_HOST`         | Yes      | Soketi server hostname                     |
| `PUSHER_PORT`         | No       | Default: `443`                             |
| `PUSHER_USE_TLS`      | No       | Default: `true`                            |
| `GOOGLE_CLIENT_ID`    | No       | Google OAuth client ID for JWKS verification |
| `XENDIT_SECRET_KEY`   | No       | Xendit payment gateway (omit for CASH)     |
| `XENDIT_WEBHOOK_TOKEN`| No       | Xendit webhook verification token          |
| `RESEND_API_KEY`      | Yes      | Resend API key for transactional emails    |
| `RESEND_FROM_EMAIL`   | Yes      | Verified "from" email/domain in Resend     |

> **Important:** When PostgreSQL runs on the VPS host (not in Docker), set `DATABASE_URL` to use `host.docker.internal` as the hostname, e.g.: `postgresql://user:pass@host.docker.internal:5432/saas-api`

## CI/CD Pipeline (GitHub Actions)

### How it works

The CI pipeline has three jobs (defined in `.github/workflows/ci.yml`):

1. **`verify`** — Runs on all pushes and PRs to `main`. Installs dependencies, runs lint, typecheck, and test across the monorepo.
2. **`build-and-push`** — On `main` pushes only (after `verify` passes). Builds Docker images for all three apps (`saas-api`, `barber-client`, `barber-admin`) and pushes to GHCR with both `latest` and commit SHA tags. Frontend images receive `VITE_API_URL` as a build arg.
3. **`deploy-staging`** — On `main` pushes only (after `build-and-push`). SSHs into the staging server, pulls the latest images, and restarts the containers. Uses the GitHub `staging` environment for secrets.

The workflow can also be triggered manually via `workflow_dispatch`.

### Required GitHub Secrets

Set these in your repo: **Settings > Secrets and variables > Actions**

| Secret           | Value                                    |
| ---------------- | ---------------------------------------- |
| `GITHUB_TOKEN`   | Auto-provided by GitHub Actions (GHCR login) |

### Staging Environment Secrets

Set these under the `staging` environment: **Settings > Environments > staging**

| Secret             | Value                                    |
| ------------------ | ---------------------------------------- |
| `STAGING_HOST`     | Staging server IP or hostname            |
| `STAGING_USER`     | SSH username on the staging server       |
| `STAGING_SSH_KEY`  | Private SSH key (full PEM content)       |

### VPS Secrets (for production, if using manual deploy or GHCR pull)

| Secret           | Value                                    |
| ---------------- | ---------------------------------------- |
| `VPS_HOST`       | VPS IP address (e.g. `57.128.251.45`)    |
| `VPS_USER`       | SSH username on the VPS                  |
| `VPS_SSH_KEY`    | Private SSH key (the full PEM content)   |
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

## Docker Images

### API (`apps/api/Dockerfile`)

Multi-stage build: installs pnpm deps, generates Prisma client, compiles TS, runs Node.js.

```bash
docker build -t ghcr.io/YOUR_USERNAME/saas-api:latest -f apps/api/Dockerfile .
```

### Client PWA (`apps/client/Dockerfile`)

Multi-stage build: installs pnpm deps, runs Vite build, serves static files with Nginx.

```bash
docker build -t ghcr.io/YOUR_USERNAME/barber-client:latest \
  --build-arg VITE_API_URL=https://api.yourdomain.com \
  -f apps/client/Dockerfile .
```

### Admin Dashboard (`apps/admin/Dockerfile`)

Same multi-stage pattern as client. Nginx serves the SPA with `try_files` fallback.

```bash
docker build -t ghcr.io/YOUR_USERNAME/barber-admin:latest \
  --build-arg VITE_API_URL=https://api.yourdomain.com \
  -f apps/admin/Dockerfile .
```

### Nginx Configuration (Client & Admin)

Both frontend images include `nginx.conf` that provides:
- SPA routing (`try_files $uri $uri/ /index.html`)
- 1-year cache headers for hashed assets (`/assets/`)
- Gzip compression for text-based content types

## Manual Deployment (Portainer)

If you prefer not to use the GitHub Actions pipeline:

1. **Build locally and push all three images:**
   ```bash
   docker build -t ghcr.io/YOUR_USERNAME/saas-api:latest -f apps/api/Dockerfile .
   docker build -t ghcr.io/YOUR_USERNAME/barber-client:latest --build-arg VITE_API_URL=https://api.yourdomain.com -f apps/client/Dockerfile .
   docker build -t ghcr.io/YOUR_USERNAME/barber-admin:latest --build-arg VITE_API_URL=https://api.yourdomain.com -f apps/admin/Dockerfile .
   docker push ghcr.io/YOUR_USERNAME/saas-api:latest
   docker push ghcr.io/YOUR_USERNAME/barber-client:latest
   docker push ghcr.io/YOUR_USERNAME/barber-admin:latest
   ```

2. **In Portainer** > Containers > Add container (repeat for each image):

   **saas-api:**
   - Image: `ghcr.io/YOUR_USERNAME/saas-api:latest`
   - Port mapping: `8787:8787`
   - Env file: `/opt/tmng/.env`
   - Extra host: `host.docker.internal:host-gateway`
   - Restart policy: `unless-stopped`

   **barber-client:**
   - Image: `ghcr.io/YOUR_USERNAME/barber-client:latest`
   - Port mapping: `3000:80`
   - Restart policy: `unless-stopped`

   **barber-admin:**
   - Image: `ghcr.io/YOUR_USERNAME/barber-admin:latest`
   - Port mapping: `3001:80`
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

---

## Service Setup: Soketi (WebSocket Server)

Soketi is a self-hosted, Pusher-compatible WebSocket server used for real-time queue updates.

### Docker Compose

```yaml
# ~/soketi-server/docker-compose.yml
version: '3'
services:
  soketi:
    image: quay.io/soketi/soketi:1.6-16-alpine
    container_name: barber-soketi
    restart: unless-stopped
    ports:
      - "6001:6001"
    env_file:
      - .env
```

### Environment (`~/soketi-server/.env`)

```env
SOKETI_DEBUG=true
SOKETI_DEFAULT_APP_ID=app-id
SOKETI_DEFAULT_APP_KEY=app-key
SOKETI_DEFAULT_APP_SECRET=app-secret
# (Use Soketi defaults locally to prevent handshake errors, but use secure keys in real production deployment with matching backend envs)
```

### Nginx (SSL reverse proxy)

```nginx
server {
    listen 80;
    server_name ws.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:6001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

Then `sudo certbot --nginx -d ws.yourdomain.com` for SSL.

### API Config

```env
PUSHER_APP_ID="barber-queue-app"
PUSHER_KEY="<your-key>"
PUSHER_SECRET="<your-secret>"
PUSHER_HOST="ws.yourdomain.com"
PUSHER_PORT="443"
PUSHER_USE_TLS="true"
```

---

## Service Setup: MinIO (Media Storage)

MinIO is a self-hosted S3-compatible object storage for photos and media.

### Docker Compose

```yaml
# ~/minio-server/docker-compose.yml
version: "3"
services:
  minio:
    image: minio/minio:latest
    container_name: minio
    restart: unless-stopped
    ports:
      - "5555:9000"  # S3 API
      - "5556:9001"  # Admin Console
    env_file:
      - .env
    volumes:
      - ./data:/data
    command: server /data --console-address ":9001"
```

### Environment (`~/minio-server/.env`)

```env
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<secure-password>
```

### Bucket Setup

Create a `saas-project` bucket with public-read policy:

```bash
mc alias set barber http://localhost:9000 minioadmin <password>
mc mb barber/saas-project
mc anonymous set download barber/saas-project
```

### Nginx (SSL reverse proxy)

```nginx
server {
    listen 80;
    server_name media.yourdomain.com;
    client_max_body_size 10M;
    location / {
        proxy_pass http://127.0.0.1:5555;
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

Then `sudo certbot --nginx -d media.yourdomain.com` for SSL.

### API Config

```env
S3_ENDPOINT="https://media.yourdomain.com"
S3_ACCESS_KEY="<api-access-key>"
S3_SECRET_KEY="<api-secret-key>"
S3_BUCKET="saas-project"
S3_REGION="us-east-1"
S3_PUBLIC_URL="https://media.yourdomain.com/saas-project"
```

### Storage Key Format

| Category | Key Pattern | Example |
|----------|------------|---------|
| User Avatars | `avatars/{userId}.{ext}` | `avatars/cm3abc123.jpg` |
| Staff Photos | `barbers/{profileId}.{ext}` | `barbers/cm3def456.jpg` |
| Branch Images | `branches/{branchId}/{index}.{ext}` | `branches/cm3ghi/0.jpg` |
| Product Images | `products/{productId}.{ext}` | `products/cm3jkl789.jpg` |
| Review Photos | `reviews/{reviewId}/{index}.{ext}` | `reviews/cm3mno/0.jpg` |

---

## Service Setup: OneSignal (Push Notifications Only)

OneSignal free tier provides web push notifications for up to 10,000 subscribers.

### Setup Steps

1. Create app at [onesignal.com](https://onesignal.com) (Web platform, Custom Code integration)
2. Configure site URL to your production client domain
3. Note the **App ID** and **REST API Key** from Settings > Keys & IDs
4. Note the **App ID** and **REST API Key** from Settings > Keys & IDs

### Client Config

The client PWA has a `NotificationProvider` that initializes OneSignal and binds user External IDs. Place the service worker file at `apps/client/public/OneSignalSDKWorker.js`:

```javascript
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```

> **Note:** The `NotificationProvider` also implements a `foregroundWillDisplay` listener. This ensures that if the app is currently open, receiving a push notification acts as a fallback to gracefully invalidate TanStack Query caches, independently synchronizing the UI in case the primary WebSocket drops.

```env
# apps/client/.env
VITE_ONESIGNAL_APP_ID=your-app-id
```

### API Config

```env
ONESIGNAL_APP_ID=your-app-id
ONESIGNAL_REST_API_KEY=your-rest-api-key
```

The `NotificationService` in `utils/notifications.ts` gracefully degrades to structured logs when these vars are absent.

---

## Service Setup: Twilio (WhatsApp + SMS)

Twilio provides WhatsApp Business API and SMS messaging.

### API Config

```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_SMS_FROM=+1234567890
```

Both channels gracefully degrade when env vars are absent. Admin can toggle push/WhatsApp/SMS per notification type via the admin dashboard.

---

## Service Setup: Email (SMTP — Reports Only)

SMTP is used exclusively for **scheduled report delivery** (PDF + CSV attachments via `utils/email.ts`). **User-facing notification emails** (booking confirmations, receipts, reminders) are handled via Resend — not SMTP.

### API Config

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM=reports@yourdomain.com
```

When unset, email sends are skipped with structured log messages.
