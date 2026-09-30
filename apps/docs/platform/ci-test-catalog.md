---
title: CI Test Catalog
description: Every automated test job in the Nexus pipelines, what it verifies, where it runs, and how to debug it.
---

# CI test catalog

One entry per automated test job. Fully documented entries show the level of
detail to aim for; the rest are stubs to fill in as each job is next touched.
Pipeline mechanics (lanes, catalog, delivery) live in
[CI/CD pipeline architecture](./ci-cd-pipelines.md).

For each job, record: **Purpose**, **Trigger and gating**, **Workflow and job
id**, **What it runs**, **Environment**, **Artifacts on failure**, **Known
flakes or failure modes**, and **How to reproduce locally**.

## Index

| Job                                    | Workflow                               | Lane             | Gating                   | Documented |
| -------------------------------------- | -------------------------------------- | ---------------- | ------------------------ | ---------- |
| VTT: exact-image managed E2E smoke     | `ci.yml` (`vtt-e2e`)                   | PR               | Yes                      | Yes        |
| VTT: E2E on published images (shadow)  | `delivery.yml` (`vtt-e2e-published`)   | Delivery         | No (`continue-on-error`) | Yes        |
| VTT: managed E2E smoke                 | `nightly.yml` (`vtt-e2e`)              | Nightly          | No                       | Stub       |
| Repository CI contracts                | `ci.yml` (`repository-contracts`)      | PR               | Yes                      | Stub       |
| VTT: lint, type-check, and build       | `ci.yml` (`vtt-static`)                | PR               | Yes                      | Stub       |
| VTT: unit tests (shards 1-3)           | `ci.yml` (`vtt-unit`)                  | PR               | Yes                      | Stub       |
| VTT: UI layout tests                   | `ci.yml` (`vtt-ui`)                    | PR               | Yes                      | Stub       |
| VTT: asset-service tests               | `ci.yml` (`asset-service`)             | PR               | Yes                      | Stub       |
| VTT: database integration suite        | `ci.yml` (`vtt-integration`)           | PR               | Yes                      | Stub       |
| VTT: database integration suite        | `nightly.yml` (`vtt-integration`)      | Nightly          | No                       | Stub       |
| VTT: gateway route matrix              | `ci.yml` (`gateway-contracts`)         | PR               | Yes                      | Stub       |
| VTT: aggregate coverage                | `ci.yml` (`vtt-coverage`)              | PR               | Yes                      | Stub       |
| Control API: validation                | `ci.yml` (`control-api`)               | PR               | Yes                      | Stub       |
| Forge                                  | `ci.yml` (`forge`)                     | PR               | Yes                      | Stub       |
| Codex                                  | `ci.yml` (`codex`)                     | PR               | Yes                      | Stub       |
| Documentation checks                   | `ci.yml` (`docs`)                      | PR               | Yes                      | Stub       |
| Security validation                    | `ci.yml` (`security`)                  | PR               | Yes                      | Stub       |
| Multiplayer soak and chaos             | `nightly.yml` / `multiplayer-soak.yml` | Nightly          | No                       | Stub       |
| Codex full validation                  | `nightly.yml` (`codex-integration`)    | Nightly          | No                       | Stub       |
| Codex OCR: download and execute models | `nightly.yml` (`ocr-model-warmup`)     | Nightly          | No                       | Stub       |
| Codex OCR: RTX A2000 CUDA validation   | `nightly.yml` (`a2000-gpu`)            | Nightly (opt-in) | No                       | Stub       |
| Full security validation               | `nightly.yml` (`security`)             | Nightly          | No                       | Stub       |

The aggregate `All required checks` job in `ci.yml` is what branch protection
requires; it is not a test itself.

## The managed E2E smoke suite

Both E2E jobs below run the same command, `npm run test:e2e` from `apps/vtt`,
which executes `apps/vtt/scripts/run-e2e-smoke.js`. That script starts the
isolated stack in `apps/vtt/docker/docker-compose.smoke.yml` (PostgreSQL, Redis,
two backend replicas, the asset service, and the production frontend), runs the
Playwright `chromium` project against it with one worker and one CI retry, and
tears the stack down. The `ui` Playwright project is not part of this run.

Specs in `apps/vtt/tests/e2e/`:

| Spec                              | Covers                                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system.smoke.spec.ts`            | Service health and guest session round-trip, the complete dice runtime asset graph, bundled Character Forge rendering, offline reload of the warmed shell |
| `journey.smoke.spec.ts`           | A guest host rolls 3D dice and reconnects after backend downtime; the lobby stays usable while the asset service recovers                                 |
| `multiplayer.smoke.spec.ts`       | Two participants converge across replicas through reconnects, a restart, and a stale-base conflict; backend `SIGKILL` after a game-state ACK              |
| `multiplayer-chaos.smoke.spec.ts` | Four clients keep one total order through retries and a replay gap                                                                                        |

These are the only CI tests that exercise the real production images, PostgreSQL,
two replicas, and delta-sync together, so they are the main guard for the
realtime invariants in `apps/vtt/CLAUDE.md` (ACK only after commit,
compare-and-swap writes, version-neutral reconnects, event order).

### VTT: exact-image managed E2E smoke

- **Purpose:** prove the exact commit under review works as a deployed stack.
- **Trigger and gating:** pull requests and merge queue when VTT paths are
  affected, and manual runs. Required through `All required checks`.
- **Workflow and job id:** `.github/workflows/ci.yml`, `vtt-e2e`.
- **What it runs:** builds `backend`, `asset-service`, and a delta-sync-enabled
  `frontend` (`VITE_DELTA_SYNC=true`) from the source SHA, tagged
  `nexus-vtt/<name>:ci-<sha>`, then runs the smoke suite against those images
  with `E2E_PREBUILT=1` and `E2E_EXPECTED_DELTA_SYNC=true`.
- **Environment:** `ubuntu-latest`, 35-minute timeout, Docker Buildx with
  per-image GitHub Actions cache scopes (`smoke-backend`, `smoke-asset-service`,
  `smoke-frontend-delta`). Default working directory is `apps/vtt`.
- **Artifacts on failure:** `playwright-smoke-report` (14 days) containing
  `apps/vtt/playwright-report/` and `apps/vtt/test-results/e2e/`.
- **Known failure modes:** in the 60 runs reviewed on 2026-09-30 every failure
  was in an image **build** step (backend or frontend), not in a test, and the
  latest runs were green. Check which step failed before suspecting the specs.
- **Reproduce locally:** `cd apps/vtt && npm run test:e2e` (see
  [Testing Nexus VTT](/vtt/developer/testing)).

### VTT: E2E on published images (shadow)

- **Purpose:** verify the images Delivery actually published, not just images
  built in the PR lane, before promotion is trusted to carry them.
- **Trigger and gating:** push to `main` after `publish-images` succeeds and the
  release includes `backend`. Shadow mode: `continue-on-error: true`, and
  `promote-release` does not depend on it. Make it a need of `promote-release`
  once it has been green for several runs.
- **Workflow and job id:** `.github/workflows/delivery.yml`, `vtt-e2e-published`.
- **What it runs:** pulls `backend` and `asset-service` from GHCR
  (`sha-<commit>` when published for this commit, otherwise `latest`, reported
  through `E2E_CARRIED_IMAGES`), rebuilds only the delta-enabled frontend
  locally because the shipped frontend has delta-sync off, then runs the same
  smoke suite.
- **Environment:** `ubuntu-latest`, 30-minute timeout, `packages: read`.
  `delivery.yml` has no default working directory, so steps that run from
  `apps/vtt` must set `working-directory: apps/vtt` explicitly.
- **Artifacts on failure:** `delivery-playwright-smoke-report-<sha>` (14 days).
- **Known failure modes:** until 2026-09-30 this job failed on every run with
  `npm error Missing script: "test:e2e"` because Install Chromium and the test
  step ran at the repository root. Fixed by setting `working-directory`. Any
  failure after that point is a real signal from the suite.
- **Reproduce locally:** as above, with `E2E_BACKEND_IMAGE` and
  `E2E_ASSET_IMAGE` pointing at the published GHCR tags.

### VTT: managed E2E smoke (nightly)

Stub. Runs the same suite from `nightly.yml`. Document how it differs from the
PR job (images, schedule, retry policy).

## Stubs

Copy the template below under a new heading for each job in the index.

```md
### <job name>

- **Purpose:**
- **Trigger and gating:**
- **Workflow and job id:**
- **What it runs:**
- **Environment:**
- **Artifacts on failure:**
- **Known failure modes:**
- **Reproduce locally:**
```
