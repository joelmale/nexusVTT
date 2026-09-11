# Reverse Proxy Configuration Notes

This file name is historical. The current deployment does not require Nginx
Proxy Manager. Use these notes for any reverse proxy that can join the Docker
network used by the Nexus VTT frontend container.

## Current Deployment Model

Nexus VTT runs as a Dockhand-managed Docker Compose stack on one Docker Engine
server.

- Compose file: `docker/docker-compose.yml`
- Public upstream: `frontend:80`
- Shared proxy network: `PROXY_NETWORK`, default `homelab-net`
- Internal backend: reached by frontend nginx as `backend:5001`
- Not required: Docker Swarm, Portainer, or Nginx Proxy Manager

## Required Routing

Route the public app hostname to the frontend container:

```text
https://app.nexusvtt.com -> http://frontend:80
```

The public reverse proxy should not route directly to `backend`,
`asset-service`, `postgres`, or `redis`.

The frontend container's nginx configuration handles these paths internally:

| Path | Handled by |
| --- | --- |
| `/` | React SPA |
| `/health` | frontend nginx health response |
| `/api` | proxied to backend |
| `/auth` | proxied to backend |
| `/ws` | proxied to backend WebSocket server |
| `/library` | proxied to backend |
| `/library-assets` | proxied to backend |

## Required Headers

Configure the public proxy to preserve:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

For WebSocket upgrade support:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Longer read/send timeouts are helpful for active game sessions.

## Example Nginx Server

Use this only as a shape reference. Adjust certificate paths, network names, and
container names for your actual proxy.

```nginx
server {
    listen 443 ssl http2;
    server_name app.nexusvtt.com;

    ssl_certificate /etc/letsencrypt/live/app.nexusvtt.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.nexusvtt.com/privkey.pem;

    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

## Network Checklist

1. The proxy container is attached to the Docker network named by
   `PROXY_NETWORK`.
2. The Nexus VTT `frontend` service is attached to that same external network.
3. The proxy target is `frontend:80`.
4. TLS terminates at the public proxy.
5. `/ws` supports upgrades.

Create the default network if it does not exist:

```bash
docker network create homelab-net
```

## Verification

```bash
curl -I https://app.nexusvtt.com
curl https://app.nexusvtt.com/health
curl https://app.nexusvtt.com/api/system/health
```

Browser checks:

1. Open DevTools.
2. Create or join a room.
3. Confirm the WebSocket connects to `wss://app.nexusvtt.com/ws`.
4. Confirm session cookies are present for `app.nexusvtt.com`.

## Common Failures

### 502 from the public proxy

- The proxy is not attached to `PROXY_NETWORK`.
- The upstream name is not `frontend`.
- The frontend container is not running.

### Frontend loads but API calls fail

- The public proxy is bypassing frontend nginx and routing paths itself.
- The backend cannot reach PostgreSQL or Redis.
- `DATABASE_URL` or `REDIS_PASSWORD` is wrong in Dockhand.

### WebSocket fails

- The public proxy is not forwarding upgrade headers.
- The proxy timeout is too short.
- The frontend container is stale and does not include the current
  `docker/nginx.conf`.

### OAuth redirects fail

- `GOOGLE_CALLBACK_URL` or `DISCORD_CALLBACK_URL` is wrong in Dockhand.
- The provider console does not contain the exact HTTPS callback.
- `X-Forwarded-Proto` is not preserved, so the backend sees the request as
  plain HTTP.
