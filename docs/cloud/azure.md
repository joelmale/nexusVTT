# Azure Deployment Option

This is a planning guide, not a live runbook.

## Recommended First Trial

Start with Azure Container Apps using the existing GHCR images:

- Public `frontend` container app
- Internal `backend` container app
- Internal `asset-service` container app
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Blob Storage if NexusCodex file transfer is included

## Required Work

1. Create a Container Apps environment.
2. Configure GHCR image pulls or mirror images to Azure Container Registry.
3. Store secrets in Container Apps secrets or Key Vault.
4. Configure PostgreSQL and run migrations before backend rollout.
5. Configure Redis and backend environment variables.
6. Route public HTTPS traffic to the frontend app.
7. Confirm `/ws` WebSocket upgrade support.
8. Run `/health`, `/api/system/health`, and multiplayer soak validation.

## Open Questions

- Whether Azure Container Apps is enough or AKS is needed later.
- Whether document/object storage uses Blob Storage directly or backend
  streaming.
- Whether Bicep or Terraform should own the first implementation.
