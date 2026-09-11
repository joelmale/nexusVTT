# AWS Deployment Option

This is a planning guide, not a live runbook.

## Recommended First Trial

Start with ECS Fargate using the existing GHCR images:

- `frontend` service behind an Application Load Balancer
- `backend` service private to the VPC
- `asset-service` service private to the VPC
- RDS PostgreSQL
- ElastiCache Redis
- S3 for document/object storage if NexusCodex file transfer is included

## Required Work

1. Create an ECS cluster and task definitions for frontend, backend, and
   asset-service.
2. Store secrets in AWS Secrets Manager or SSM Parameter Store.
3. Configure RDS PostgreSQL and run migrations before backend rollout.
4. Configure ElastiCache Redis for realtime coordination.
5. Route public HTTPS traffic to the frontend service.
6. Preserve WebSocket upgrade support for `/ws`.
7. Run `/health`, `/api/system/health`, and multiplayer soak validation.

## Open Questions

- Whether to keep GHCR as the registry or mirror to ECR.
- Whether NexusCodex object storage uses S3 directly or backend streaming.
- Whether Terraform/CDK should own the first implementation.
