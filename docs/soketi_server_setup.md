# Soketi WebSocket Deployment Guide

This guide will walk you through deploying the Soketi WebSocket server on your VPS using Docker. Soketi provides a self-hosted, ultra-fast alternative to Pusher that is 100% compatible with the Pusher protocol.

---

## Prerequisites
1. **A VPS** (Ubuntu/Debian recommended)
2. **Docker & Docker Compose** installed
3. **A Domain or Subdomain** pointing to your VPS IP (e.g., `ws.yourdomain.com`)
4. **Nginx** installed for reverse proxying and SSL

---

## Step 1: Create the Setup Directory

SSH into your VPS and create a directory for the Soketi configuration.

```bash
mkdir ~/soketi-server
cd ~/soketi-server
```

## Step 2: Create the Environment File

Create an `.env` file **on your host VPS** (inside `~/soketi-server`). Docker Compose will automatically inject these variables into the container when it starts. This is what your API server and React app will use to authenticate with Soketi.

```bash
nano .env
```

Paste the following inside, changing the `SOKETI_DEFAULT_APP_KEY` and `SOKETI_DEFAULT_APP_SECRET` to secure, random strings:

> [!TIP]
> **How to generate secure keys:**
> You can generate strong, random 32-character strings right in your VPS terminal by running this command twice (once for the key, once for the secret):
> `openssl rand -hex 16`

```env
SOKETI_DEBUG=true
SOKETI_DEFAULT_APP_ID=barber-queue-app
SOKETI_DEFAULT_APP_KEY=your_secure_public_key_here
SOKETI_DEFAULT_APP_SECRET=your_super_secret_private_key_here
```

## Step 3: Create the Docker Compose File

Create a `docker-compose.yml` file to run the Soketi container.

```bash
nano docker-compose.yml
```

Paste the following configuration:

```yaml
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

## Step 4: Start the Server

Run the container in detached mode:

```bash
docker-compose up -d
```

You can verify it's running by checking the logs:
```bash
docker logs barber-soketi
```

At this point, the raw WebSocket server is running on `http://YOUR_VPS_IP:6001`.

---

## Step 5: Secure with SSL (Nginx Reverse Proxy)

Modern browsers **require** WSS (Secure WebSockets). You cannot connect a browser on `https://` to an unencrypted `ws://` domain. We will use Nginx to add SSL.

### 1. Create Nginx Config
Create a new site configuration for your domain:

```bash
sudo nano /etc/nginx/sites-available/soketi
```

Paste the following setup (replace `ws.yourdomain.com` with your actual subdomain):

```nginx
server {
    listen 80;
    server_name ws.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:6001;
        
        # Critical WebSocket Headers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        
        # Timeouts to keep connections alive
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        
        # Real IP Headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Enable and Restart Nginx
```bash
sudo ln -s /etc/nginx/sites-available/soketi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Generate Free SSL Certificate (Certbot)
If you don't have Certbot installed, run: `sudo apt install certbot python3-certbot-nginx`

Then, request the SSL certificate:
```bash
sudo certbot --nginx -d ws.yourdomain.com
```

---

## 🚀 You're Done!

Your WebSocket server is now live and secure! Here is how you will configure your apps moving forward:

### Backend `.env` / `.dev.vars`
Your Hono API server will POST events to Soketi using these credentials to trigger broadcasts:

```env
PUSHER_APP_ID="barber-queue-app"
PUSHER_KEY="your_secure_public_key_here"
PUSHER_SECRET="your_super_secret_private_key_here"
PUSHER_CLUSTER="mt1" # Not used by Soketi, but required by SDKs
PUSHER_HOST="ws.yourdomain.com"
PUSHER_PORT="443"
PUSHER_USE_TLS="true"
```

### React App (Frontend)
Your frontend will connect using `pusher-js` to listen for updates:

```javascript
import Pusher from 'pusher-js';

const pusher = new Pusher('your_secure_public_key_here', {
  wsHost: 'ws.yourdomain.com',
  wsPort: 443,
  forceTLS: true,
  disableStats: true,
  enabledTransports: ['ws', 'wss'],
});
```
