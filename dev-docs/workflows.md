# Workflows

This repo uses a minimal GitHub Actions setup to keep feedback fast and focused.

## CI Pipeline (`.github/workflows/ci.yml`)

**Purpose:** Validate code quality and tests on pushes and PRs.

**Triggers**
- Push to `master`
- Pull request targeting `master`
- Manual dispatch

**Jobs**
- Lint & Type Check: `cd apps/vtt && npm run lint` and `npm run type-check`.
- Unit Tests (sharded 1/3): `cd apps/vtt && npm run test:unit -- --shard=N/3`.
- Integration Tests: `docker compose -f apps/vtt/docker/docker-compose.test.yml up --build --abort-on-container-exit`.

**Notes**
- Unit tests are sharded across 3 jobs to keep runtime low.
- Integration tests run after lint/type checks.

## Build & Push Images (`.github/workflows/build-and-push.yml`)

**Purpose:** Build Docker images and push to GHCR for Portainer to pull.

**Triggers**
- Push to `master`
- Tag starting with `v*`
- Manual dispatch

**Jobs**
- Build & Push to GHCR:
  - Builds `frontend`, `backend`, and `postgres` images.
  - Pushes both a versioned tag and `latest`.

**Versioning**
- Tag builds: `vX.Y.Z` produces `X.Y.Z`.
- Non-tag builds: `YYYYMMDD-<short-sha>`.

**Runtime inputs**
- `VERSION` and `COMMIT_SHA` build args are passed to image builds.

**Operational flow**
- Portainer pulls `ghcr.io/joelmale/nexusvtt/<service>:latest`.

## Security Scan (`.github/workflows/security.yml`)

**Purpose:** Periodic security coverage without slowing every push.

**Triggers**
- Weekly schedule (Sunday 03:00 UTC)
- Manual dispatch

**Jobs**
- CodeQL Analysis (JavaScript/TypeScript).
- Container Security Scan (frontend, backend) with Trivy and Grype.

## Updating Workflow Behavior

If you need more coverage, consider:
- Moving container scans into CI for PRs.
- Adding dependency scanning on a schedule.
- Adding a release workflow for tagged deploys.
