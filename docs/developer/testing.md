# Testing Nexus VTT

Nexus VTT uses Vitest for unit and integration coverage and Playwright for
production-like browser smoke tests.

## Fast feedback

```bash
npm run lint
npm run type-check
npm run test:unit
npm run test:asset-service
npm run test:integration
```

The ordinary Vitest integration command skips database cases when PostgreSQL
is unavailable. CI also runs those cases in the dedicated Docker integration
stack.

## End-to-end smoke tests

Install Chromium once after `npm install`:

```bash
npm run test:e2e:install
```

Run the managed smoke suite:

```bash
npm run test:e2e
```

This command builds and starts an isolated production stack from
`docker/docker-compose.smoke.yml`, runs Playwright, and removes the test
containers, network, and temporary PostgreSQL data afterward. It does not use
developer OAuth credentials or the development database.

The suite verifies:

- frontend, two backend replicas, PostgreSQL, and Redis health;
- guest session cookie round-tripping;
- every dice theme config and referenced runtime file, including Ammo WASM;
- production service-worker caching and an offline shell reload;
- guest DM room creation and an animated 3D dice roll;
- WebSocket recovery when the backend remains unavailable through the first
  reconnect attempt;
- cross-replica chat, dice, scene, initiative, and token convergence, followed
  by one-at-a-time backend restarts and ordered journal catch-up;
- lobby availability and API recovery during an asset-service outage.

Failures retain screenshots, video, traces, and browser/network diagnostics in
`test-results/e2e/` and `playwright-report/`.

## Debugging smoke tests

Use a visible browser:

```bash
npm run test:e2e:headed
```

To inspect a running smoke stack after a test, set `E2E_KEEP_STACK=1` before
the command. Remove it afterward with:

```bash
docker compose -p nexus-vtt-e2e -f docker/docker-compose.smoke.yml down --volumes
```

`npm run test:e2e:local` runs Playwright against an already-running target.
Override `E2E_BASE_URL`, `E2E_BACKEND_URL`, `E2E_BACKEND_PEER_URL`, and
`E2E_ASSET_URL` when that target is not using the default smoke ports (`4173`,
`15001`, `15002`, and `15003`). Service restart scenarios are skipped unless
the managed stack is active.

## CI behavior

The GitHub Actions smoke job installs only Chromium, uses one worker for
deterministic service restarts, retries a failed test once, and uploads the
Playwright report whether the suite passes or fails.
