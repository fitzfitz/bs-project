# MinIO Object Storage Deployment Guide

This guide will walk you through deploying a MinIO S3-compatible object storage server on your VPS using Docker. MinIO provides a self-hosted, performant alternative to AWS S3 for storing media assets like barber photos, branch images, review photos, and product images.

---

## Prerequisites

1. **A VPS** (Ubuntu/Debian recommended) — same VPS as your Soketi server is fine
2. **Docker & Docker Compose** installed
3. **A Domain or Subdomain** pointing to your VPS IP (e.g., `media.yourdomain.com`)
4. **Nginx** installed for reverse proxying and SSL
5. **At least 10GB free disk space** for media storage

---

## Step 1: Create the Setup Directory

SSH into your VPS and create a directory for MinIO configuration and data.

```bash
mkdir -p ~/minio-server/data
cd ~/minio-server
```

## Step 2: Create the Environment File

Create an `.env` file inside `~/minio-server`. These credentials are used to access the MinIO admin console and API.

```bash
nano .env
```

Paste the following, replacing the secret key with a strong password:

> [!TIP] > **How to generate a secure secret key:** > `openssl rand -base64 32`

```env
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=themonograf2026
MINIO_BROWSER_REDIRECT_URL=http://57.128.251.45:5556
# Note: MinIO API runs on port 5555, Console on port 5556
```

## Step 3: Create the Docker Compose File

Create a `docker-compose.yml` file to run the MinIO container.

```bash
nano docker-compose.yml
```

Paste the following configuration:

```yaml
version: "3"

services:
  minio:
    image: minio/minio:latest
    container_name: minio
    restart: unless-stopped
    ports:
      - "5555:9000" # S3 API endpoint
      - "5556:9001" # Admin Console (Web UI)
    env_file:
      - .env
    volumes:
      - ./data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Step 4: Start the Server

Run the container in detached mode:

```bash
docker-compose up -d
```

Verify it's running:

```bash
docker logs minio
```

At this point:

- **S3 API** is available at `http://YOUR_VPS_IP:5555`
- **Admin Console** is available at `http://YOUR_VPS_IP:5556`

---

## Step 5: Create the Media Bucket

### Option A: Via the Web Console

1. Open `http://YOUR_VPS_IP:5556` in your browser
2. Log in with `minioadmin` / `your_super_secure_password_here`
3. Click **"Create Bucket"**
4. Name it `saas-project`
5. Set **Access Policy** to `Public` (for read-only public access to assets)

### Option B: Via the MinIO CLI (`mc`)

Install the MinIO client on your VPS:

```bash
curl https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
chmod +x /usr/local/bin/mc
```

Configure and create bucket:

```bash
# Add your MinIO server as an alias
mc alias set barber http://localhost:9000 barber-admin your_super_secure_password_here

# Create the bucket
mc mb barber/saas-project

# Set bucket policy to public-read (anyone can download, only API can upload)
mc anonymous set download barber/saas-project
```

## Step 6: Create Organized Prefixes (Folders)

Organize media by category:

```bash
# Create organizational prefixes (MinIO creates them on first upload, but we can pre-create policies)
# These are virtual "folders" — MinIO uses flat object storage with prefix-based organization

# The actual folder structure will be:
# saas-project/
#   avatars/       — User profile photos
#   barbers/       — Barber profile photos
#   branches/      — Branch images
#   products/      — Product images
#   reviews/       — Customer review photos
#   receipts/      — Generated receipt PDFs (if needed)
```

---

## Step 7: Secure with SSL (Nginx Reverse Proxy)

Your API and frontend need HTTPS to communicate with MinIO. Set up two Nginx configs: one for the S3 API (upload/download) and one for the admin console.

### 1. Create Nginx Config — S3 API

```bash
sudo nano /etc/nginx/sites-available/minio-api
```

```nginx
server {
    listen 80;
    server_name media.yourdomain.com;

    # Allow large file uploads (up to 10MB)
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5555;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Required for MinIO S3 signature verification
        proxy_set_header X-NginX-Proxy true;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

### 2. Create Nginx Config — Admin Console (Optional)

```bash
sudo nano /etc/nginx/sites-available/minio-console
```

```nginx
server {
    listen 80;
    server_name minio-console.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5556;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support for console
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### 3. Enable and Restart Nginx

```bash
sudo ln -s /etc/nginx/sites-available/minio-api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/minio-console /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Generate Free SSL Certificates (Certbot)

```bash
sudo certbot --nginx -d media.yourdomain.com -d minio-console.yourdomain.com
```

---

## Step 8: Create an API Access Key

For your Hono API to upload files, create a dedicated access key with limited permissions (not the root credentials).

### Via the Admin Console:

1. Open `https://minio-console.yourdomain.com`
2. Go to **Access Keys** → **Create Access Key**
3. Name it `barber-api`
4. Copy the **Access Key** and **Secret Key** — you'll need them for your API env vars
5. Set policy to restrict to `saas-project` bucket only:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": ["arn:aws:s3:::saas-project", "arn:aws:s3:::saas-project/*"]
    }
  ]
}
```

---

## 🚀 You're Done!

Your media storage server is now live and secure! Here is how you will configure your apps moving forward:

### Backend `.env` / `.dev.vars`

Your Hono API server will use the S3 SDK to upload/manage files:

```env
# MinIO / S3 Configuration
S3_ENDPOINT="https://media.yourdomain.com"
S3_ACCESS_KEY="your_api_access_key_here"
S3_SECRET_KEY="your_api_secret_key_here"
S3_BUCKET="saas-project"
S3_REGION="us-east-1"       # MinIO default, doesn't matter for self-hosted
S3_PUBLIC_URL="https://media.yourdomain.com/saas-project"
```

### React App (Frontend)

Your frontend displays images using the public URL pattern:

```typescript
// All media URLs follow this pattern:
const imageUrl = `https://media.yourdomain.com/saas-project/${category}/${fileId}.jpg`;

// Examples:
// Avatar:  https://media.yourdomain.com/saas-project/avatars/cm3abc123.jpg
// Review:  https://media.yourdomain.com/saas-project/reviews/cm3def456.jpg
// Product: https://media.yourdomain.com/saas-project/products/cm3ghi789.jpg
```

### API Upload Integration

In your Hono API, use the AWS S3 SDK (compatible with MinIO):

```typescript
// utils/s3.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export function createS3Client() {
  return new S3Client({
    region: process.env.S3_REGION!,
    endpoint: process.env.S3_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: true, // Required for MinIO
  });
}

export async function uploadFile(
  s3: S3Client,
  category: string,
  fileId: string,
  fileBuffer: ArrayBuffer,
  contentType: string
): Promise<string> {
  const key = `${category}/${fileId}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: "saas-project",
      Key: key,
      Body: new Uint8Array(fileBuffer),
      ContentType: contentType,
    })
  );

  return `${process.env.S3_PUBLIC_URL}/${key}`;
}
```

---

## Asset Documentation

All uploaded media assets should be documented with their storage key and purpose. Use the MinIO Console to browse assets or the CLI:

```bash
# List all assets in a category
mc ls barber/saas-project/avatars/

# Get info about a specific asset
mc stat barber/saas-project/avatars/cm3abc123.jpg

# Download an asset
mc cp barber/saas-project/avatars/cm3abc123.jpg ./local-copy.jpg
```

### Storage Key Format

| Category       | Key Pattern                         | Example                  |
| -------------- | ----------------------------------- | ------------------------ |
| User Avatars   | `avatars/{userId}.{ext}`            | `avatars/cm3abc123.jpg`  |
| Barber Photos  | `barbers/{barberProfileId}.{ext}`   | `barbers/cm3def456.jpg`  |
| Branch Images  | `branches/{branchId}/{index}.{ext}` | `branches/cm3ghi/0.jpg`  |
| Product Images | `products/{productId}.{ext}`        | `products/cm3jkl789.jpg` |
| Review Photos  | `reviews/{reviewId}/{index}.{ext}`  | `reviews/cm3mno/0.jpg`   |

---

## Monitoring & Maintenance

### Check disk usage:

```bash
mc du barber/saas-project
```

### Check server health:

```bash
mc admin info barber
```

### Backup all media:

```bash
mc mirror barber/saas-project ./backup/saas-project-$(date +%Y%m%d)
```

### Restart MinIO:

```bash
cd ~/minio-server
docker-compose restart
```
