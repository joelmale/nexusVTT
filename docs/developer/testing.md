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
  by an immediate backend `SIGKILL` after a game-state ACK, exact PostgreSQL
  snapshot recovery, one-at-a-time replica restarts, and ordered journal
  catch-up;
- concurrent host/co-host state edits where PostgreSQL accepts one
  token/version compare-and-swap and the loser rebases from the authoritative
  snapshot without duplicating events;
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

For repository-level transaction coverage with a real database, run:

```bash
docker compose -p nexus-vtt-db-test -f docker/docker-compose.test.yml up \
  --build --abort-on-container-exit --exit-code-from test
docker compose -p nexus-vtt-db-test -f docker/docker-compose.test.yml down \
  --volumes --remove-orphans
```

## Multiplayer load and soak tests

Use `npm run test:soak` against an existing target, or let the repository own
an isolated two-replica stack:

```bash
npm run test:soak:managed -- \
  --rooms 10 \
  --clients-per-room 4 \
  --duration 10m \
  --events-per-second 20
```

The harness creates a distinct guest/session cookie per virtual client and
mixes chat, server-authoritative dice, scene changes, versioned token moves,
and canonical state patches. It deliberately verifies a stale delta base and a
cross-replica entity-version conflict before load. During the run it reconnects
players with their original identity and event cursor. At quiescence it checks
each client's logical event set, ordered cursor, and canonical state hash.

Run the complete resilience profile with:

```bash
npm run test:soak:chaos -- \
  --rooms 50 \
  --clients-per-room 4 \
  --duration 2h \
  --events-per-second 100
```

This adds abrupt rolling backend restarts, a Redis interruption, and
Toxiproxy-based PostgreSQL latency. The test fails for lost logical events,
duplicate deliveries, ordering or hash errors, convergence failures, durable
database/journal failures, or breached ACK/reconnect percentiles. The JSON
report is written under `test-results/`.

The nightly workflow is `.github/workflows/multiplayer-soak.yml`. The protected
staging workflow applies all multiplayer migrations and runs a four-hour
50-room profile; see
`docs/operations/multiplayer-observability.md` for environment configuration,
SLOs, and alert response.
