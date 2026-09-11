# Cloud Deployment Options

Production currently runs on the Dockhand-managed homelab stack. This folder is
for evaluating the three major cloud targets without mixing experimental cloud
choices into the live homelab runbook.

## Baseline

All cloud options should start from the same image model:

- `ghcr.io/joelmale/nexusvtt/frontend`
- `ghcr.io/joelmale/nexusvtt/backend`
- `ghcr.io/joelmale/nexusvtt/asset-service`
- `ghcr.io/joelmale/nexusvtt/postgres`

Cloud-specific registries are optional optimizations. Reusing GHCR first keeps
the experiment smaller.

## Comparison

| Cloud | First Trial Shape | Managed Data Services | Notes |
| --- | --- | --- | --- |
| AWS | ECS Fargate or single EC2 Compose | RDS PostgreSQL, ElastiCache Redis, S3 | Lowest-friction managed-container path is ECS. |
| Azure | Azure Container Apps | Azure Database for PostgreSQL, Azure Cache for Redis, Blob Storage | Good fit for Compose-like services without managing AKS. |
| Google Cloud | GCE Compose first, then GKE or Cloud Run | Cloud SQL, Memorystore, Cloud Storage | Existing guide starts here. |

## Guides

- [AWS](aws.md)
- [Azure](azure.md)
- [Google Cloud](gcp.md)

Do not treat these as production runbooks until one is selected, implemented,
and validated against the same health, migration, and multiplayer soak gates as
the homelab deployment.
