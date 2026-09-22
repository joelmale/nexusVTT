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
