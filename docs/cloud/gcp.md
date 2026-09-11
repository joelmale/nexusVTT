# Google Cloud Deployment Option

This is a planning guide, not the live production runbook. Production currently
runs on the Dockhand-managed homelab stack.

## Recommended First Trial

Start with a single GCE VM running Docker Compose and the existing GHCR images.
That mirrors the homelab closely and keeps the first cloud test small.

After the VM trial works, evaluate either:

- GKE for Kubernetes-native scaling and managed ingress
- Cloud Run for service-by-service serverless containers

## Baseline Images

Use the images already published by CI:

- `ghcr.io/joelmale/nexusvtt/frontend`
- `ghcr.io/joelmale/nexusvtt/backend`
- `ghcr.io/joelmale/nexusvtt/asset-service`
- `ghcr.io/joelmale/nexusvtt/postgres`

Artifact Registry mirroring is optional for later.

## GCE Compose Trial

1. Create a VM with enough memory for the app and supporting services.
2. Install Docker Engine and the Docker Compose plugin.
3. Clone the repository.
4. Create the external proxy network expected by Compose:

   ```bash
   docker network create homelab-net
   ```

5. Configure production environment variables from
   [Production Deployment](../../DEPLOYMENT.md).
6. Start the stack:

   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

7. Put a TLS reverse proxy in front of `frontend:80`.
8. Run the standard health checks:

   ```bash
   curl https://<host>/health
   curl https://<host>/api/system/health
   curl https://<host>/api/metrics/multiplayer
   ```

## Managed GCP Shape

For a more cloud-native trial:

- Cloud SQL for PostgreSQL
- Memorystore for Redis
- Cloud Storage for object/document storage
- GKE or Cloud Run for containers
- Secret Manager for runtime secrets
- External HTTPS Load Balancer for TLS and WebSocket routing

## Required Validation

Before treating a GCP deployment as viable:

1. Apply database migrations in order.
2. Confirm OAuth callbacks match the public hostname.
3. Confirm `/ws` WebSocket upgrades work through the load balancer.
4. Run `npm run test:e2e`.
5. Run the managed multiplayer soak profile against the public URL.
