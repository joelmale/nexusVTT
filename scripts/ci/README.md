# GitHub Actions timing report

`report-actions-timing.mjs` is a read-only GitHub API client for the CI/CD
optimization baseline. It collects a run, every job attempt and step timestamp,
artifacts, the workflow file blob revision, and overlapping runs in the same
repository. It performs only HTTP `GET` requests.

Run it from the repository root. JSON goes to stdout and the human summary goes
to stderr by default, so the report can be redirected without mixing formats:

```powershell
$env:GH_TOKEN = gh auth token
npm run report:ci-timing -- --repo joelmale/nexusVTT --run 35782127808 `
  --validation-job validation-gate > run-35782127808.json
```

Use `--output run-35782127808.json` to write the JSON directly and print the
summary to stdout. `GITHUB_REPOSITORY` can replace `--repo`, and
`GITHUB_TOKEN` is used when `GH_TOKEN` is absent. A public repository can be
read without a token subject to GitHub's anonymous rate limit.

GitHub does not expose dependency edges in the run jobs endpoint. To measure
the delay between prerequisites completing and a dependent job starting, pass
a JSON dependency map:

```json
{
  "validation-gate": ["lint-and-type", "unit-tests"],
  "publish": ["validation-gate"]
}
```

```powershell
npm run report:ci-timing -- --run 35782127808 `
  --dependency-map dependencies.json --output run-35782127808.json
```

Job names must match the API names. A gate or publication name also matches its
matrix-expanded `Name (...)` jobs.

## Operator-supplied dimensions

The run API cannot determine affected workspaces, cache hits, coverage, test
counts, SBOM identity, image digests, cache storage, or configured/account
runner concurrency. Supply measurements from the corresponding artifacts and
settings with `--metadata`. Unsupported and malformed fields fail closed.

```json
{
  "affectedWorkspaces": ["apps/vtt"],
  "cacheNamespace": "stage-1-warm-main",
  "cacheState": { "npm": "hit", "buildkit": "hit" },
  "cacheStorageBytes": 104857600,
  "changeClass": "vtt-only",
  "coverage": {
    "lines": 54.2,
    "functions": 53.1,
    "branches": 44.0,
    "statements": 54.0
  },
  "imageDigests": { "vtt": "sha256:..." },
  "notes": ["controlled warm run"],
  "rerunSourceShaType": "branch",
  "runnerConcurrency": {
    "configured": 4,
    "account": 20,
    "notes": "captured from repository and account settings"
  },
  "sarifCategories": ["codeql-security-extended", "trivy-filesystem"],
  "sboms": [{ "name": "vtt.cdx.json", "sourceSha": "..." }],
  "testCounts": { "discovered": 1200, "executed": 1200, "passed": 1200 },
  "validationJob": "validation-gate",
  "publicationJob": "publish"
}
```

`observedRunnerMinutes` is the sum of job execution seconds divided by 60. It
is an observed utilization measure, not GitHub's billed usage. Same-repository
overlap uses a 24-hour lookback and is reported separately; organization-wide
overlap is deliberately `null` because it is not available from the run API.
The JSON lists every unavailable dimension and its required source rather than
guessing a value.

Run the focused tests with:

```powershell
npm run test:ci-report
```

# Release promotion policy

Delivery requires a successful `CI Pipeline` run for the exact source SHA. It
then builds affected images once under immutable full-SHA tags and makes the
reusable security workflow pull those exact registry artifacts for Trivy,
Grype, CycloneDX, source-label, digest, run-attempt, and release-frontend
variant validation. Only successfully scanned digests can reach mutable release
aliases. Push delivery
accepts only `push` validation evidence. Manual candidates accept only a prior
full `workflow_dispatch` validation; run CI manually with the same optional
`source_sha` on `main` before dispatching delivery. Manual candidates are
restricted to the current main commit so GitHub's run metadata and the checked
out source have the same identity. `release-validation-evidence.mjs`
polls while a concurrently started validation is still running and fails closed
on missing, malformed, or unsuccessful evidence.

`release-promotion.mjs` checks a push source against remote `main` immediately
before publishing mutable release tags. If a newer push has superseded the run,
promotion is recorded as `superseded` and registry writes and release-manifest
upload are skipped. Manual delivery publishes only
`candidate-<full-source-sha>` and never updates `latest`, dated release aliases,
or GitHub Pages.

The delivery gate checks validation, security, eligibility, and publication
outcomes. A skipped promotion succeeds only for a superseded main run or an
immutable manual candidate. Compose continues to consume `latest`; stale and
candidate runs cannot replace it.

For documentation changes, the main-branch CI run packages the already
type-checked and built site as its `github-pages` artifact. Delivery downloads
that artifact by the exact validation run ID, re-stages the same payload in the
trusted delivery run, and deploys it without another documentation build.
Manual candidate delivery never deploys Pages.

`image-provenance.mjs` writes the per-image companion manifest uploaded with
each SBOM. It rejects a wrong or missing source revision, malformed digest,
unsupported transport, malformed run identity, and a release frontend whose
`org.nexusvtt.frontend.delta-sync` label is not `false`. PR security retains its
unprivileged local-daemon build path and uploads the same provenance shape
without writing to the registry.

```powershell
npx vitest run --config scripts/ci/release-promotion.vitest.config.mjs --coverage
```

# Gateway route matrix

`gateway-route-matrix.sh` runs the real `apps/vtt/docker/nginx.conf` in the
nginx image that `apps/vtt/docker/frontend.Dockerfile`'s production stage uses,
beside stub `backend`, `doc-api`, `asset-server` and `doc-websocket` upstreams
that report which upstream answered. It then replays requests against both
gateway listeners from a client container on the same Docker network:

- `:80`, the public gateway: the Phase 0 admin denials with path, encoding,
  case, `;` and method variations; the `/codex-api` read allowlist with and
  without a session; and `Host: admin.internal.nexusvtt.com`, which must get
  ordinary public behavior.
- `:8081`, the private admin listener: only the placeholder, its stylesheet
  and `/healthz` answer; everything else is `404` (or `405` for non-GET/HEAD);
  the strict security headers are exact on every response; and no stub
  upstream is ever contacted.

The policy is defined in
`apps/docs/platform/private-admin-control-plane.md`. It needs only Docker,
publishes no host port, and removes its containers and network on exit. CI runs
it as `VTT: gateway route matrix`.

```bash
bash scripts/ci/gateway-route-matrix.sh
# Try another nginx build:
GATEWAY_IMAGE=nginx:1.31-alpine bash scripts/ci/gateway-route-matrix.sh
```

It works from Git Bash on Windows as well; allow a few minutes there, because
each probe is a separate `docker exec`.
