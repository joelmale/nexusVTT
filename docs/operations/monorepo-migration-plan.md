# Nexus product suite monorepo migration plan

Date: 2026-09-11  
Status: Proposed implementation plan; no migration or deployment performed  
Destination: Existing `joelmale/nexusVTT` repository, retaining `master`

## Outcome and scope

Bring NexusVTT, NexusForge, and NexusCodex into one repository with independently
buildable applications and images. Store the actual homelab deployment under
`deploy/homelab/compose.yaml` and eventually connect the existing Dockhand stack
to that definition.

The migration preserves service names, public URLs, data locations, application
behavior, and database ownership. It does not combine databases, replace module
federation, redesign authentication, or upgrade all dependencies together.
NexusCodex remains the independent document domain described in
[ADR-0001](../roadmap/ADR/0001-nexuscodex-boundary.md).

The first milestone is a working source monorepo with existing installation
boundaries. A unified npm workspace and shared packages follow only after that
milestone is verified. Keeping separate lockfiles temporarily is intentional.

## Verified starting point

Local checkouts were clean when inspected. Remote default-branch heads matched
these local commits; record full SHAs again at execution time.

| Application | Source and branch | Inspected commit | Build arrangement |
| --- | --- | --- | --- |
| VTT | `joelmale/nexusVTT`, `master` | `a0d25e3` | Node 26.5, npm 11; existing asset-service and generator-hub workspaces; Vitest and Playwright |
| Forge | `joelmale/nexus-forge`, `master` | `c6b13a9` | Node 20 in CI/Docker; standalone npm package; Vitest; federated CharacterSheet and dbService exports |
| Codex | `joelmale/NexusCodex`, `main` | `4c583c2` | Node 22 containers; five service packages and lockfiles; Jest; service-specific Docker builds |

VTT's frontend image also builds and serves generator-hub. Preserve that output
and route. Codex has an additional documentation package that needs its own
build/install mapping. Forge already contains code ported from spellbook-forge;
this plan does not import that fourth repository.

Earlier live inspection found `nexus-vtt2` on Dockhand environment `HomePod`
(`192.168.100.20`), using local Compose at
`/opt/dockhand/stacks/HomePod/nexus-vtt2/compose.yaml`. All 15 containers were
running, with core VTT health checks passing. Public HTTPS validation failed to
connect from the inspection environment and remains unverified.

The live stack differs materially from the repository's five-service Compose:
it includes Forge and eight Codex services, NAS bind mounts, and a shared
`homelab-net`. Its saved Git repository entry points to `main` / `compose.yaml`
and is not attached to this stack. Do not deploy the current repository Compose
as a substitute for the live definition.

## Target structure

```text
nexusvtt/
  .github/workflows/          # Active CI for the complete repository
  AGENTS.md                  # Shared rules; domain rules remain scoped
  package.json               # Initially orchestration; later npm workspace root
  package-lock.json          # Introduced when workspace consolidation passes
  apps/
    vtt/
      src/
      server/
      shared/                # Existing VTT/asset types retained initially
      services/asset-service/
      apps/generator-hub/
      docker/                # VTT Dockerfiles and component test Compose files
      scripts/
      tests/                 # Existing VTT suites remain here
      package.json
    forge/
      src/
      public/
      Dockerfile
      scripts/
      package.json
    codex/
      services/
        doc-api/
        doc-processor/
        doc-websocket/
        admin-ui/
        dm-ui/
      docs/                  # Includes current docs package
      scripts/
  packages/
    character-contracts/     # Extracted after source/build parity
    document-contracts/      # Extracted after source/build parity
    ui/                      # Optional; create only for proven shared UI
  deploy/
    homelab/
      compose.yaml           # Live-equivalent services, mounts and networks
      .env.example           # Variable names and safe defaults only
      releases/              # Tested image digests and source provenance
    dev/
      compose.yaml           # Isolated full-suite development environment
  tests/
    integration/             # New cross-application tests and fixtures
  docs/
    operations/
    architecture/
```

The nested asset-service and generator-hub folders minimize initial path churn.
They can be flattened later in an independent change. Future paths above are
proposals, not files created by this plan.

## Phase 0 — Baseline and recovery evidence

Deliverables:

- Record source SHAs, default branches, active branches/PRs, releases, licenses,
  Git LFS/submodules if present, and tracked large files. Scan imported history
  for credentials before publishing it into the destination repository.
- Capture the live Compose definition, resolved image digests, service commands,
  environment-variable names, secrets storage, mounts, networks, health checks,
  resource settings, restart policies, and public reverse-proxy routes.
- Store any resolved Compose output containing credentials in protected backup
  storage, never in Git or CI artifacts. Export a sanitized template for review.
- Back up VTT and Codex PostgreSQL with a database-consistent method. Include
  MinIO data, Codex search/recovery requirements, asset directories, and any
  persistent job state in the recovery inventory. Restore into isolated storage
  and verify representative records and document objects.
- Back up Dockhand configuration/database and its encryption key securely;
  document restoration of both ordinary variables and encrypted secrets.
- Record current browser origins, IndexedDB names/versions, OAuth callbacks,
  service-worker scope, and Forge's federation URL/exports. Origin changes can
  make existing browser data inaccessible even when server data is preserved.
- Run existing application checks from fresh installs and record failures
  separately from migration regressions. Verify public access from a working
  network and establish a browser baseline for documents and Forge imports.

Gate: Every production data location has an identified recovery procedure;
baseline failures are recorded with a disposition. Do not declare an already
broken document upload/view flow a new migration regression or silently mark it
passing. The existing runbook identifies a private MinIO URL limitation.

## Phase 1 — Import history and move source

Use a dedicated migration checkout and branch such as
`codex/monorepo-migration`. Retain the existing VTT repository and history.

1. Move VTT application files into `apps/vtt` in a dedicated mechanical commit.
   Keep repository-wide governance and active workflows at the root. Maintain
   a mapping for every root-relative path and moved document link.
2. Import Forge and Codex into their target prefixes using a history-preserving,
   non-squashed subtree import, rehearsed in a disposable clone. Preserve source
   commits as ancestors; do not force-push rewritten history to source repos.
3. Keep original release tags unambiguous. Namespace any imported tags, for
   example `forge/v1.5.3`; retain a source-SHA/import mapping. Old-path file
   history may require following the imported source ancestry explicitly.
4. Keep source license notices and scoped AGENTS instructions. Reconcile root
   rules with actual Compose deployment; inherited Swarm assumptions are stale.
5. Keep imported `.github` content as reference only until ported to root
   workflows. GitHub does not activate workflows nested under applications.
6. Preserve each installation root and lockfile. Use root wrapper commands with
   explicit working directories; do not declare one global workspace yet.
7. Plan issue/PR references and release links separately: Git history import
   does not transfer GitHub issues, PRs, secrets, settings, or package access.

Gate: Source commits are reachable, imported trees match the recorded source
trees except documented mechanical changes, and no unrelated working changes
are lost. Re-run the affected build before merging each source-move PR.

## Phase 2 — Restore build and CI parity

Initially keep builds isolated:

| Image group | Initial build context |
| --- | --- |
| VTT frontend/backend/asset-service/postgres | `apps/vtt` |
| Forge | `apps/forge` |
| Each Codex service | `apps/codex/services/<service>` |

Update root CI workflow paths, Dockerfile references, cache dependency paths,
artifact locations, and test orchestration. Preserve platform coverage: Forge
currently publishes amd64 and arm64; Codex publishes amd64. Keep application
runtime versions initially; record unsupported-runtime remediation separately.

Explicitly verify VTT patch-package handling, dice postinstall assets, Husky
installation relative to the Git root, generator-hub output, and asset-service
compiled entrypoint paths. Codex needs Prisma generation and processor native
libraries to work from a clean Docker build, not just a developer installation.

Keep the current GHCR image names during migration. Verify that the destination
repository's GitHub Actions token has write access to existing Forge and Codex
packages; repository consolidation does not automatically grant that access.
Update image source/revision labels. Publish candidate tags or digests without
moving production `latest` tags during rehearsal.

Port quality checks as explicit jobs. Codex's inspected workflow primarily
builds images; add execution of its existing Jest suites rather than assuming
build success validates behavior. Forge CI tests must run once, not in watch
mode. PR jobs must not publish images or gain production credentials.

Use one always-running required CI result job. It must fail if any relevant job
fails or is cancelled, and accept only intentionally skipped unrelated jobs.
Initially run broad checks; introduce selective jobs after parity is proven.

Gate: Clean installs, existing tests and all ten application image builds pass
(four VTT, one Forge, five Codex). A candidate image can be pulled from GHCR by
Dockhand. Images are traceable to the exact tested commit.

## Phase 3 — Rehearse the complete deployment

Create `deploy/homelab/compose.yaml` from the sanitized live definition, not the
generic repository file. Keep the following production identities:

- Stack name `nexus-vtt2`; services including `asset-server` and `nexus-forge`;
  named containers and reverse-proxy targets where currently used.
- NAS paths under `/mnt/docker-nas-vol1/nexusvtt/`: `postgres`, `redis`, `assets`,
  `user-assets`, `library-assets`, and `tmt-seed`.
- Existing Codex volumes: `nexus-vtt2-codex-postgres-data`,
  `nexus-vtt2-codex-redis-data`, `nexus-vtt2-codex-elasticsearch-data`, and
  `nexus-vtt2-codex-minio-data`.
- Backend/document/asset endpoint names, public hosts, and external network.

Rehearsal must override every production bind mount, explicit named volume,
container name, network, and hostname with isolated equivalents. A different
Compose project name alone does not isolate explicitly named volumes or bind
mounts. Use sanitized/restored test data and test credentials; prevent staging
from contacting production databases, queues, OAuth callbacks, or public routes.

Record a release manifest with each service's digest, source SHA, schema
requirements and validation result. Keep independent versions: a Forge-only
release should retain the exact previously tested VTT and Codex digests.

Codex's current doc-api Dockerfile runs `prisma db push` on startup. Before
production cutover, inspect the live schema and migration ledger against the
candidate schema on a restored database. If the candidate would mutate schema,
stop and create a separate reviewed migration. Move to an explicit migration
job only after reconciling/baselining existing migration history; do not simply
replace `db push` with `migrate deploy` against an unexamined live database.

Gate: The candidate stack passes the validation matrix below with existing data
and a fresh database. Production Compose has no unintended identity/storage
changes and no application-schema change is hidden in an entrypoint.

## Phase 4 — Switch production to Git management

Schedule a maintenance window outside an active game. One host and one replica
per service means a deployment may interrupt sessions; do not promise zero
downtime from the existing Swarm-style `update_config` fields.

1. Recheck live state and capture a fresh backup plus previous image digests.
2. Configure the Git source to the existing VTT repository, `master`, and
   `deploy/homelab/compose.yaml`. Keep build-on-deploy and automatic sync off.
3. Rehearse the installed Dockhand version's supported existing-stack Git
   linking/import procedure first. Do not delete/recreate the live registration
   just to obtain a Git link without proving preservation of settings and data.
4. Preserve `nexus-vtt2` and both environment stores. Follow the runbook's raw
   `.env` read/merge behavior; never overwrite unrelated keys. Verify all
   `${VARIABLE}` references resolve without printing secret values.
5. Ideally perform a source-management-only cutover first with current image
   digests. Then promote tested monorepo-built images as a separate deployment.
   Pull candidate images before stopping any service.
6. Confirm rendered mounts, service identities, restart settings, endpoints,
   and image digests against the approved manifest before the deploy action.
7. Deploy manually, execute production smoke checks, and inspect multiplayer
   health/metrics. Halt promotion and roll back on data, login, or sync failures.

Gate: Git owns the production Compose definition; actual images match its
release manifest; existing users, campaigns, characters and documents remain
accessible; a complete representative game session succeeds.

Do not archive source repos at this point. Keep them available for recovery
until an additional deployment and rollback rehearsal succeed. Coordinate a
short source freeze before final import; replay any intervening source commits
and prevent old workflows from independently overwriting shared image tags.

## Phase 5 — Consolidate workspaces and extract contracts

Proceed after stable production operation. Start with npm, already used by all
three applications. A monorepo does not require introducing Nx or Turborepo.

- Trial a root workspace with explicit paths for VTT, its asset-service and
  generator-hub, Forge, the five Codex services, and selected shared packages.
  Make `apps/codex` a grouping directory unless it needs an orchestration
  package. Include the Codex docs package explicitly or document its isolation.
- Replace nested workspace ownership with root ownership in one reviewed
  tooling change. Adopt one root lockfile only when clean installs and all
  builds pass; delete superseded lockfiles in that same change.
- Validate runtime compatibility before choosing one developer Node version.
  Do not force React Router 6/7, Zod 3/4, ESLint 9/10, TypeScript versions, or
  BullMQ major versions into a single version merely to deduplicate packages.
- Inspect all Codex Prisma schemas and generated client locations. A hoisted
  default client can be overwritten by another service's generation. Preserve
  isolation or use explicit generated outputs and imports before consolidation.
- Update Docker contexts to include root manifests/lockfile and actual shared
  dependencies, with narrow COPY rules and scoped build caches. Test installed
  workspace symlinks and production pruning inside final images.
- Extract `character-contracts` first using existing Forge export fixtures and
  VTT import tests. Preserve old export versions with explicit compatibility
  handling and runtime validation of untrusted input.
- Extract `document-contracts` second, based on API wire formats rather than
  Prisma models. Keep runtime validation and mixed-version compatibility across
  deployments; shared TypeScript types alone do not validate network traffic.
- Keep module federation names, exports and URL behavior until a separate
  architectural change. VTT currently configures a localhost Forge remote;
  establish which integrations are exercised in production before altering it.
- Create shared UI only when two real consumers need it. Keep document DB,
  VTT state, character rules and application stores within their owning domain.

Gate: A clean root install works, shared packages have explicit consumers, old
exports remain readable, builds contain no missing workspace dependencies, and
selective CI follows transitive package dependencies.

## Validation matrix

| Area | Required evidence |
| --- | --- |
| Repository/history | Original source SHAs reachable; tree comparison; tags/references mapped; no imported secrets or generated asset packs |
| VTT | Lint, full type checks, import-cycle and dice checks, unit/asset/integration suites; managed Playwright smoke including SIGKILL-after-ACK recovery |
| Multiplayer | Conflict-enabled managed soak; repository transaction tests if durability code changes; inspect `/api/metrics/multiplayer` and protected `/metrics`; no acknowledgement-before-commit regression |
| Forge | Type check, lint, Vitest once with existing coverage gates, production build, character save/reload/export/import; dice and spellbook behavior |
| Codex | Existing Jest unit/integration suites, five images, UI builds, Prisma generation, worker processing and WebSocket behavior against isolated dependencies |
| Cross-app | Forge export -> VTT import; document listing/search/content where supported; current federation consumers; Codex-offline VTT behavior |
| Persistent state | Representative existing campaigns, users, characters and documents load after deployment; browser IndexedDB survives on unchanged origins |
| Operations | `/health`, `/api/system/health`, login/guest flow, two-client room/dice/scene sync, asset library and generator-hub; digest and mount comparison |
| Recovery | Restore into isolated storage; redeploy previous known-good images and Compose without resetting databases or volumes |

Tests listed here are future execution gates. None were run as part of writing
this plan. Document pre-existing failures explicitly and fix any that prevent
safe validation before production cutover.

## Rollback and completion

For source/CI failures before deployment, production remains on existing images.
Fix or revert the isolated migration PR. Retain source repositories and their
history; do not force-reset shared branches.

For a failed production deployment, restore the previous Compose definition and
exact image digests using the same stack name, mounts and secrets. Do not use
`down -v`, delete volumes, or change NAS directories. Reverting source with
floating `latest` tags is not a reliable application rollback.

If schema or data changed unexpectedly, stop writers and follow the tested
database recovery procedure. Restoring a backup can lose writes made after the
backup; assess that with the owner before restoring over live data. This is why
the initial migration is intended to be schema-neutral.

Completion checklist:

- [ ] Three application histories and scoped documentation available in VTT.
- [ ] Reproducible builds and required CI checks for every shipped image.
- [ ] Exact production topology and release digests tracked under `deploy`.
- [ ] Dockhand Git management verified without storage or URL changes.
- [ ] Production smoke, representative game session and recovery gates pass.
- [ ] Old publishing workflows retired; source repositories marked moved and
      archived after the stabilization period, retaining issue/release links.
- [ ] Root onboarding and per-app development commands work from a fresh clone.
- [ ] Shared contracts introduced only after migration parity; workspace
      consolidation either verified or explicitly tracked as follow-up work.

## Suggested review units and effort

| Review unit | Scope | Planning allowance |
| --- | --- | --- |
| 1 | Baseline, live deployment capture, recovery rehearsal | 1–2 working days |
| 2 | Mechanical VTT move and history imports | 1–2 days |
| 3 | Build paths, CI, candidate images and registry permissions | 2–4 days |
| 4 | Full-suite rehearsal and production Git cutover | 1–3 days plus observation |
| 5 | Root workspaces and selective CI | 2–4 days |
| 6 | Character/document contracts | 2–4 days |

These are engineering estimates, not measured delivery promises. The initial
source/deployment milestone is roughly 5–11 working days; the complete tooling
and contracts effort is roughly 9–19 days, excluding stabilization and unrelated
baseline repairs. Preserve a narrow review scope and obtain normal peer review
before merging. No automatic production deployment on a source push: later
automation should promote a complete tested image manifest after publication.

## Follow-up reliability work

Track these observed issues separately so the source move remains reviewable:

- VTT backend, frontend, PostgreSQL and Redis had runtime restart policy `no`.
  Add and test an intentional Compose restart policy in its own operations PR.
- All live services share `homelab-net`; isolate internal dependencies in a
  separate network change. Keep unauthenticated doc-api private throughout.
- Replace misleading Swarm placement/update settings with verified single-host
  Compose behavior, preserving effective resource and restart settings.
- Reconcile Codex startup schema mutation and migration history before enabling
  unattended releases. Keep VTT durability migrations owned by VTT.
- Resolve document upload/content URLs if the baseline confirms the existing
  private MinIO endpoint limitation. Avoid changing user-facing URLs merely to
  accommodate the new repository layout.

## References

- [Current VTT deployment guide](../../DEPLOYMENT.md) describes CI publishing,
  health probes and required database migrations; its generic Compose topology
  needs reconciliation with the inspected live stack.
- [Homelab runbook](nexuscodex-homelab.md) records Codex volume identities, secret
  handling, and the document file-transfer limitation.
- npm supports explicit packages under one root through
  [workspaces](https://docs.npmjs.com/cli/using-npm/workspaces/).
- GitHub documents skipped required checks under
  [workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
  and repository/package access in its
  [container registry guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
- Prisma describes reconciling existing databases through
  [baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining).
  Apply guidance appropriate to Codex's installed Prisma 5 tooling; this plan
  does not prescribe an upgrade to the current Prisma major version.
