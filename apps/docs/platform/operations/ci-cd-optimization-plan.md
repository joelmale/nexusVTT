# CI/CD optimization rollout plan

Date: 2026-09-22  
Status: Proposed; implementation and repository settings changes are pending  
Repository: `joelmale/nexusVTT`  
Planning baseline: checkout `9c8e038d`; timing baseline includes `9266658d`

## Outcome and constraints

Reduce validation and publication latency in three measured stages without
removing tests, reducing coverage thresholds, weakening TypeScript/ESLint rules,
or reducing security scan coverage. Close the existing enforcement gaps before
making validation conditional on changed paths.

All paths below are relative to the repository root. Install dependencies at the
root. Run VTT scripts in `apps/vtt` or through explicit workspace commands.

This plan does not authorize production deployment. Rollout means merging CI
changes, validating candidate artifacts, and enabling the specified repository
rules through the normal reviewed change process. Preserve unrelated local work.

## Baseline and measurement protocol

| Observed run      | Elapsed | Evidence                                                         |
| ----------------- | ------- | ---------------------------------------------------------------- |
| Main, 35782127808 | 13m 55s | Lint/types 2m 01s; smoke 4m 27s; serial image publication 7m 12s |
| Main, 35774073603 | 14m 16s | Same dependency chain                                            |
| PR, 35561248389   | 15m 50s | Smoke started 5m 22s after its lint dependency completed         |

Run links:

- [Latest measured main run](https://github.com/joelmale/nexusVTT/actions/runs/35782127808)
- [Previous measured main run](https://github.com/joelmale/nexusVTT/actions/runs/35774073603)
- [Measured PR run](https://github.com/joelmale/nexusVTT/actions/runs/35561248389)

Before changing execution behavior, add a small read-only reporting script under
`scripts/ci/` that collects Actions run/job/step timestamps and emits JSON plus a
human-readable summary. Reuse this report after each stage.

Record these dimensions separately:

- Commit, workflow revision, event, runner class, affected workspaces, cache
  state, job conclusions, test counts, and retries.
- Time from trigger to validation gate; trigger to completed publication;
  execution duration for each job; job-start delay after dependencies finish.
  Treat the latter as scheduling delay, not a precise measure of account quota.
- Install, contract build, image build, cache import/export, scan, test,
  artifact transfer, and image push durations.
- Runner minutes, cache storage, artifact sizes, and configured/account runner
  concurrency, including overlap with other workflows and repositories.
- Coverage percentages and measured source inventory, discovered/executed test
  inventory, SARIF categories, SBOMs, source SHA and published image digests.

Use representative VTT-only, Forge-only, Codex-only, shared dependency, docs-only,
and workflow-only changes. Compare matched change classes; a faster docs-only
run is not evidence that full validation became faster. Use a controlled cache
namespace for cold runs instead of deleting shared caches. Label whether a
rerun used a PR merge SHA or a branch SHA.

For each stage collect at least three controlled cold runs and ten warm runs,
then observe twenty normal completed runs. Report medians immediately and treat
tail estimates as provisional until the normal-run sample is available. Track
cancelled superseded runs separately. Fix runner saturation before expanding
matrix sizes.

An initial warm full-main target is approximately 9–10 minutes after scheduling
changes, assuming available runners and comparable work. It is not an acceptance
promise: newly enforced integration, coverage, and security checks add useful
work. Report speed changes and added validation cost separately.

## Validation contract preserved throughout rollout

| Surface           | Required contract                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VTT static checks | ESLint with zero warnings and explicit-any errors; web, server, asset-service, generator-hub, E2E and soak type checks; workspace lock, import-cycle and dice-asset validation      |
| VTT tests         | All unit/source tests, asset-service tests, database integration tests, UI layout tests, and managed two-replica smoke including recovery after SIGKILL following ACK               |
| VTT coverage      | Lines 53%, functions 52%, branches 43%, statements 53%; explicit source inclusion and aggregate enforcement                                                                         |
| Forge             | Types, lint, production build, existing tests and shared character-creator tests; current coverage thresholds retained                                                              |
| Codex             | Existing service tests and builds, real API integration execution, UI lint, explicit inventory of services that currently have no tests                                             |
| Documentation     | Type check and build; deploy the same validated output                                                                                                                              |
| Security          | CodeQL security-extended, Trivy filesystem/container findings, Grype, existing SARIF categories, dependency/base-image/Actions updates, CycloneDX artifacts and release attachments |
| Multiplayer soak  | Existing nightly duration, chaos settings, conflict workload and reports; required execution for durability/reconnect changes                                                       |

Do not lower coverage thresholds or narrow source inclusion to make the restored
gate pass. If restoring coverage reveals insufficient coverage, add meaningful
tests before that PR passes. Do not replace typed fixes with lint disables or
explicit `any`. Keep UI tests at `--workers=4 --retries=0`; do not parallelize
shared-stack destructive smoke cases without isolated stacks.

## Stage 1 — Scheduling and complete validation gates

Goal: remove unnecessary serial execution, reduce superseded work, and make every
required validation result a prerequisite for release publication.

### PR 1A: Baseline, independent jobs and PR cancellation

Owner: CI maintainer. Dependencies: baseline report collected.

Files: `.github/workflows/ci.yml`, `.github/workflows/security.yml`, proposed
`scripts/ci/` timing reporter.

1. Add the measurement report and capture the current test/check inventory.
2. Remove the VTT test jobs' dependency on `lint-and-type`. They install and
   build their own inputs; retain those steps. They may depend on `changes`,
   but remain unconditional for now.
3. Keep three unit shards and current worker settings. Do not split the short
   contract build into another required job.
4. Cancel superseded PR runs, grouped by workflow and PR number. Give push,
   release and manual runs independent groups. Ensure reusable security jobs
   do not share a cancelling concurrency group with their caller.
5. Add explicit reasonable timeouts and retain failure diagnostics and cleanup.

Acceptance: checks execute concurrently when runners are available; all tests
remain represented; a newer PR update cancels only the older PR run; cancellation
does not leave managed resources behind. Record runner-minute changes.

### PR 1B: Restore coverage, integration and lint enforcement

Owner: VTT/Forge/Codex maintainers. Depends on the check inventory; can be prepared
while PR 1A is measured, but lands as a separate change.

Files: VTT Vitest configurations, Forge ESLint configuration, Codex API test
configuration/scripts, `.github/workflows/codex-ci.yml`, and affected typed source
or tests needed to satisfy the gates.

1. Replace obsolete VTT `coverage.all` with explicit production-source inclusion
   compatible with the installed Vitest version. Preserve intentional exclusions.
2. Collect coverage with the existing unit shards and the integration suite.
   Merge compatible raw reports in one required aggregation job. Account for
   container/host source-path differences before merging. Enforce global
   thresholds on the complete report, not on individual shard subsets.
3. Require the expected report manifest: missing shard, missing integration
   report, wrong source SHA, or incompatible tool version fails aggregation.
   Compare the merged result against an unsharded reference run using the same
   source set. Do not use cached test success or average coverage percentages.
4. Give Codex API integration tests a dedicated configuration that actually
   includes them; the current base configuration excludes them. Keep unit tests
   separate. Provide isolated database/search configuration to the test step,
   any additionally required services, schema initialization, and cleanup.
5. Invoke both Codex UI linters. Enforce explicit-any errors across owned
   TypeScript, including Forge tests, and inventory remaining service/shared
   package lint scope. Fix violations with appropriate types.
6. Verify services marked `test: false` against their source inventories. Do not
   invent an empty passing suite; ensure a newly introduced test is discovered
   or forces an explicit CI inventory update.

Acceptance: failing assertions, lint violations and type errors fail CI;
deliberately missing coverage artifacts fail; threshold failure blocks the gate;
Codex integration files are visibly discovered and executed against isolated
services. All existing tests remain included.

### PR 1C: Gate security and publication; matrix release builds

Owner: CI maintainer plus repository/security administrator. Depends on PR 1B.

Files: CI/security workflows, scanner policy, gate script and its tests;
repository rulesets/settings through a separately recorded settings change.

1. Extract the security jobs into a reusable workflow accepting an exact source
   SHA. Call it from CI for PR/main/manual validation. Retain a thin release
   wrapper for release-specific SBOM attachment. Remove duplicate PR/main
   triggers when the caller becomes authoritative.
2. Preserve CodeQL/Trivy SARIF categories and reporting severities. Add a blocking
   vulnerability policy for high/critical findings, retaining medium filesystem
   reporting. Surface scanner errors as failures. Fix baseline vulnerabilities;
   any necessary exception must have a reason, owner and expiry, with no blanket
   ignore-unfixed policy.
3. Define how CodeQL findings block merges/publication using supported code
   scanning protection or an explicit findings policy. A successful analysis
   job means the scan completed, not that it found nothing.
4. Create a pre-publication `validation-gate` covering static checks, tests,
   coverage, applicable workspace checks, docs and security. It always evaluates
   results and rejects failure/cancellation/unexpected skip. Maintain the stable
   required-check name deliberately; migrate repository rules only after the
   replacement check has been observed.
5. Make both release and candidate publishing depend on that gate. Keep a
   separate delivery-result job after publication; never make validation depend
   on publication, which would create a dependency cycle.
6. Matrix the four release images with `fail-fast: false`. Preserve candidate
   image targets, Forge ARM64 parity, tag semantics and explicit source identity.
   Serialize release promotion where needed so an older push cannot overwrite
   newer mutable tags. Final digest promotion is completed in Stage 2.
7. Validate candidate SHA syntax before using it; pass it through environment
   variables rather than interpolating user input into shell code. Validate,
   scan and label the resolved checkout SHA, including manual runs.
8. Keep PR jobs unprivileged. Grant registry writes only to trusted publication
   jobs; never use `pull_request_target` to execute PR code. Pin external Actions
   to reviewed commit SHAs and retain Dependabot updates.
9. Recheck current branch rules. After observing successful check names, require
   validation/security and one approving review. If merge queue is enabled,
   support its validation event before requiring the check there. Verify fork
   PR behavior with the actual token/SARIF permission model.

Acceptance: inject failures into UI, docs, coverage, integration, static checks
and security; none may reach publishing. Candidate dispatch validates its exact
SHA, publishes only candidate tags, and leaves release aliases untouched. Tag and
manual-release runs execute all required consumers. Stage 1 meets the validation
contract and has a measured before/after report.

Rollback: revert the scheduling/matrix optimization independently while keeping
the complete gate. If a gate is defective, hold publishing and repair it; do not
make the failing check optional. Record check-name changes before updating rules.

## Stage 2 — Stable Docker layers and shared build outputs

Goal: stop reinstalling on unrelated source/metadata edits and stop rebuilding
identical artifacts for tests, scans, SBOMs and publication.

### PR 2A: Docker layer ordering and cache plumbing

Owner: build maintainer. Depends on Stage 1 acceptance.

Files: VTT Dockerfiles, Forge/Codex Dockerfiles after equivalent inspection,
root `.dockerignore`, image build configuration, smoke/soak build configuration.

1. Copy manifests, lockfile, npm configuration and lifecycle prerequisites before
   dependency installation. Copy frequently changing source afterward.
2. Preserve VTT patch-package behavior, dice synchronization, creator stylesheet
   generation, native dependencies and Prisma generation. Do not use a blanket
   `--ignore-scripts` shortcut or scoped installs that break hoisted resolution.
3. Move label-only VERSION/COMMIT_SHA arguments after expensive commands; place
   frontend build metadata immediately before the build that needs it. Remove
   unused arguments from unrelated builder stages.
4. Add external BuildKit caches to security and managed image builds. Define a
   single owning exporter per scope/run, with explicit image/platform/build
   variant identity and branch trust boundaries. Keep cold-cache correctness.
5. Benchmark cache export and restore costs. Retain GHA initially; evaluate a
   registry backend only if net timing/storage results justify it. An npm cache
   mount is not automatically persisted by the GHA layer cache backend.
6. Prototype a smaller backend runtime stage with only production dependencies,
   compiled output and required migrations/scripts/assets/runtime tools. Verify
   startup, shutdown signals, non-root operation and recovery before adoption.

Acceptance: a source-only edit reuses dependency installation; a metadata-only
edit rebuilds only affected outputs; dependency/patch/config changes invalidate
the correct layers. Clean builds and warm builds run the same smoke suite. Image
startup and scans pass, and export time plus image size are recorded.

### PR 2B: Build once, scan/test artifacts, promote digests

Owner: CI/build maintainer. Depends on PR 2A.

Files: reusable image workflow or Bake definition, security consumers,
`apps/vtt/scripts/run-e2e-smoke.js`, smoke Compose, publication logic.

1. Establish one image definition manifest containing Dockerfile, context,
   target, platform, build arguments and cache scope. Preserve all existing image
   build checks; reuse compatible builds instead of deleting validation.
2. Use one loaded image per target for Trivy, Grype and CycloneDX generation.
   Eliminate separate SBOM rebuilds. Preserve retention and release attachments.
3. Add a CI prebuilt-image mode to the managed smoke runner. Its default local
   behavior may continue building. In CI, missing or mismatched artifacts must
   fail rather than silently rebuilding. Keep health waits, two backend replicas,
   logs and cleanup.
4. Keep delta-enabled smoke as a distinct frontend variant. Add validation of the
   release frontend configuration before promoting it. Do not claim the current
   delta-enabled smoke image is byte-identical to the release frontend.
5. Transfer exact-run artifacts for untrusted PRs without registry write access.
   For trusted runs, use immutable staging references where useful. Bind every
   report to source SHA, image digest, platform and build arguments; reject
   artifacts from another run/attempt or trust boundary.
6. Build image artifacts before the final validation gate, with no release alias
   changes. Test and scan them, then promote validated digests without rebuilding.
   Treat OCI multi-platform indexes and platform images explicitly; verify the
   selected transport preserves the identity and required metadata.
7. Produce an all-images release manifest. Update mutable release aliases only
   after all required targets succeed; serialize and guard against stale runs.
   Registry tag updates across images are not atomic, so deployments should use
   the complete digest manifest, not a partially updated set of latest tags.
8. Preserve candidate-only semantics and use full-SHA identity internally even
   if existing short-SHA tags are retained for compatibility.

Acceptance: prove the published digest is the scanned/tested artifact where build
variants match; prove distinct frontend variants remain validated; reject wrong
SHA/digest/missing artifacts; a partial matrix failure produces no successful
release manifest or promotion. Both cold and warm paths pass.

### PR 2C: Integration and documentation output reuse

Owner: CI/docs maintainers. Depends on Stage 1 gates; land after PR 2B to keep
measurement attributable.

1. For VTT integration, first restore/mount an npm download cache into the test
   container. Benchmark a host-runner plus PostgreSQL service alternative only
   if needed. Preserve database guard, schema/transaction tests, environment and
   cleanup; do not scope away workspaces required by hoisted test dependencies.
2. Have the trusted main docs validation job upload its built Pages artifact.
   Deploy that exact artifact after validation without a second build. Prefer a
   same-workflow consumer; cross-workflow reuse must verify originating run/SHA.
3. Keep Pages write/OIDC permissions only on the trusted deployment job and
   preserve deployment serialization and environment settings.

Stage acceptance: no duplicate scan/SBOM build for the same image inputs; no
duplicate Pages build for the same validated commit; cache export overhead and
runner minutes improve without reducing test/security outputs. Rerun managed
smoke and conflict-enabled chaos soak for container/runtime changes.

Rollback: retain the tested build-from-source smoke mode and previous image
build definition during the observation window. Revert reuse/cache optimizations
if necessary, preserving checks. Never fall back to a previous commit's successful
test result or deploy an unvalidated artifact.

## Stage 3 — Dependency-aware conditions and optional caches

Goal: skip only demonstrably unrelated work and reduce maintenance duplication.

### PR 3A: Central affected-target model and filter tests

Owner: CI maintainer with workspace owners. Depends on Stage 2 acceptance.

Files: centralized path/dependency configuration, change detector and tests,
CI/Forge/Codex/docs workflow conditions, required gate expectations.

1. Define separate targets for VTT validation, unified gateway, Forge, Codex
   services/UIs, docs, assets and Postgres. Model consumer dependencies explicitly.
2. Gateway inputs include VTT, generator-hub, Forge, both Codex UIs, relevant
   shared packages, Docker/nginx configuration and dependency inputs. Fix the
   current omission of Forge/Codex UI changes from gateway publication.
3. Initially retain broad fanout for root lockfile/manifests, `.npmrc`, shared
   packages/tooling and CI configuration. Include `.dockerignore` in applicable
   build triggers. Tighten individual package dependencies only with evidence.
4. Test docs-only, frontend-only, backend-only, Forge-only, each Codex UI/service,
   root dependencies, migrations, Dockerfiles, deployment, monitoring, renamed
   files, deletions, workflow/config changes and unknown/unclassified paths.
5. Always schedule the required workflow on PRs. Use job-level conditions rather
   than top-level PR path filtering. Fail closed or run broad validation if
   change detection fails, truncates results, or cannot resolve its comparison.
6. The required gate derives expected jobs from the detector; it must reject an
   expected job that was skipped. Keep full validation for manual candidates,
   tags and designated full-suite runs. Keep security categories present on PRs.
7. Keep nightly chaos/conflict soak unchanged and run it for durability/reconnect
   changes. Do not reduce workload duration to meet the CI latency target.

Rollout: first record proposed skip decisions while still running the complete
applicable suite. Compare decisions against changed inputs and test results for
ten representative runs. Then enable conditions by target, starting with docs
and independent services; gateway filtering comes after consumer tests pass.

Acceptance: unrelated docs changes avoid application builds; Forge/Codex UI
changes still validate and publish the unified gateway on eligible events;
shared dependency changes fan out; unknown changes are conservative; all
intentional-skip and unexpected-skip gate tests pass.

### PR 3B: Shared setup and benchmark-driven optional caches

Owner: CI maintainer. Depends on PR 3A.

1. Extract repeated setup/install/contracts behavior into a composite action,
   with explicit working directories and the root lockfile. Centralize runner
   toolchain versions without changing supported runtimes during this refactor.
2. Benchmark `npm ci --prefer-offline`; retain lifecycle/security behavior.
3. Trial ESLint content caching with lockfile/config/toolchain identity. Verify
   configuration changes invalidate it and uncached lint agrees.
4. Evaluate TypeScript incremental or build-output caching only with complete
   inputs: source, dependencies, compiler/config versions, generated inputs,
   build mode, platform and relevant environment. Every cache must be optional
   for correctness; no stale success-result reuse.
5. Keep contract builds local unless measured transfer savings exceed their
   current 3–5 second rebuild cost. Do not add broad node_modules caches.
6. Keep browser caching low priority; compare transfer and OS dependency costs
   before adopting it. Preserve test isolation, retry behavior and test inventory.
7. Compare matrix size/runner class only after scheduling delays are measured.
   Make any paid runner decision from wall-time and runner-minute evidence.

Stage acceptance: matched-change medians improve, cold runs remain correct,
runner cost/storage remain acceptable, and full-suite control runs agree with
conditional results. Publish the final timing and validation inventory report.

Rollback: force all targets affected while retaining the detector report, then
repair the filter. Disable individual optional caches without changing commands
or gates. Revert abstraction changes separately from behavior changes.

## Release sequence and completion checklist

PR order: 1A → 1B → 1C → Stage 1 observation → 2A → 2B → 2C → Stage 2
observation → 3A shadow decisions → 3A activation → 3B → final observation.
Prepare independent fixes concurrently if staffing allows, but land separately
so runtime and reliability changes can be attributed.

Before each PR, run checks appropriate to its changed workspace plus the
repository-required CI checks. Validate workflow syntax with actionlint, shell
scripts with ShellCheck where applicable, and Compose configuration before
running managed stacks. Changes to gate/filter/report logic require tests of
failure, cancellation, missing inputs and unexpected skips. Production-image
changes require runtime smoke and vulnerability scans, not just successful builds.

- [ ] Baseline timings, test/check inventory and runner capacity recorded.
- [ ] Existing gates preserved and identified enforcement gaps closed.
- [ ] Required rules reference observed, stable check names.
- [ ] Stage-specific negative tests demonstrate publication is blocked.
- [ ] Cold and warm runs pass for PR, main, tag and manual-candidate paths.
- [ ] Artifact SHA/digest identity and frontend build variants verified.
- [ ] Security reports/SBOMs remain complete and attributable.
- [ ] Managed recovery and required chaos/conflict scenarios remain green.
- [ ] Filter decisions tested before conditional execution is enabled.
- [ ] Each stage has a measured report and executable rollback procedure.
- [ ] Final operational documentation identifies workflow owners, cache scopes,
      required checks, security exception process and artifact promotion behavior.

Implementation completion does not depend on achieving an arbitrary minute
target by omitting checks. It requires measured improvement with equal or stronger
validation and a documented explanation of any added enforcement cost.
