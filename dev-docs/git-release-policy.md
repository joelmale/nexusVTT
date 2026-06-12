# Git & Release Policy

## Branching Model

```
master  ←  the single deployable branch
           every merge here triggers CI + image build
```

Feature branches are optional for large changes but not required. Small fixes can go directly to master. The rule: **master must always be deployable**.

---

## Day-to-Day Commit / Push Cycle

```bash
git add <files>
git commit -m "type: short description"
git push origin master
```

Every push to master automatically:

- Runs CodeQL analysis, Trivy filesystem scan, and container scans (`security.yml`)
- Builds and pushes Docker images to GHCR tagged with `date+sha` **and** `latest` (`build-and-push.yml`)
- Generates CycloneDX SBOMs stored as 90-day workflow artifacts

No manual steps required for normal development. Your `docker-compose.yml` uses `VERSION=latest`, so the homelab stack picks up the newest build on the next `docker stack deploy`.

---

## Commit Message Convention

```
type: short description (imperative, under 72 chars)
```

| Type | When to use |
|---|---|
| `feat` | New user-facing functionality |
| `fix` | Bug fix |
| `ci` | CI/CD workflow changes |
| `docs` | Documentation only |
| `refactor` | Code restructure, no behaviour change |
| `test` | Adding or updating tests |
| `chore` | Dependency bumps, config, tooling |

Examples:
```
feat: add fog of war toggle to scene editor
fix: resolve WebSocket reconnect storm under poor connections
ci: add CycloneDX SBOM generation to security workflow
```

---

## Versioned Releases

Use a tagged release when you want a **named, stable milestone** — something you can roll back to by name, share as a changelog entry, or attach a formal SBOM to for audit purposes.

You do not need to cut a release for every push. `latest` handles continuous deployment. Releases are for significant checkpoints.

### Step 1 — Tag the commit

```bash
git tag v1.2.0
git push origin v1.2.0
```

This triggers `build-and-push.yml` a second time, producing images tagged **both** `v1.2.0` and `latest` in GHCR:

```
ghcr.io/joelmale/nexusvtt/frontend:v1.2.0
ghcr.io/joelmale/nexusvtt/frontend:latest   ← updated
ghcr.io/joelmale/nexusvtt/backend:v1.2.0
ghcr.io/joelmale/nexusvtt/backend:latest    ← updated
```

### Step 2 — Publish the GitHub release

```bash
gh release create v1.2.0 \
  --title "Nexus VTT v1.2.0" \
  --generate-notes
```

`--generate-notes` auto-populates the release body from commit messages since the last tag. Edit it in the GitHub UI before publishing if you want a curated changelog.

Publishing the release triggers the `sbom` job in `security.yml`, which attaches three CycloneDX SBOM files directly to the release as downloadable assets:

- `sbom-filesystem.cdx.json` — full npm dependency tree
- `sbom-frontend.cdx.json` — frontend container (nginx Alpine + app)
- `sbom-backend.cdx.json` — backend container (Node.js Alpine + app)

### Tagging convention

Use [semantic versioning](https://semver.org): `vMAJOR.MINOR.PATCH`

| Segment | Increment when |
|---|---|
| `MAJOR` | Breaking change (users must take action on upgrade) |
| `MINOR` | New feature, backwards compatible |
| `PATCH` | Bug fix or small improvement |

---

## Deploying a Specific Version

The `docker-compose.yml` reads `VERSION` from the environment. To pin to a specific release:

```bash
# On the swarm manager node
VERSION=v1.2.0 docker stack deploy -c docker/docker-compose.yml nexus-vtt2
```

To roll back to the previous version:

```bash
VERSION=v1.1.0 docker stack deploy -c docker/docker-compose.yml nexus-vtt2
```

To return to continuous `latest` deploys:

```bash
docker stack deploy -c docker/docker-compose.yml nexus-vtt2
# VERSION defaults to 'latest' if unset
```

---

## Image Tags in GHCR

| Tag format | Created by | Use case |
|---|---|---|
| `latest` | Every master push | Homelab continuous deploy |
| `20260611-53eaf57` | Every master push | Point-in-time reference, safe rollback without a named release |
| `v1.2.0` | `git push origin v1.2.0` | Formal versioned release |

The date+sha tags never move — they are permanent references to the exact build that ran at that commit. `latest` always moves forward.

---

## SBOM & Vulnerability Tracking

CycloneDX SBOMs are generated on every master push (90-day artifacts) and permanently attached to tagged releases.

To use them for longitudinal CVE tracking:

1. Run [Dependency-Track](https://dependencytrack.org) on the homelab (Docker image available)
2. Upload the `.cdx.json` files — either manually or by adding a `curl` POST step to the workflow
3. Dependency-Track maps each component against NVD/OSV/GitHub Advisories and tracks vulnerability state over time

GitHub's native dependency graph only supports SPDX format, not CycloneDX. If you want GitHub-native tracking without a separate tool, a parallel SPDX generation step can be added.

---

## CI Workflow Summary

| Workflow | Triggers | What it does |
|---|---|---|
| `security.yml` | push to master, release published | CodeQL, Trivy fs scan, container scans, SBOM generation |
| `build-and-push.yml` | push to master, push `v*` tag, manual | Build + push all three Docker images to GHCR |
| `ci.yml` | push, pull_request | Lint, type-check, unit + integration tests |
