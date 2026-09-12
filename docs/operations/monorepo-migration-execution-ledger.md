# Nexus monorepo migration execution ledger

Last updated: 2026-09-12 (America/New_York)

## Objective and stopping boundary

Execute the approved Nexus monorepo migration plan through every reversible
pre-production gate: preserve source history, establish `apps/vtt`,
`apps/forge`, and `apps/codex`, restore build and CI parity, rehearse an
isolated deployment and recovery, complete independent review, and prepare the
production cutover package. Stop before any production cutover, live schema
change, merge to `master`, production-impacting image publication, source-repo
retirement, or destructive cleanup unless the user gives explicit approval.

## Current phase and gate

- Phase: 2 — build/CI parity; review remediation underlying gates pass, the
  aggregate gate needs one workflow-directory correction, and the registry
  pull remains blocked on credentials/package access.
- Gate state: Phase 0 passed. Phase 1 passed: all three source histories are
  ancestors of the migration branch, both imported subtree trees matched their
  source tips, Git fsck passed, and the intended `apps/vtt`, `apps/forge`, and
  `apps/codex` layout is established. Root/VTT/Forge/WebSocket path repair and
  their targeted validation are committed at `ef70312`. Wave-4 Codex and
  documentation work is integrated and lead-reviewed; all ten application
  image contexts, aggregate Codex build, deterministic tests, isolated doc-api
  integration tests, Compose renders, and active workflow lint now pass.
  Phase 2 functional parity is committed at `ea1e50b`: wave-4 Codex and documentation
  work is integrated and lead-reviewed; all ten application image contexts,
  aggregate Codex build, deterministic tests, isolated doc-api integration
  tests, Compose renders, and active workflow lint pass. A lead self-audit
  found that image source/revision labels and the Forge CI image-build job were
  still missing. Those repairs are committed at `ac59d8a`; all ten local
  candidate images have since rebuilt and their loaded-image metadata verifies
  the exact full commit SHA. The plan's remaining Phase 2 requirement is a
  controlled GHCR candidate publication and independent pull by Dockhand; no
  production tag or deployment may be changed by that check. Workflow run
  `34664250908` published all four VTT candidates without moving `latest`, but
  Forge and the five Codex package writes were denied because those existing
  packages do not grant the destination repository Actions access. Dockhand's
  saved GHCR credential independently fails authentication and its candidate
  pull was denied. The same run reproduced the pre-existing VTT static import
  cycle; wave 5 then removed it with one application-local dynamic boundary,
  and lead reruns of the cycle, type, lint, and targeted test checks pass.
  Draft PR 230's complete VTT, Forge, and Codex checks passed at `ead14d5`.
  Wave 7 now resolves the six interim-review findings in the repository:
  same-SHA candidate dependencies, Forge ARM64 publication, an always-present
  aggregate PR check, Codex docs install/build coverage, observable
  character-sync failure handling, and production-guidance safeguards. These
  changes are locally validated and committed at exact SHA
  `371cfec52c4ce5c49c0ec020161d9ca8e8338e65`. The branch was pushed with
  ledger commit `4921497c5ee21f92cb38a6c04766809d206c5005`; unified PR run
  `34675467094` passed every VTT, Forge, Codex, docs, integration, and managed
  E2E job. Its aggregate job alone failed before running the script because the
  workflow-wide `apps/vtt` default directory does not exist without checkout.
  The corrective step-level repository working directory is now pending local
  validation and commit.
- Exact next action: validate, commit, and push the aggregate-directory fix;
  require the aggregate PR check to pass, then obtain explicit approval for the
  package-access and Dockhand credential changes needed to publish and pull a
  complete new exact-SHA candidate set. Do not begin Phase 3 until this Phase 2
  blocker is cleared.

## Destination

- Repository: `C:/Users/nelso/Documents/Coding/nexusVTT`
- Baseline branch: `master`
- Baseline SHA: `c8b3fc93c65c2a4cd5f37612b4e625f65f47d936`
- Remote `origin/master` verified at the same SHA on 2026-09-11.
- Migration branch: `codex/monorepo-migration`
- Draft PR: `https://github.com/joelmale/nexusVTT/pull/230`
- Isolated checkout:
  `C:/Users/nelso/Documents/Coding/nexusVTT-monorepo-migration`
- Migration plan is tracked at
  `docs/operations/monorepo-migration-plan.md` in the isolated checkout.

## Source repositories and verified SHAs

| Application | Local checkout | Branch | Verified local SHA | State |
| --- | --- | --- | --- | --- |
| VTT | `C:/Users/nelso/Documents/Coding/nexusVTT` | `master` | `c8b3fc93c65c2a4cd5f37612b4e625f65f47d936` | Dirty generator-hub work; user explicitly authorized integration into the migration on 2026-09-11 |
| Forge | `C:/Users/nelso/Documents/Coding/nexus-forge` | `master` | `c6b13a9169dadea32bd80c8bc9f3d463b5f0d822` | Clean; `origin/master` reverified at same SHA |
| Codex | `C:/Users/nelso/Documents/Coding/NexusCodex` | `main` | `4c583c2e82cc71b6fff732f876c1763e82cd4ccb` | Clean; `origin/main` reverified at same SHA |

The plan's VTT SHA `a0d25e3` is stale. The execution baseline uses current
local and remote `master`, `c8b3fc9`. Forge and Codex match the inspected plan
SHAs, and both remote heads were reverified at the same SHAs.

## Working-tree state and preservation obligations

The original VTT checkout contains a modified generator-hub `App.tsx`, deletions
under `public/{cave,city,dwellings}-generator/`, corresponding untracked files
under `apps/generator-hub/public/{cave,city,dwellings}-generator/`, and three
new bridge scripts. The user paused other work and explicitly directed that all
dirty changes be integrated into the migration. The lead will copy this exact
state into the isolated branch as a dedicated recovery commit before the VTT
top-level move. The original checkout must still not be reset or edited. Forge
and Codex were clean at baseline.

## Recovery evidence

- The destination `master` and `origin/master` both resolve to full SHA
  `c8b3fc93c65c2a4cd5f37612b4e625f65f47d936`.
- An isolated worktree was created from that exact commit; the original dirty
  checkout remains untouched.
- Destination has no submodules and `git lfs ls-files` returned no entries.
- Destination tags observed before migration: `latest`, `v1.5`.
- Source repositories remain intact and will not be force-pushed or removed.
- Production application state has not been modified. A protected recovery set
  was created on the NAS at
  `/mnt/docker-nas-vol1/nexusvtt/backups/monorepo-migration-20260911T101357Z`
  with directory mode 0700 and file mode 0600. It contains custom-format VTT
  and Codex database dumps, VTT asset and Redis archives, all four Codex named
  volume archives, an online-consistent Dockhand SQLite backup and encryption
  key, the live Compose/environment files, and `SHA256SUMS`. All remote hashes
  passed verification.
- Archive validation found 131,388 VTT asset entries, 1,662 Codex persistent
  volume entries, six VTT Redis archive entries, 77 VTT dump TOC entries, and
  113 Codex dump TOC entries. Dockhand SQLite integrity was `ok`.
- The recovery set was copied to the protected local directory
  `C:/Users/nelso/.codex/recovery/nexus-monorepo-20260911T101357Z/source`.
  The interrupted 2.8 GiB asset transfer was resumed with SFTP; its local
  SHA-256 matches the recovery manifest.
- Isolated database restore rehearsal succeeded for Codex on PostgreSQL 16
  (12 public tables) and VTT on PostgreSQL 17 (nine public tables). VTT required
  PostgreSQL 17 because its custom dump has archive version 1.16, which the
  initially attempted PostgreSQL 16 `pg_restore` cannot read. The failed empty
  PostgreSQL 16 VTT restore container was retained as evidence. VTT restored
  representative counts include 169 room events, ten sessions, five campaigns,
  and nine users.
- The Codex MinIO, Redis, Elasticsearch, and physical PostgreSQL archives and
  the VTT Redis archive were extracted into uniquely named local Docker volumes;
  entry counts were 80, six, 189, 1,386, and five respectively. The physical
  PostgreSQL volume is retained only as archive-extraction evidence; the
  database-consistent logical dump is the approved database restore path.
- Dockhand restore rehearsal copied the database and key into a separate
  protected directory. Source/restored hashes match, SQLite integrity is `ok`,
  and 36 tables were detected. It was not started against the live Dockhand
  installation.
- The VTT asset archive was extracted into isolated volume
  `nexus-migration-restore-vtt-assets-20260911`. It contains all four expected
  roots (`assets`, `user-assets`, `library-assets`, and `tmt-seed`), 131,388
  entries, and 96,848 regular files.
- Gitleaks 8.30.1 scanned all source history with output redaction enabled. VTT
  passed with 557 commits and no findings. Forge scanned 259 commits and raised
  two false positives: ordinary D&D class-description strings assigned to a
  `keyRole` property. The initial Codex scan covered only its shallow tip and
  found four placeholder examples. After unshallowing, the complete scan
  covered 42 commit diffs and raised those same four plus one historical
  Elasticsearch basic-auth placeholder. Context was inspected with credential
  values redacted; every Codex finding contains explicit placeholder markers.
  No credential-like finding requires history rewrite.
- Read-only Dockhand inspection on environment `HomePod` (ID 1,
  `192.168.100.20`) found the live `nexus-vtt2` stack at
  `/opt/dockhand/stacks/HomePod/nexus-vtt2/compose.yaml` with 15 running
  containers. VTT frontend, backend, PostgreSQL, Redis, and Forge currently
  have Docker restart policy `no`; asset-server uses `unless-stopped`; Codex
  services use `on-failure`.
- The exact live VTT NAS binds remain
  `/mnt/docker-nas-vol1/nexusvtt/{postgres,redis,assets,user-assets,library-assets,tmt-seed}`.
  Codex uses named volumes `nexus-vtt2-codex-postgres-data`,
  `nexus-vtt2-codex-redis-data`, `nexus-vtt2-codex-elasticsearch-data`, and
  `nexus-vtt2-codex-minio-data`. Every service is attached to external
  `homelab-net`.
- Live `doc-api` command still performs `prisma generate`, then
  `prisma db push --skip-generate`, then starts via `tsx`. No production schema
  action is permitted during this migration without separate reconciliation
  and approval.
- Dockhand's saved `nexusVTT` repository entry still targets branch `main` and
  `compose.yaml`, is unattached to an environment, and is not linked as a Git
  stack. The live local Compose stack is therefore unaffected by repository
  pushes at baseline.

## Decisions, assumptions, and deviations

1. Use current destination SHA `c8b3fc9`, rather than stale plan SHA
   `a0d25e3`, because local `master` and `origin/master` agree at the newer
   commit.
2. Material deviation from the initial ledger entry: include all original
   checkout generator-hub work in the migration. Reason: the user explicitly
   authorized integration after confirming all other work is paused. Content
   verification found 56 of 59 relocated tracked files byte-identical; the
   three `index.html` files intentionally differ, and three new bridge scripts
   plus the `App.tsx` edit complete the integration change.
3. Keep separate application installation roots and lockfiles through initial
   source/build parity, as required by the plan.
4. No active-parent model identifier is exposed by the available task APIs.
   The requested prompt does not itself change the parent model; model routing
   is explicitly set only for subagents, where acceptance is tool-verifiable.
5. The first intended disposable rehearsal command ran from the migration
   worktree because the shell working directory was not changed after cloning.
   It therefore performed the Forge no-squash subtree import on the isolated
   migration branch before the rehearsal completed. No production branch,
   source worktree, or application data changed. The imported Forge tree and
   ancestry verified exactly, so the valid import is retained and its commit
   label is corrected from “rehearse” to “import.” The command was corrected
   with an explicit `Set-Location`; the disposable rehearsal then passed for
   both applications.
6. `NexusCodex` was discovered to be shallow at its current tip, with parent
   `268036b5` unavailable locally. The plan's assumption that the local source
   held complete history was therefore false. `git fetch --unshallow origin`
   recovered the complete 46-commit reachable history without changing the
   source tip or worktree. The full redacted secret scan was rerun before
   import.
7. The initial accidental `--tags` Forge fetch exposed VTT/Forge collisions at
   `latest` and `v1.5`; those destination tags were correctly rejected. Four
   non-colliding Forge tags were fetched into the shared destination object
   database. Before publication, all six Forge tags will be preserved under a
   `forge/` namespace and the four accidental unnamespaced aliases will be
   removed only after equivalent namespaced refs exist and exact targets are
   recorded. Real application history fetches now use `--no-tags`.
8. All six Forge tags are now preserved as exact lightweight refs under
   `forge/`. The four accidentally added non-colliding unnamespaced aliases were
   removed with old-object safety checks after their namespaced targets matched.
   Destination-owned `latest` and `v1.5` remain unchanged. Codex has no tags.
9. Phase 1's mechanical/import order differs from the plan: Forge was imported
   first by the working-directory error, Codex was imported after the corrected
   rehearsal, and the VTT mechanical move followed. The final trees are
   disjoint, all operations remained serial, and source-tip ancestry/tree checks
   passed after the move, so reverting and replaying would add history risk
   without changing the result. The evidence-based disposition is to retain
   the verified order and document it here.
10. VTT's moved Husky `prepare` command cannot assume the repository root is
    present during application-context Docker builds. A small context-aware
    helper now installs the root hook in a Git checkout and explicitly skips
    Husky when the build context contains no `.git`. Both VTT install behavior
    and image behavior were verified; dependencies and runtime behavior are
    unchanged.
11. Wave 4 mechanically repaired current VTT file and command paths in 29
    owned documentation files. Historical, rollback, NAS, URL, migration-plan,
    and ledger references were excluded from blind rewriting. Two unrelated
    pre-existing README links (`docs/api-docs.md` and `docs/adr.md`) remain
    broken and are classified separately rather than masked by this migration.
12. Lead review rejected the Codex processor handoff's initial Jest-only
    Markdown parser shim because it weakened coverage of production behavior.
    The service now loads the actual ESM-only `unified`, `remark-parse`, and
    PDF.js packages from its CommonJS output; Jest runs with VM-module support,
    and all 43 tests exercise the real Markdown parser. `isValidMarkdown`
    became asynchronous; there are no internal callers, and this keeps its
    parser-based contract instead of replacing it with a permissive stub.
13. Isolated doc-api integration testing exposed pre-existing API/test drift
    and a real empty-index search defect: the list route returns paginated
    `{documents, pagination}` data, while tests expected an array, and searches
    sorted on `uploadedAt` although index creation/reindexing omitted that
    field. Tests now assert the current response contract; index management now
    maps/reindexes `uploadedAt`, and search tolerates an unmapped date field.
14. The first Phase 2 closeout was premature on image traceability: all ten
    contexts built, but most final images did not embed OCI source/revision
    labels, the VTT asset/PostgreSQL workflow omitted build metadata, and Forge
    CI did not build its image. Functional evidence remains valid, but the gate
    is reopened until uniform labels are built and inspected from an exact
    commit. This is a documentation/state correction, not an assertion that an
    unverified gate passed.
15. The authenticated GitHub CLI token can push Git but lacks GHCR's
    `write:packages` scope. Two direct candidate pushes failed with
    `permission_denied` before either manifest was created. Rather than widen a
    developer credential, the existing root CI workflow now has an explicit
    manual `candidate_sha` path that checks out a full exact SHA and uses the
    job-scoped package token to publish only `candidate-<short-sha>` tags. Its
    condition suppresses the normal publisher, including every `latest` tag,
    whenever `candidate_sha` is present. This is a material implementation
    adjustment required to complete the plan's controlled GHCR pull gate.
16. Candidate workflow run `34664250908` proved that the new guarded path does
    not move `latest`, but existing package permissions are repository-scoped:
    all four VTT candidates published, while Forge and all five Codex packages
    rejected the destination repository's job token. Dockhand's configured
    GHCR registry entry (ID 2) also fails an authenticated search, and a direct
    pull of the published backend candidate was denied. Altering GitHub package
    Actions access or replacing the saved live registry credential requires
    explicit approval and a least-privilege package token; neither setting was
    changed during diagnosis.
17. The three application workflows are now coordinated through one root PR
    workflow: Forge and Codex are reusable/manual workflows, while the root
    workflow invokes them and emits `Monorepo required` after every applicable
    gate. The root PR trigger has no path filter so the required result is
    present even for documentation-only changes. Root `master` push filtering
    remains, and VTT image publication is additionally release-scope-gated;
    version-tag pushes retain their prior unconditional publication behavior.
    Reason: independent review found that separate path-filtered checks could
    disappear and falsely satisfy branch protection.
18. Candidate publication now depends on successful VTT, Forge, and Codex
    validation of the same exact input SHA, and Forge restores its source
    `linux/amd64,linux/arm64` manifest parity through QEMU. Existing
    `candidate-ac59d8a` tags are retained as evidence but are superseded for
    promotion purposes because they predate the cycle and review repairs.
19. Codex docs remains an independent installation root. Its new lockfile pins
    Webpack `5.105.4`, the last release before Webpack's new compiler validation
    exposed the `webpackbar` 6/Docusaurus 3.9.2 incompatibility. Webpack 5.109.0
    reproduced the failure; 5.105.4 passed compilation. A real `/docs/index`
    broken link was corrected to `/docs/`. This compatibility pin avoids a
    Docusaurus dependency-family upgrade during mechanical migration and is
    recorded in root scripts, Codex CI, and Dependabot.
20. Until Phase 3 creates and validates `deploy/homelab/compose.yaml`, root
    production documentation and Make targets explicitly block use of the
    VTT component Compose file with Dockhand or Swarm. Unsafe deploy, push,
    Swarm removal/status, production log, and production shell targets were
    removed while local development commands remain.

## Ownership and delegation wave 1

Lead only:

- Git history integration, top-level moves, migration commits, root manifests
  and lockfiles, shared workflows, deployment/live-state decisions, and ledger.

Inventory/mechanical worker (GPT-5.6 Luna, medium):

- Read-only ownership of `C:/Users/nelso/Documents/Coding/nexus-forge`.
- Inventory current tree, history/tag/LFS/submodule/license/large-file state,
  workflows, Docker/build/test entry points, and deterministic migration risks.
- Must not edit any repository, run installs/builds, access production, or make
  architecture/data-safety decisions.
- Completed read-only; no files changed. Agent closed after handoff.

Application/build engineer (GPT-5.6 Terra, medium):

- Read-only ownership of `C:/Users/nelso/Documents/Coding/NexusCodex`.
- Inventory five shipped services, lockfiles, Docker contexts, tests, Prisma
  generation/startup/schema behavior, and local Compose dependencies.
- Must not edit files, install dependencies, start shared infrastructure,
  access production, or make deployment/data-safety changes.
- Completed read-only; no files changed. Agent closed after handoff.

### Integrated wave 1 evidence

- Forge is one standalone npm install root (530 tracked files), with six tags:
  `latest`, `v1.5`, `v1.5.01`, `v1.5.1`, `v1.5.2`, and `v1.5.3`; no LFS or
  submodules. It declares MIT in `package.json` but has no tracked license file.
- Forge federation must remain `nexus_forge` / `remoteEntry.js`, exposing
  `./CharacterSheet` and `./dbService`. Docker is a root-context Node 20 build,
  runtime port 8080, and CI publishes amd64/arm64. Imported workflows must stay
  nested/reference-only until intentionally ported because current workflows
  can publish after quality/release triggers.
- Codex has five shipped isolated service install roots and lockfiles under
  `services/`, plus a Docusaurus `docs` package with no lockfile. All service
  Dockerfiles assume service-local build contexts and CI publishes amd64 only.
- Codex CI builds images but does not execute existing Jest suites. API,
  processor, and WebSocket use Prisma 5.7.1 default client output with divergent
  schemas. API startup runs `prisma db push`; processor retains required native
  image libraries. These constraints must remain isolated during the source
  move and be explicitly tested before any workspace consolidation.
- Codex documentation references root test orchestration files that are not
  tracked (`run-tests.sh`, `test-stack.sh`, `docker-compose.test.yml`), a
  verified pre-existing documentation drift.

## Ownership and delegation wave 2

Application/build engineer (GPT-5.6 Terra, medium):

- Bounded ownership of baseline verification in the clean source checkout
  `C:/Users/nelso/Documents/Coding/nexus-forge`.
- May run `npm ci`, TypeScript, lint, Vitest once with coverage, and production
  build. Generated ignored `node_modules`, coverage, and `dist` output are
  allowed; tracked files, Git refs, Docker, deployment, and every other
  repository remain untouched.
- Acceptance: return exact command outcomes, distinguish existing failures,
  and confirm final tracked working-tree state.
- Completed; no tracked files changed. Agent closed after handoff.

Inventory/mechanical worker (GPT-5.6 Luna, medium):

- Read-only ownership of the isolated VTT checkout at
  `C:/Users/nelso/Documents/Coding/nexusVTT-monorepo-migration`.
- Produce an exhaustive deterministic root path classification for the
  mechanical move into `apps/vtt`, identifying governance/docs/workflows that
  stay at root, existing nested workspace paths, path/link/script/config
  references requiring follow-up, and collision risks.
- Must not edit, install, build, test, change Git refs, inspect production, or
  decide architecture/data safety.
- Completed; no files changed. Agent closed after handoff.

Application/build engineer follow-on (GPT-5.6 Terra, medium):

- Bounded baseline verification in
  `C:/Users/nelso/Documents/Coding/NexusCodex/services` after the Forge worker
  completed and released its slot.
- May run service-local `npm ci`, explicit Prisma generation, existing
  non-integration Jest suites, TypeScript/build scripts, and UI production
  builds. Ignored `node_modules`, generated clients, coverage, and `dist`
  output are allowed; tracked files, Docker/shared infrastructure, Git refs,
  docs package, production, and every other checkout remain untouched.
- Acceptance: evidence for all five shipped packages, Prisma generation in all
  owning services, exact baseline failures, and final tracked-tree status.
- Completed; no tracked files changed. Agent closed after handoff.

### Integrated VTT mechanical inventory

- Current tree has 1,045 tracked files and 50 root entries. Existing nested
  apps are `apps/generator-hub` (151 tracked files) and
  `services/asset-service` (nine tracked files); target `apps/vtt` paths are
  absent, so no destination collision exists.
- Keep root governance and shared operations: `.claude`, editor/Git/Prettier
  configuration, `.github`, `.husky`, `AGENTS.md`, `CLAUDE.md`, root project
  documentation/licenses, `dev-docs`, `docs`, `monitoring`, and `Makefile`.
- Move VTT source/config/runtime content under `apps/vtt`, including nested
  generator-hub/asset-service, VTT Docker files, source, server, shared, public,
  static assets, scripts, tools, patches, tests, entry/config files, and VTT
  package manifests.
- Lead decision for inventory's four ambiguous entries: move `.dockerignore`,
  `.env.example`, `package.json`, and `package-lock.json` into `apps/vtt`.
  Reason: they define the preserved VTT install/build boundary. Create a new
  dependency-free root orchestration `package.json` separately; do not create a
  root lockfile until workspace consolidation passes.
- Follow-up hazards recorded for the path-repair commit: four active root
  workflows, four image publish paths, Docker contexts, observability's root
  `monitoring` reference, root scripts/config/docs, the generator-hub shared
  type import, and asset-service output paths.

## Ownership and delegation wave 3

Application/build engineer (GPT-5.6 Terra, medium):

- Objective: restore VTT application-local install, lint, type-check, unit-test,
  build, nested generator-hub, asset-service, and Docker-context parity after
  the move. Acceptance requires deterministic path fixes within `apps/vtt`, no
  dependency upgrades, and exact command/test evidence.
- Exclusive write ownership: `apps/vtt/**` in
  `C:/Users/nelso/Documents/Coding/nexusVTT-monorepo-migration`.
- Required references: the migration plan, root `AGENTS.md`, preserved VTT
  package boundaries, and initial Docker context `apps/vtt`.
- May install only in `apps/vtt` and run non-Docker application-local checks.
  Must not run shared Docker resources, e2e/soak, Git operations, or edit root
  files, workflows, docs, ledger, `apps/forge`, `apps/codex`, `deploy`, or
  `packages`. Must request ownership before any out-of-scope edit.
- Dispatch was accepted as agent `01a09057-2df1-7a72-b4ca-02068909a60a`, but
  the agent immediately returned the application usage-limit error before
  changing or verifying files. The agent was closed and ownership returned to
  the lead.

Inventory/mechanical/documentation worker (GPT-5.6 Luna, medium):

- Objective: mechanically update moved VTT path references in existing root
  user/developer/operations documentation. Acceptance requires links/commands
  to point at the new layout while retaining historical and migration-baseline
  references where context requires them, plus an explicit verification scan.
- Exclusive write ownership: root `README.md`, `DEPLOYMENT.md`,
  `CSS_TROUBLESHOOTING.md`, and `dev-docs/**` plus `docs/**`, excluding
  `docs/operations/monorepo-migration-plan.md` and
  `docs/operations/monorepo-migration-execution-ledger.md`.
- Must not make architecture, history, production, data-safety, or cleanup
  decisions; edit apps, workflows, Git refs, manifests, lockfiles, deployment
  definitions, the plan, or ledger; run installs/builds/Docker; or touch any
  other checkout. Must request ownership before any out-of-scope edit.
- Dispatch was accepted as agent `01a09057-2f62-7dd3-bd80-638023576498`, but
  the agent immediately returned the same application usage-limit error before
  changing or verifying files. The agent was closed and ownership returned to
  the lead.

## Ownership and delegation wave 4

Application/build engineer (GPT-5.6 Terra, medium):

- Objective: repair the pre-existing Codex doc-api TypeScript failures and
  doc-processor deterministic unit-test failures without schema redesign or
  dependency upgrades. Acceptance requires both Prisma generations and builds,
  doc-api's existing Jest suite, and every environment-independent processor
  suite to pass, with environment-required tests explicitly classified.
- Exclusive write ownership: `apps/codex/services/doc-api/**` and
  `apps/codex/services/doc-processor/**`.
- Must leave WebSocket/UI services, root/workflows/docs/ledger, Docker/shared
  infrastructure, Git refs/history, other apps, and production untouched. No
  Docker, integration services, schema push/migration, or subagents.

Inventory/mechanical/documentation worker (GPT-5.6 Luna, medium):

- Objective and ownership repeat the failed wave-3 documentation assignment:
  mechanically repair moved VTT paths in root `README.md`, `DEPLOYMENT.md`,
  `CSS_TROUBLESHOOTING.md`, `dev-docs/**`, and `docs/**`, excluding the migration
  plan and this ledger. Acceptance requires stale-reference and link checks.
- Must leave applications, workflows, manifests, lockfiles, deployment files,
  Git state, other checkouts, and live systems untouched. No architecture,
  history, production/data-safety decisions, Docker, installs, or subagents.

## Ownership and delegation wave 5

Application/build engineer (GPT-5.6 Terra, medium):

- Objective: remove the single static VTT import cycle reported by both local
  and GitHub CI checks—`characterSyncService -> initiativeStore ->
  characterStore -> gameStore`—without changing observable game-state,
  initiative, character-sync, or durable persistence behavior. Acceptance
  requires `npm run check:cycles`, `npm run type-check`, and directly relevant
  unit tests to pass.
- Exclusive write ownership:
  `apps/vtt/src/services/characterSyncService.ts`,
  `apps/vtt/src/stores/initiativeStore.ts`,
  `apps/vtt/src/stores/characterStore.ts`,
  `apps/vtt/src/stores/gameStore.ts`,
  `apps/vtt/src/stores/gameEventHandlers.ts`, and directly relevant targeted
  tests under `apps/vtt/tests/unit/**`. Any other edit requires an ownership
  request before it is made.
- Must leave repository-root files and workflows, manifests and lockfiles,
  Docker/deployment/monitoring files, all other applications, Git refs and
  history, generated outputs, shared infrastructure, and live systems
  untouched. No dependency install, Docker, production access, commits, or
  subagents.
- Required handoff: concise changed-file list, result, commands/outcomes,
  validation evidence, unresolved issues, and recommended next action.
- Dispatch accepted as agent `01a09333-fe0f-7020-b17d-8d0c8ab8d856` with the
  requested GPT-5.6 Terra/medium override. The worker changed only
  `apps/vtt/src/stores/initiativeStore.ts`, completed the required handoff, and
  was closed after lead review returned ownership.

## Ownership and delegation wave 6

Independent reviewer (GPT-5.6 Terra, high), initial read-only review:

- Objective: independently audit completed Phase 0–2 work against the migration
  plan and identify correctness, compatibility, history-integrity, test,
  Docker/Compose, CI-trigger, persistence/data-loss, deployment, rollback, or
  undocumented-deviation hazards. Acceptance requires prioritized findings
  with exact file/line or command evidence, plus explicit confirmation of areas
  reviewed where no issue was found.
- Read-only scope: the complete isolated checkout
  `C:/Users/nelso/Documents/Coding/nexusVTT-monorepo-migration`, its Git history,
  the migration plan, and this ledger. The reviewer may run read-only Git and
  text inspection commands only.
- Must leave every file, Git ref, worktree, generated output, package install,
  Docker resource, workflow/run, registry/package setting, Dockhand/live system,
  and source checkout untouched. No builds, tests, installs, network mutation,
  deployment, production access, or subagents.
- This is an interim Phase 0–2 review; independent review must run again after
  the Phase 3 rehearsal and production-cutover package are complete.
- Dispatch accepted as agent `01a09339-8354-7273-9ff7-2d40da610c69` with the
  requested GPT-5.6 Terra/high override. The reviewer returned six actionable
  findings without modifying any file or external state and was closed after
  its evidence was integrated below.

## Ownership and delegation wave 7

Application/build engineer (GPT-5.6 Terra, medium):

- Objective: make the lazy initiative-to-character sync boundary observable
  and covered without restoring the static cycle. Acceptance requires explicit
  import-failure handling and focused tests proving damage, healing, set-HP,
  and temporary-HP operations invoke the sync service after lazy loading, plus
  cycle, type, lint, and targeted tests passing.
- Exclusive write ownership:
  `apps/vtt/src/stores/initiativeStore.ts` and directly relevant initiative
  store tests under `apps/vtt/tests/unit/**`. Any other edit requires an
  ownership request.
- Must leave all other source, root/workflow/manifest/lockfile,
  Docker/deployment/monitoring, Git/external/live state, and generated outputs
  untouched. No installs, Docker, commits, production access, or subagents.

Inventory/mechanical/documentation worker (GPT-5.6 Luna, medium):

- Objective: remove unsafe operator guidance that presents the component-local
  VTT Compose file as the production/Dockhand/Swarm definition. Acceptance
  requires prominent local-only labeling, removal/blocking of dangerous
  production commands, and deterministic stale-reference checks.
- Exclusive write ownership: root `README.md`, root `DEPLOYMENT.md`, and root
  `Makefile` only.
- Must leave applications, workflows, manifests/lockfiles, migration plan and
  ledger, Docker/deploy/monitoring definitions, Git/external/live state, and all
  other files untouched. No architecture/history/data-safety decisions,
  installs, builds, Docker, commits, or subagents.

The application assignment was accepted as agent
`01a09401-736f-7402-b8db-79aa9b84ae0b` with the requested GPT-5.6
Terra/medium override. It changed only the initiative store and two focused
test files. The lead reviewed the diff, reran ESLint, 25 focused tests, the
284-module cycle check, and the complete VTT type check successfully. The
agent was closed and ownership returned to the lead.

The documentation assignment was accepted as agent
`01a09401-74d6-7ae0-afab-013c379846ff` with the requested GPT-5.6 Luna/medium
override. It changed only `README.md`, `DEPLOYMENT.md`, and `Makefile`; the
lead reviewed the diff and deterministic reference scan. `make help` could not
run because GNU Make is unavailable on this Windows host. The agent was closed
and ownership returned to the lead.

## Completed work

- Read all three root `AGENTS.md` files and the complete migration plan.
- Confirmed filesystem access to all three repositories.
- Captured baseline branches, SHAs, remotes, and working-tree states.
- Verified destination remote head, tags, submodule state, and LFS state.
- Created isolated migration worktree and branch.
- Created this authoritative execution ledger.
- Received explicit authorization to integrate the original VTT dirty state;
  verified its complete moved/modified/new-file mapping before copying it.
- Completed delegation wave 1 and integrated its Forge/Codex inventories above.
- Copied the exact dirty generator-hub state into the isolated checkout, then
  removed trailing whitespace from newly edited `App.tsx` conditions so
  `git diff --check` passes. The original checkout remains untouched.
- Completed the disposable no-squash import rehearsal at
  `C:/Users/nelso/.codex/recovery/nexus-monorepo-20260911T101357Z/history-import-rehearsal`.
  Both source tips are ancestors of rehearsal HEAD; both imported subtree trees
  exactly equal their source-tip trees; the resulting rehearsal contains 936
  commits and is not shallow.
- Imported Forge history without squashing at `apps/forge` on the migration
  branch. Source tip `c6b13a9` is an ancestor and the imported tree matches the
  source tree exactly. Merge commit `6e5f270` has the corrected
  `chore(migration): import Forge history` label.
- Imported complete Codex history without squashing at `apps/codex`. Source tip
  `4c583c2` is the second parent and an ancestor of merge commit `1dd2e64`; the
  imported and source tree IDs both equal `21b1523`. The combined repository
  has 937 reachable commits and is not shallow.
- Mechanical move commit `81d0411` relocated all 927 tracked VTT application
  files into `apps/vtt` with 927 exact 100% renames and no content changes.
  Root governance, workflows, documentation, monitoring, and licenses remain
  at repository root. Post-move ancestry checks for all three source tips,
  `git fsck`, and 28-commit `--follow` history for `apps/vtt/src/main.tsx`
  passed.
- Added a dependency-free root orchestration manifest without introducing root
  workspaces or a shared lockfile. Updated root hooks, Make targets, ignore
  paths, active VTT workflow working directories/cache paths/artifact paths,
  Dependabot install roots, and Docker build contexts. Added non-publishing
  path-filtered Forge and Codex CI workflows.
- Repaired the moved VTT's Husky setup and root-monitoring Compose mounts.
  Fixed Forge's pre-existing filter-state type error by passing the already
  derived complete filter state. Replaced the Codex WebSocket checkout's
  broken symlink materialization with its canonical regular Prisma schema and
  aligned its start script with emitted `dist/index.js`.
- Committed this first build/CI parity unit as `ef70312`
  (`chore(monorepo): restore initial build and CI paths`). The repaired root
  pre-commit hook ran successfully: layout validation, Tailwind collision
  validation, and lint-staged all completed without error.
- Completed and lead-reviewed wave 4's deterministic documentation path
  repair across 29 owned files. Its `git diff --check`, changed-target
  existence check, and stale-reference inventory passed; no application,
  workflow, manifest, lockfile, deployment, Git-ref, or live-system state was
  touched by that worker.
- Added a context-aware VTT Husky prepare helper and copied it before install
  in both frontend and backend Docker build stages. All four VTT image contexts
  now build successfully from `apps/vtt`.
- Integrated the wave-4 Codex doc-api/processor handoff after lead review.
  Doc-api compilation/service gaps, parser expectation drift, ESM runtime
  loading, deterministic test setup, current route fixtures, and the
  Elasticsearch timestamp contract are repaired without dependency upgrades
  or schema changes.
- Updated Codex CI so the doc-api job provisions isolated PostgreSQL 16 and
  Elasticsearch 8.11 service containers, initializes only its empty test
  schema, runs all 32 tests, and remains non-publishing. Other services retain
  their lightweight matrix. Root Codex orchestration now separates the
  deterministic suite from the explicit infrastructure-backed integration
  command and treats WebSocket's verified no-test state as non-failing.
- Committed the complete build/CI parity milestone as `ea1e50b`
  (`chore(monorepo): complete build and CI parity`). Its normal pre-commit hook
  passed layout validation, Tailwind collision validation, and staged ESLint.
- Added uniform OCI source/version/revision labels to all ten final image
  stages, propagated exact GitHub SHAs through VTT/Forge/Codex CI builds, and
  added the missing non-publishing Forge CI image-build job. Dockerized
  `actionlint` passes the updated workflows. The repair is committed at exact
  SHA `ac59d8a987e451d02e0206610ddf15e6ff1201d9`; all ten exact-revision images
  rebuilt successfully and loaded-image inspection verified every label.
- Removed the pre-existing four-module VTT static import cycle by dynamically
  loading `characterSyncService` only at the initiative store's existing
  outbound sync hook. Initiative state mutations remain synchronous; no
  durable persistence, WebSocket, database, or acknowledgement path changed.
- Committed the verified cycle repair and its ledger evidence as `ead14d5`
  (`fix(vtt): remove character sync import cycle`) and pushed the migration
  branch. The normal pre-commit hook passed layout, Tailwind-collision, and
  staged ESLint checks.
- Opened draft PR 230. Its body records the exact source SHAs and unresolved
  Phase 2/production boundaries. PR-triggered jobs have no package-write
  permission and the candidate-only job is skipped for pull requests.
- Draft PR 230 completed all checks at `ead14d5`: VTT lint/type/cycle, three
  unit shards, asset service, integration, managed production E2E smoke,
  Forge CI, and Codex CI all passed. Runs `34664818960`, `34664818977`, and
  `34664818979` succeeded.
- Wave-7 review remediation is implemented and lead-reviewed. The initiative
  sync repair caches its dynamic import, logs a load or sync-call failure, and
  avoids repeated failed loads. Root production docs and Make targets no longer
  advertise the component VTT Compose input as production-safe. The unified
  root workflow validates all applications at one SHA, restores Forge ARM64
  candidates, and provides one aggregate required result. Codex docs now has
  an isolated lockfile and root/CI/Dependabot coverage.
- Committed the complete interim-review remediation as exact SHA
  `371cfec52c4ce5c49c0ec020161d9ca8e8338e65`
  (`fix(monorepo): resolve interim migration review`). Its pre-commit layout,
  Tailwind-collision, staged ESLint, and diff checks passed.

## Files created, moved, or modified

- Created `docs/operations/monorepo-migration-execution-ledger.md` in the
  isolated migration checkout.
- Modified `apps/generator-hub/src/App.tsx`.
- Relocated the cave, city, and dwellings generator trees from root `public/`
  into `apps/generator-hub/public/`, including three new bridge scripts.
- Created `apps/forge` and `apps/codex` through no-squash subtree merges that
  retain their source histories.
- Moved the VTT application tree into `apps/vtt`, including its nested
  `apps/generator-hub` and `services/asset-service` boundaries.
- Created root `package.json`, `.github/workflows/forge-ci.yml`, and
  `.github/workflows/codex-ci.yml`; modified root CI/Dependabot/tooling paths,
  `apps/vtt/package.json`, the VTT observability overlay, Forge filter wiring,
  and Codex WebSocket Prisma/Docker/startup files.
- Modified 29 root/VTT documentation files to use the monorepo paths; modified
  VTT frontend/backend Dockerfiles and package lifecycle wiring; created
  `apps/vtt/scripts/prepare-husky.js`.
- Created the execution ledger.
- Extended `.github/workflows/ci.yml` with a manual exact-SHA candidate-only
  image publication path. Subsequent review remediation couples candidates to
  all same-SHA checks, restores Forge ARM64, adds the aggregate required job,
  and limits normal master publication to VTT release-scope changes while tag
  publication remains unchanged.
- Created `apps/codex/docs/package-lock.json` and
  `apps/vtt/tests/unit/stores/initiativeStore.syncFailure.test.ts`; modified
  Codex docs/root manifests, Dependabot, reusable Forge/Codex workflows, root
  operator docs/Make targets, and the VTT initiative sync boundary/tests for
  the accepted review findings.

## Commands and important outcomes

- `git status --short --branch`, `git rev-parse HEAD`, `git remote -v` in all
  three repositories: access succeeded; states recorded above.
- `git ls-remote origin refs/heads/master` in VTT: remote equals local baseline.
- `git worktree add -b codex/monorepo-migration ... c8b3fc9`: succeeded.
- `git lfs ls-files` and submodule check in VTT: no tracked LFS files or
  submodules.
- Dirty-state verification: 59 tracked deletions, 62 untracked files, one
  tracked `App.tsx` modification; all relocated files except the three edited
  `index.html` files are byte-identical to their source, with three additional
  bridge scripts.
- Initial `npm ci` invoked from the nested generator package resolved to the VTT
  workspace root and failed during postinstall because the partial install had
  not installed `patch-package`. Recovery with `npm ci --ignore-scripts`
  followed by explicit `npm run postinstall` succeeded and validated current
  dice assets.
- Generator-hub targeted `oxlint src/App.tsx` passed with one existing-style
  React hook dependency warning; type-check passed; production build passed
  after the corrected root install. A broad package lint scans bundled legacy
  generator sources and emits an impractically large warning stream.
- Fresh root install audit reported seven dependency vulnerabilities (two
  moderate, five high); no automatic audit fix or dependency upgrade was run.
- Migration commit `4567257` (`chore(generator): integrate paused generator hub
  work`) captured the user-authorized dirty state and this ledger. It used
  `--no-verify` because the repository pre-commit hook would run ESLint with
  autofix across the newly tracked third-party generated bundles, conflicting
  with the evidence-preservation goal. Targeted type/build checks were run
  explicitly instead. The pre-commit `git diff --check` exposed whitespace-only
  lines in the three new bridge scripts; they were immediately removed in the
  working tree for the next corrective commit.
- Migration commit `78f68e8` (`chore(generator): normalize bridge scripts`)
  removed those whitespace-only lines and recorded the first commit evidence;
  its staged diff passed `git diff --check`.
- Phase 0 gate commit `2a99be7` (`docs(migration): close baseline recovery
  gate`) recorded recovery, source-baseline, and generator lint remediation
  evidence.
- Forge no-squash import merge `6e5f270` has parents `2a99be7` and exact source
  tip `c6b13a9`; `git merge-base --is-ancestor` passed and the subtree tree ID
  matches the Forge source-tip tree.
- Ledger checkpoint `f16630e` recorded the verified Forge import before the
  Codex operation. Codex no-squash import merge `1dd2e64` has second parent and
  exact source tip `4c583c2`; ancestry and subtree/source tree equality passed.
- `git update-ref` created exact `forge/*` aliases for all six Forge tags. Four
  accidental unnamespaced aliases were removed only after exact-target checks;
  destination `latest` and `v1.5` remain at their original objects.
- Source-import checkpoint `96ab51f` recorded both subtree imports and tag
  disposition. Mechanical VTT move commit `81d0411` was made with
  `--no-verify` because the intentionally intermediate tree has no root package
  manifest and the still-unrepaired root hook invokes moved `scripts/*`; its
  staged diff had only 927 `R100` entries and passed `git diff --check`.
- Read-only Dockhand calls captured the live Compose template, container/image
  identities, mount destinations, restart policies, health checks, network,
  environment-variable names, and Git-registration state. Secret values were
  not written to the repository or ledger.
- The initial VTT backend image build failed because the moved package's Husky
  lifecycle referenced an unavailable root path. After introducing the
  context-aware helper, a second backend attempt showed that the helper itself
  had to be copied before `npm ci`; the Docker copy order was corrected and the
  third backend attempt passed. The frontend independently exposed the same
  missing pre-install copy in its builder stage; adding that explicit copy made
  its next build pass. These failed attempts created no running resources and
  no published images.

## Tests and validation

- Generator-hub `npm run type-check`: passed.
- Generator-hub `npm run build`: passed (16 modules; Vite build in 3.96s).
- Targeted `npm exec oxlint -- src/App.tsx`: exit 0 with one hook dependency
  warning at `src/App.tsx:141`.
- Forge baseline `npm ci`: passed (472 packages). `npm run lint`: passed.
  `npm test -- --run --coverage`: passed, 31 files and 410 tests with 66.38%
  statements. `npm run build`: passed. `npx tsc --noEmit`: failed at
  `src/components/SpellbookManager/SpellbookManager.tsx:312` because
  `favoriteSlugs` is missing from a value typed as `SpellFilterState`.
  Source checkout remained free of tracked changes.
- Codex baseline: all five service-local `npm ci` commands passed. Prisma
  generation passed for doc-api and doc-processor but failed for doc-websocket
  because its tracked `prisma/schema.prisma` contains a path string rather than
  valid Prisma syntax. Doc-api Jest passed (one suite/two tests), but its build
  failed on missing service methods, an unused variable, and an invalid health
  status type. Doc-processor build and Prisma passed; tests had six passing and
  four failing suites due extraction expectation drift, Jest ESM transforms,
  and integration-like OCR environment requirements. Doc-websocket build
  passed and has no Jest tests. Both UI production builds passed and have no
  Jest suites. No tracked source changed.
- Live public `/health`, `/api/system/health`, and
  `/api/metrics/multiplayer` returned HTTP 200 on 2026-09-11. Realtime was
  connected with zero connections, three successful state commits, no commit
  failures/conflicts/resyncs, queue depth zero, and commit p95 25 ms. Overall
  multiplayer SLO was noncompliant only because heap utilization was ~0.943,
  above the configured 0.9 threshold.
- Live backend `/metrics` returned 200 without authorization because
  `METRICS_AUTH_TOKEN` is unset. The frontend does not proxy `/metrics` and
  public `/metrics` serves the SPA, but the backend endpoint is accessible to
  every container on shared `homelab-net`. This is a pre-existing protection
  gap to resolve in the cutover configuration.
- Full VTT baseline validation completed. `npm run type-check`, dice-asset
  verification, unit tests (72 files passed, one skipped; 596 tests passed,
  24 skipped), asset-service tests (29 passed), integration tests (two passed,
  17 skipped), and `npm run build:all` passed. The baseline cycle check failed
  on the pre-existing `characterSyncService -> initiativeStore ->
  characterStore -> gameStore` cycle. Full lint found only two issues in the
  integrated dirty generator App; the migration branch fix passes targeted
  ESLint, generator type-check, and the rerun full repository lint gate.
- Post-move VTT parity: `npm ci` from `apps/vtt` passed with patch-package and
  13 dice themes; Husky root-hook installation passed after path repair. Lint,
  full type-check, dice check, unit tests (596 passed/24 skipped), asset-service
  tests (29 passed), integration tests (two passed/17 skipped), and
  `build:all` all passed. At that milestone the import-cycle result was
  unchanged from baseline; wave 5 subsequently removed the cycle and its
  focused checks pass.
- All six active root workflows pass `actionlint`. Production, development,
  test, and combined smoke/soak Compose rendering passed. Production rendering
  emitted expected missing-secret warnings with no secrets supplied.
  Production plus observability rendering resolved Prometheus and Grafana bind
  sources to the repository-root `monitoring` directory after repair.
- Post-fix Forge `npm ci`, TypeScript, lint, 31-file/410-test coverage, and
  production build passed. Coverage is 66.53% statements; `remoteEntry.js` was
  emitted. Existing audit and bundle warnings remain separately classified.
- Post-fix Codex WebSocket `npm ci`, default `npm run prisma:generate`, and
  TypeScript build passed using the canonical regular schema.
- Post-fix Codex doc-api Prisma generation and TypeScript build passed. Its
  focused unit suite passed two tests. With isolated PostgreSQL 16 on loopback
  port 5433 and Elasticsearch 8.11 on loopback port 9201, Prisma schema push to
  the empty test database passed and the full doc-api suite passed all three
  suites and 32 tests. The expected 404 update case emits a Prisma not-found
  diagnostic while still passing.
- Post-fix Codex doc-processor Prisma generation and TypeScript build passed.
  After lead removal of the weakened parser shim, the full real-parser suite
  passed all ten suites and 43 tests under Jest VM-module support.
- VTT application-context image builds passed for backend, frontend,
  asset-service, and PostgreSQL. Local immutable image IDs are respectively
  `sha256:8a5e0b0576a0ca692954672fae1f40e5d4bad0597eab22596b58f54d8eba59ec`,
  `sha256:878ae4707c821f108d94fa3dc66f2417b085b90596ad7dabb70da1370736ac2a`,
  `sha256:286c0b5475a28ec0c1a63f1f15d0f076a66e28dc54dcc572d4d5226b7f5c166e`,
  and `sha256:431aa9caf9f9d039bce407ae0e8fd4647619ccb4d60fde4bc093d3ecbd87ba45`.
  No image was pushed or used by production.
- Forge and all five Codex application-context image builds passed. Local
  immutable image IDs are Forge
  `sha256:567fbf5df77dde052f5cd18a90c82975443f60fda52b307f756a6a22d18b8ee4`;
  doc-api
  `sha256:b3eff1bcc766a59011ece0fb6d59766eadd8654b9a3abbb171a452f26207ebbc`;
  doc-processor
  `sha256:7fff7ae2d5c3053b4682e91d95d03bbfdbcb99fed7f1c651d19107fe7a726bc3`;
  doc-websocket
  `sha256:9ffff9efbbdbd61e446248a28ddbef7b08a1f7fd37e1f2a4be94ddc30bc947ff`;
  admin-ui
  `sha256:9fe6a60053677a33339fd4b34195bea4b6554ea7ee29e1c928029f565d74baf7`;
  and dm-ui
  `sha256:169c80133bab8839e5c657a33ba5aa3a2f74f314553f49a7396e9239f24d3335`.
  No image was pushed or used by production. Existing dependency-audit,
  Browserslist, bundle-size, and Forge cross-chunk warnings remain classified
  separately; the processor's native dependency image took several minutes in
  recursive ownership/export but completed successfully.
- Dockerized `actionlint` passed all active root workflows after the isolated
  Codex service job was added. Root `npm run build:codex` passed all five
  service builds. Root `npm run test:codex` passed the two doc-api deterministic
  tests, all 43 processor tests, and the WebSocket no-test check.
- Exact candidate rebuilds from commit
  `ac59d8a987e451d02e0206610ddf15e6ff1201d9` passed for all ten shipped image
  contexts. Loaded-image inspection verified source
  `https://github.com/joelmale/nexusVTT`, version `monorepo-ac59d8a`, and that
  exact full revision on every image. Local immutable IDs are:

  | Candidate | Local immutable image ID |
  | --- | --- |
  | VTT frontend | `sha256:5834b1f5af0db7bc1bbbca7334b436797baec0d152accaf8f8c1d96a45505553` |
  | VTT backend | `sha256:df2386361bc041a6b00b74e16680187f475c6cc023886c30a289cfc19079a319` |
  | VTT asset service | `sha256:73adf534c58d0326372fdb3010d10fd950083c6ea4e36d824deb017fb2a1be83` |
  | VTT PostgreSQL | `sha256:1aadf00e7b0ec2c1f1ea8d5c886814fd13eb8140f84a1ad32d0e2f48619d60d8` |
  | Forge | `sha256:fdcecab6668a20f8afd341352a18569d1438c58e4ff95f314b394e8c80656982` |
  | Codex doc-api | `sha256:efd9432c2aa33a340108d55cbdc4e9fd4b5c12a19a6b3fc9633b9f684a6f42f7` |
  | Codex doc-websocket | `sha256:cba6b2eaf492e7da6008b836d816d858568d46c59e19471edb5756ca1ca503fc` |
  | Codex doc-processor | `sha256:ebe5a4dc665ed6af8cab4442fd047cf8c9e498a87ef2d8ded1cc21bb8775a3c8` |
  | Codex admin UI | `sha256:bae3470980db10c6b6931018c6ca309ddbf885acc480bc6b6c8288c1afdbd988` |
  | Codex DM UI | `sha256:2d314de0d612e78fad7c6aecbfe1990afa74a9df206a9f4d21d340fbe2e95df1` |

  These are local manifest-list IDs with local repository digests, not yet
  registry digests. No image was pushed or used by production.
- `git push --set-upstream origin codex/monorepo-migration` published only the
  migration branch. Its push matches no workflow branch trigger; GitHub did not
  start a workflow or deployment. Direct GHCR pushes for VTT frontend and
  backend then failed with `permission_denied` because the CLI token lacks the
  expected package-write scope. No candidate manifest was created and no
  production tag moved. Dockerized `actionlint` passes the guarded CI workflow
  used for the package-token fallback.
- Guarded workflow run `34664250908` checked out and verified exact source
  `ac59d8a987e451d02e0206610ddf15e6ff1201d9` in every candidate matrix job.
  It published the four VTT tags below. Local registry inspection can pull the
  backend tag and confirms the expected source/version/full-revision OCI
  labels. Forge and all five Codex pushes failed only at GHCR authorization
  with `permission_denied: write_package` after their builds completed.

  | Published candidate | GHCR index digest |
  | --- | --- |
  | `ghcr.io/joelmale/nexusvtt/frontend:candidate-ac59d8a` | `sha256:00d67e257017dbe77d23e0e40f084086d26d08ea73b61271582aeeb4a52ac4f2` |
  | `ghcr.io/joelmale/nexusvtt/backend:candidate-ac59d8a` | `sha256:51bd87240ca3cecf5571b144fc9b7bf700fbad48ca19df536bac44cfb1a568a4` |
  | `ghcr.io/joelmale/nexusvtt/asset-service:candidate-ac59d8a` | `sha256:808e97ad2f1a2f2092fafd9e9848e2db6c7230b7908909f6b049ed8dd1cf488e` |
  | `ghcr.io/joelmale/nexusvtt/postgres:candidate-ac59d8a` | `sha256:3396c45eba620980c9c6344a40f058401aa43cc3d97791e1cbf5f0bd39ba017b` |

- The same workflow's normal `Build & Push to GHCR` job was skipped, proving
  no normal version or `latest` tag was published. Its VTT lint/type job passed
  install, lint, and type-check, then failed at the already-baselined static
  import cycle; dependent unit/integration/E2E jobs were consequently skipped.
- Dockhand environment 1 rejected a pull of the published backend candidate.
  Registry entry 2 is configured for `ghcr.io` with credentials, but a
  read-only registry search returns `Authentication failed. Check the registry
  credentials.` No container, stack, registry setting, or image tag changed.
- Wave-5 and lead reruns both report no static import cycles across 284 VTT
  modules. Full configured VTT type-check passes; targeted ESLint passes; and
  `initiativeStore`, `characterStore`, and `gameStore` unit suites pass all 59
  tests. `git diff --check` passes. Only the outbound no-op sync hook is now
  deferred to module loading.
- Wave-7 focused VTT validation passes: targeted ESLint; two initiative-store
  files with 25 tests; no cycles across 284 modules; and the complete VTT type
  check. A first lead invocation from the repository root used incorrect npm
  execution paths and produced no valid test result; it was immediately rerun
  from `apps/vtt` and passed, so it is a command-invocation error rather than a
  source failure.
- Codex docs `npm ci` and typecheck pass. Webpack 5.109.0 reproduced the
  Docusaurus/webpackbar schema failure; exact 5.105.4 compiled successfully and
  then exposed a pre-existing `/docs/index` footer link. After correcting the
  link, docs build passed. Root `npm run build:codex` passes all five services
  plus docs; root `npm run test:codex` passes doc-api's two focused tests,
  processor's 43 tests, the explicit WebSocket no-test gate, and docs typecheck.
  The docs lock reports 26 existing audit findings (8 moderate, 18 high), not
  changed under this migration.
- Official actionlint 1.7.12 passes every active root workflow after the unified
  required gate and reusable workflow changes. The first release-download
  glob used the wrong Windows architecture spelling and a second direct
  wildcard invocation was not expanded by PowerShell; the corrected official
  `windows_amd64` binary repository scan passed with exit 0. Documentation
  scans find the old production commands only in explicit prohibitions, and
  `git diff --check` passes.
- Unified PR run `34675467094` at exact SHA `4921497c5ee21f92cb38a6c04766809d206c5005`
  passed every underlying application, image-build, docs, integration, and E2E
  gate. `Monorepo required` failed before its script started because the
  inherited `apps/vtt` working directory was absent in that checkout-free job.
  This is a migration-introduced workflow failure; the job now selects
  `${{ github.workspace }}` explicitly. The workflow default token is also
  narrowed to read-only contents; only the two publisher jobs retain explicit
  package-write permission.
- Draft PR 230 was created against `master` from
  `codex/monorepo-migration`; GitHub reports it as draft. Its CI, Forge CI, and
  Codex CI checks started, while the candidate publisher is correctly skipped.

## Failure classification

- Pre-existing/tooling failures: Codex docs lacks a lockfile; documented Codex root test runners are
  absent. Forge README's example maps port 8080 to container port 80 although
  its image listens on 8080. Forge's pre-existing
  `SpellFilterState.favoriteSlugs` TypeScript failure is fixed and all Forge
  local gates pass. Forge install reported 23 dependency audit
  vulnerabilities (seven moderate, 16 high), plus stale Browserslist,
  cross-chunk circular export, and large-chunk build warnings.
- Codex pre-existing failures: doc-api TypeScript build errors; doc-processor
  four failing Jest suites; no WebSocket/UI tests. The invalid WebSocket Prisma
  proxy and start-output mismatch are fixed. Remaining failures are
  source-baseline, not migration
  regressions, but must be repaired or explicitly dispositioned before the
  production gate.
- Live pre-existing operational failures: multiplayer heap-utilization SLO is
  currently failing; backend Prometheus metrics are not token-protected on the
  shared Docker network; `/api/system/health` returns no explicit database
  readiness field despite the current runbook's stated expectation.
- Migration-introduced failures: the VTT frontend/backend Docker install-layer
  Husky failures were introduced by the move and are fixed. No open regression
  remains in the VTT, Forge, root workflow, or Codex parity slices. Wave 4
  repaired the blocking Codex baseline failures; the intentionally testless
  WebSocket/UI services remain explicitly reported rather than disguised as
  tested.

## Review findings and disposition

Interim independent Phase 0–2 review completed in wave 6. All six findings are
accepted; none is waived:

1. P1: candidate publication lacked same-SHA validation dependencies, and the
   published `ac59d8a` candidates predate the cycle fix. Repository fix locally
   validated; final disposition requires the new aggregate PR check and a full
   candidate run from the resulting exact commit.
2. P1: Forge candidate publication lost source ARM64 parity. Repository fix
   locally validated with actionlint; final disposition requires the new
   dual-platform candidate manifest.
3. P1: root operator docs/Make target presented the generic VTT-only Compose
   file as production-safe. Resolved locally by wave 7 and lead review.
4. P1: no always-running aggregate required CI result existed. Resolved locally
   with the unfiltered PR trigger and `Monorepo required` aggregate; remote run
   remains required.
5. P2: `apps/codex/docs` had no isolated lockfile/build/CI/Dependabot mapping.
   Resolved locally; clean install, typecheck, build, and root orchestration pass.
6. P2: lazy character sync had no import-failure handling or focused side-effect
   test. Resolved locally; failure handling, sync payload tests, cycle check,
   typecheck, and focused tests pass.

The reviewer independently found no issue in source-tip ancestry, `git fsck`,
Forge tag namespacing, VTT move history, VTT Docker context paths, or
non-publishing PR behavior. Final independent review remains required after
these findings, Phase 3, and the cutover package are complete.

## Blockers and pending approvals

- No filesystem, repository, Docker, or live-read access blocker.
- Both wave-3 delegation attempts were rejected by the application's subagent
  usage limit before work began. Later waves were accepted with the requested
  model overrides. All agents are complete and closed; no delegated ownership
  remains active.
- GitHub package Actions access must be granted from the destination
  `nexusVTT` repository to the existing `nexus-forge` and five
  `nexuscodex-*` packages before their immutable candidate tags can publish.
  This is a cloud permission change and is pending explicit user approval.
- Dockhand's saved GHCR credential is invalid. Completing the pull gate needs a
  new least-privilege `read:packages` credential saved to Dockhand; this is a
  live credential change and sensitive-token transmission, pending explicit
  user approval and token availability.
- Production cutover approval is not requested and no production mutation is
  authorized.
- Phases 0 and 1 are complete. Phase 2's functional checks and local
  exact-revision image traceability pass, and four VTT candidates are published;
  the controlled Dockhand pull requirement remains. Phase 3 has not started.

## Pending difficult-to-reverse or long-running operation

No difficult-to-reverse operation is active. The isolated doc-api test
containers `nexus-migration-docapi-pg-20260911` and
`nexus-migration-docapi-es-20260911` were removed after passing evidence was
recorded; they had no named volumes and contained only disposable test data.
No production network, volume, image tag, or data was in scope. No
migration-era backup or restore resource will be deleted without the later
explicit cleanup approval.

## Remaining work in priority order

1. Validate, commit, and push the aggregate working-directory correction;
   verify draft PR 230's new `Monorepo required` result and all underlying
   same-SHA checks.
2. With explicit approval, grant destination Actions access to the six legacy
   packages and replace Dockhand's invalid GHCR credential with a dedicated
   read-only package token; rerun complete exact-SHA candidate publication,
   verify all registry digests/labels including Forge ARM64, independently pull
   through Dockhand, and close Phase 2.
3. Rehearse the isolated deployment with disposable data and unique resources.
4. Prepare the production Git cutover package without mutating production.
5. Complete final independent review, resolve findings, and rerun affected
   checks.

## Ready-to-use resumption prompt

Resume the Nexus monorepo migration from
`C:/Users/nelso/Documents/Coding/nexusVTT-monorepo-migration` on branch
`codex/monorepo-migration`. Read this entire ledger and
`docs/operations/monorepo-migration-plan.md`, then inspect `git status` and the
latest ledger entries. Preserve the user-authorized generator moves in the
original `nexusVTT` checkout. Wave-7 review remediation is committed at
`371cfec52c4ce5c49c0ec020161d9ca8e8338e65` and its underlying unified PR
run passed, but the checkout-free aggregate job inherited a missing `apps/vtt`
working directory. Validate, commit, and push the pending workflow correction,
then verify draft PR 230's aggregate same-SHA gate.
All prior agents are complete and closed, so ownership has returned to the
lead. Then continue from the exact Phase 2 registry/package approval action
above, obey the two-subagent concurrency cap, and do not cross the production
approval boundary.
