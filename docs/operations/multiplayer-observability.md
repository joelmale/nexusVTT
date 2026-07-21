# Multiplayer Reliability Operations

This runbook covers the durability metrics, service-level objectives, alert
rules, load profiles, and fault-injection workflows for Nexus VTT multiplayer.
PostgreSQL is the serialization and recovery authority. Redis remains an
ephemeral fanout, presence, and host-lease layer.

## Reliability contract

- A game-state ACK means `(gameState, syncToken, stateVersion)` committed in
  PostgreSQL.
- A durable event ACK means its idempotent envelope and room sequence committed
  to `room_events`.
- Versioned token and prop events compare-and-swap `room_entity_versions` in
  the same transaction as the journal append. This prevents two replicas from
  accepting the same expected version.
- Reconnects preserve the guest/authenticated identity, restore the canonical
  snapshot, replay the ordered journal after the client cursor, and retry only
  unconfirmed event IDs.
- A completed soak must report zero lost logical events, zero duplicate event
  deliveries, zero ordering/integrity errors, and one final state hash per room.

## Endpoints

| Endpoint                      | Format          | Purpose                                                                   |
| ----------------------------- | --------------- | ------------------------------------------------------------------------- |
| `/metrics`                    | Prometheus text | Counters, gauges, and the durable-commit latency histogram                |
| `/api/metrics/multiplayer`    | JSON            | Combined process, pool, queue, sync, ordering, realtime, and SLO snapshot |
| `/api/system/health`          | JSON            | Backend database and realtime-coordinator readiness                       |
| `/api/metrics/delta-sync`     | JSON            | Detailed commit modes, resync reasons, and patch savings                  |
| `/api/metrics/ordered-events` | JSON            | Journal commits, duplicates, failures, replays, and version conflicts     |
| `/api/metrics/realtime`       | JSON            | Redis connectivity, fanout, gap repair, and host-lease health             |

Set `METRICS_AUTH_TOKEN` to require `Authorization: Bearer <token>` on
`/metrics`. The `/api/metrics/*` routes are application diagnostics and should
be restricted at the reverse proxy in public deployments. The supplied nginx
configuration does not expose the backend `/metrics` route through the
frontend, so the Compose scraper reaches it on the internal network.

## SLOs

The JSON endpoint evaluates process-lifetime health using these defaults. The
Prometheus rules use rolling windows so old failures do not keep an alert open.

| Objective                   |                Default | Environment override                     |
| --------------------------- | ---------------------: | ---------------------------------------- |
| Durable commit p95          |                 250 ms | `MULTIPLAYER_SLO_COMMIT_P95_MS`          |
| Resync rate                 |             at most 1% | `MULTIPLAYER_SLO_RESYNC_RATE_RATIO`      |
| Rooms with queued commits   |            at most 100 | `MULTIPLAYER_SLO_QUEUE_DEPTH`            |
| JavaScript heap utilization |            at most 90% | `MULTIPLAYER_SLO_HEAP_UTILIZATION_RATIO` |
| Durable commit failures     |                   zero | fixed invariant                          |
| Ordered-event failures      |                   zero | fixed invariant                          |
| Realtime publish failures   |                   zero | fixed invariant                          |
| Redis coordination          | connected when enabled | fixed invariant                          |

The soak runner separately enforces event ACK p95 (default 1 second), reconnect
p95 (default 10 seconds), final convergence, and exact logical event accounting.
Use stricter thresholds only after measuring the target environment; do not
relax a threshold to conceal a regression.

## Prometheus, Grafana, and OpenTelemetry

Start the production stack with the optional monitoring overlay:

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.observability.yml \
  up -d
```

This starts Prometheus with `monitoring/alerts/nexus-vtt.yml` and provisions
Grafana's Prometheus data source. Route Grafana through the existing external
proxy network and set a strong `GRAFANA_ADMIN_PASSWORD`. Connect Prometheus to
your Alertmanager or hosted notification service to deliver the loaded alert
rules; Prometheus still evaluates and displays them without a notifier.

To forward the same metrics through an OpenTelemetry Collector, set an
HTTPS OTLP/gRPC `OTEL_EXPORTER_OTLP_ENDPOINT` and enable the profile:

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.observability.yml \
  --profile otel up -d otel-collector
```

For Docker Swarm with DNS round-robin, replace the static `backend:5001`
Prometheus target with a `dns_sd_configs` entry for `tasks.backend` so every
replica is scraped independently. Keep a stable `BACKEND_INSTANCE_ID` per
replica and aggregate counters with `sum without(instance)` only when the query
calls for a fleet total.

## Alert response

- `NexusVttDurableCommitFailure` or `NexusVttOrderedEventFailure`: stop rollout,
  retain PostgreSQL/backend logs, and verify pool saturation and database
  errors. Never ACK/retry around a failed transaction in server code.
- `NexusVttDurableCommitLatencyHigh` or `NexusVttDatabasePoolWaiting`: inspect
  query latency, locks, pool waiters, and commit queue depth. Reduce admission
  load before raising pool size.
- `NexusVttResyncRateHigh`: group resyncs by reason. Any
  `integrity-mismatch` is a release blocker; `base-mismatch` spikes usually
  indicate reconnect storms or conflicting writers.
- `NexusVttRealtimeDisconnected` or `NexusVttRealtimePublishFailure`: restore
  Redis, then confirm `journalCatchUps` increases and all active rooms converge.
  Acknowledged PostgreSQL state remains durable during this outage.
- `NexusVttHeapUtilizationHigh`: capture heap/process metrics and room/client
  counts. Check that commit/publish queues drain after load falls.

## Local managed soak

The default harness targets an already-running stack:

```bash
npm run test:soak -- \
  --base-url http://127.0.0.1:4173 \
  --rooms 50 \
  --clients-per-room 4 \
  --duration 2h \
  --events-per-second 100
```

The managed runner builds an isolated two-backend stack, spreads clients
between both backend ports, writes a JSON report, and tears the stack down:

```bash
npm run test:soak:managed -- \
  --rooms 50 \
  --clients-per-room 4 \
  --duration 2h \
  --events-per-second 100
```

Add deterministic failure injection with:

```bash
npm run test:soak:chaos -- \
  --rooms 50 \
  --clients-per-room 4 \
  --duration 2h \
  --events-per-second 100
```

Chaos mode performs abrupt rolling restarts of both backend containers, stops
and restores Redis, then adds downstream PostgreSQL latency through the pinned
Toxiproxy sidecar. Tune only the schedule—not the assertions—with:

- `SOAK_CHAOS_WARMUP_MS`
- `SOAK_CHAOS_OUTAGE_MS`
- `SOAK_CHAOS_LATENCY_DURATION_MS`
- `SOAK_POSTGRES_LATENCY_MS`
- `SOAK_KEEP_STACK=1` for post-run inspection

The runner refuses more than 1,000 clients unless `--allow-large` is explicit.
Reports default to `test-results/multiplayer-soak-report.json` and include
latency percentiles, operation totals, reconnects, expected conflicts, server
metric deltas, and concrete convergence failures.

## CI and staging

`.github/workflows/multiplayer-soak.yml` runs the managed chaos profile nightly
and accepts manual sizing inputs. It uploads the report and, on failure, the
named Compose stack logs.

`.github/workflows/staging-multiplayer-soak.yml` is intentionally manual and
protected by the `staging` GitHub environment. Configure:

- environment variable `STAGING_BASE_URL`;
- optional `STAGING_BACKEND_URLS` as comma-separated direct backend URLs;
- secret `STAGING_DATABASE_URL` for migration execution;
- optional secret `STAGING_METRICS_TOKEN`.

The workflow applies these idempotent migrations in order before load:

1. `2026-01-05-add-campaign-roomcode.sql`
2. `2026-07-19-add-room-event-journal.sql`
3. `2026-07-19-add-durable-game-state-commits.sql`
4. `2026-07-19-add-room-entity-versions.sql`

The default staging profile is 50 rooms, 4 clients per room, 100 aggregate
operations per second, and four hours. Increase to 100 rooms/8 clients only
after the 50-room profile meets SLOs. Fault injection remains in the isolated
managed-stack workflow unless the staging platform provides an explicitly
approved chaos control plane; do not embed infrastructure credentials or
production service names in the test harness.

Before promoting a build, retain the JSON report, confirm every SLO/alert has
returned to healthy after recovery, and compare process memory and database
pool waiters at the beginning and end of the run.
