---
title: Observability runbook
---

# Observability runbook

Phase 3 of the [private admin control plane
plan](/platform/private-admin-control-plane) deploys Prometheus and Grafana on
internal networks, adds PostgreSQL/Redis/host/container measurements,
instruments Codex's `doc-api` and `doc-processor`, and inventories which Codex
health-page values are still placeholders. This page is the deployment and
operator reference for that stack. See also
[Multiplayer reliability operations](/vtt/operations/multiplayer-observability)
for the VTT backend's own metrics, SLOs, and alert-response table -- this page
does not repeat that content.

## Deployment model

The monitoring stack is its own Dockhand stack, `nexus-monitoring`, defined by
[`deploy/homelab/compose.monitoring.yaml`](https://github.com/joelmale/nexusVTT/blob/main/deploy/homelab/compose.monitoring.yaml).
It is deliberately **not** part of the `nexus-vtt2` stack:

- it can be deployed, rolled back, or torn down without touching the
  application stack;
- Prometheus/Grafana version upgrades are a separate, lower-risk change; and
- it reaches `nexus-vtt2`'s database, cache, and application containers as a
  consumer, over an **external** Docker network, rather than by being folded
  into that stack's compose graph.

```text
nexus-vtt2 stack (compose.yaml + compose.vtt.yaml + compose.codex.yaml)
  nexus-internal-net (internal: true)  <-- created here, namespaced by
                                            Compose as nexus-vtt2_nexus-internal-net
       ^
       | external network reference
       |
nexus-monitoring stack (compose.monitoring.yaml)
  prometheus, grafana ------------------ also join nexus-vtt2_nexus-internal-net
  postgres_exporter, redis_exporter ---- join nexus-vtt2_nexus-internal-net only
                                          (to resolve postgres/redis)
  cadvisor, node_exporter, alertmanager - join monitoring-internal only
                                          (host/queue-internal, no reason to
                                          reach VTT/Codex services)
```

`nexus-vtt2_nexus-internal-net` is `internal: true` at the point it is
defined in `nexus-vtt2`'s own compose files, which is what makes it safe: it
has no route to the internet, so attaching Prometheus to it does not create a
new path out of the private database/cache tier. Deploy `nexus-vtt2` (or at
least its network) before `nexus-monitoring`, since the external network must
already exist.

Grafana is reachable as `grafana:3000` on that same network so a future
private-gateway route (Phase 2, `admin.internal.nexusvtt.com`) can proxy to
it. **No gateway route exists yet** -- that is a Phase 2 follow-up, not part
of this change. Until it exists, reach Grafana with `docker exec` or a
temporary port-forward from the HomePod host; do not publish a host port on
the `grafana` service to work around this.

### Render/validate only

```bash
docker compose --env-file deploy/homelab/.env.example \
  -f deploy/homelab/compose.monitoring.yaml config --quiet
```

This does not start containers, pull images, or contact production, matching
the existing pattern for `compose.yaml`/`compose.rehearsal.yaml`. Use a
scratch env file outside the repository for any values you don't want the
`.env.example` placeholders for.

### Deploy

1. Confirm the `nexus-vtt2` stack (and therefore
   `nexus-vtt2_nexus-internal-net`) is already deployed.
2. Populate the required secrets below in the `nexus-monitoring` Dockhand
   stack's environment (its own encrypted store, separate from `nexus-vtt2`'s).
3. Create the `NEXUS_MONITORING_SECRETS_ROOT` directory on the host with the
   two bearer-token files described below.
4. Deploy `nexus-monitoring` (equivalent to
   `docker compose -f deploy/homelab/compose.monitoring.yaml up -d`).
5. Confirm Prometheus targets: exec into the `prometheus` container and check
   `wget -qO- http://localhost:9090/api/v1/targets` (no host port is
   published). Expect `nexus-vtt-backend`, `postgres-exporter`,
   `redis-exporter`, `cadvisor`, and `node-exporter` to go healthy quickly;
   `codex-doc-api`, `codex-doc-processor`, and `asset-service` may stay down
   until their follow-ups below land.
6. Confirm Grafana provisioned its datasource and the seven `Nexus *`
   dashboards under the "Nexus" folder (`GET /api/search`,
   `GET /api/datasources`, authenticated).

### Rollback

Stop or remove the `nexus-monitoring` stack; it holds no data the application
depends on. Prometheus and Grafana's named volumes
(`nexus-monitoring-prometheus-data`, `nexus-monitoring-grafana-data`,
`nexus-monitoring-alertmanager-data`) persist across a stack removal unless
you explicitly delete them -- do not use `down -v` unless you intend to lose
history and Grafana's saved state (annotations, any manually-added panels).

## Required secrets

All of these belong to the `nexus-monitoring` stack's own environment, not
`nexus-vtt2`'s -- Dockhand stacks each keep a separate encrypted store, so
sharing a value (like the Redis password) means copying it into both.

| Variable | Used by | Notes |
| --- | --- | --- |
| `GRAFANA_ADMIN_PASSWORD` | `grafana` | Required (`GF_SECURITY_ADMIN_PASSWORD`). A file-backed `GF_SECURITY_ADMIN_PASSWORD__FILE` is an equally valid alternative if your deployment target prefers mounted secret files instead of Dockhand's encrypted env vars; this repo uses the required-variable form to match every other file under `deploy/homelab`. |
| `POSTGRES_EXPORTER_DSN` | `postgres_exporter` | Connection string for the least-privilege `nexus_monitor` role (see below), e.g. `postgresql://nexus_monitor:<password>@postgres:5432/nexus?sslmode=disable`. |
| `REDIS_EXPORTER_PASSWORD` | `redis_exporter` | Same value as `nexus-vtt2`'s `REDIS_PASSWORD`. |
| `NEXUS_MONITORING_SECRETS_ROOT` | `prometheus` | Host directory bind-mounted read-only into the Prometheus container at `/etc/prometheus/secrets`. Must contain `metrics_token` and `codex_metrics_token` (below). Never commit this directory or its contents. |
| `ALERTMANAGER_WEBHOOK_URL` | `alertmanager` (only under the `alerting` Compose profile) | A generic incoming-webhook URL (Slack, Discord, Opsgenie, ntfy, etc.). Alertmanager only starts when this profile is enabled -- see "Alerting" below. |
| `PROMETHEUS_RETENTION` | `prometheus` | Optional, defaults to `30d`. |
| `GRAFANA_ADMIN_USER` | `grafana` | Optional, defaults to `admin`. |

`NEXUS_MONITORING_SECRETS_ROOT` must contain, at minimum:

```text
metrics_token          # bearer token matching nexus-vtt2's METRICS_AUTH_TOKEN
codex_metrics_token    # bearer token matching doc-api/doc-processor's METRICS_AUTH_TOKEN
```

Each file holds the raw token with no trailing newline expected by the
consumer beyond what `credentials_file` tolerates (a trailing newline is
fine; Prometheus trims it). These are plain files on the host filesystem, the
same operational shape as any other bind-mounted homelab secret in this
repository -- never commit them.

### `pg_monitor` role

`postgres_exporter` must **not** use the application's `nexus` Postgres role.
Create a dedicated, read-only monitoring role once, from `psql` against the
shared Postgres instance:

```sql
CREATE ROLE nexus_monitor WITH LOGIN PASSWORD '<pick-a-strong-password>' CONNECTION LIMIT 5;
GRANT pg_monitor TO nexus_monitor;
GRANT CONNECT ON DATABASE nexus TO nexus_monitor;
GRANT CONNECT ON DATABASE doclib TO nexus_monitor;
```

`pg_monitor` is a built-in PostgreSQL role that grants `SELECT` on the
monitoring views the default `postgres_exporter` collectors and the custom
`monitoring/postgres-exporter/queries.yaml` queries need
(`pg_stat_activity`, `pg_locks`, `pg_stat_database`, replication and I/O
stats) without granting write access to any table. Put the resulting
connection string together as `POSTGRES_EXPORTER_DSN` above.

## Custom PostgreSQL measurements

The default `postgres_exporter` collector set does not expose long-running
queries or blocked lock waiters. `monitoring/postgres-exporter/queries.yaml`
adds two gauges via `--extend.query-path`:

- `pg_long_running_queries_count` -- backends running a query longer than 5
  minutes;
- `pg_blocked_locks_count` -- distinct backends currently blocked waiting on
  a lock held by another backend.

Both back alerts in `monitoring/alerts/nexus-platform.yml`.

## Alerting

Alertmanager is included but **optional**, gated behind the `alerting`
Compose profile so a fresh deployment with no notification channel picked
yet does not crash-loop (Alertmanager refuses to start with an empty webhook
URL). To enable it:

1. Pick a generic incoming-webhook URL (Slack "Incoming Webhooks", Discord's
   webhook-compatible endpoint, ntfy, Opsgenie, etc.).
2. Set `ALERTMANAGER_WEBHOOK_URL` in the `nexus-monitoring` stack's
   environment.
3. Deploy with the `alerting` profile enabled (Dockhand: enable the service;
   CLI: `docker compose --profile alerting -f deploy/homelab/compose.monitoring.yaml up -d`).

Alertmanager's own config format has no environment-variable expansion, so
`monitoring/alertmanager/alertmanager.yml.template` is substituted at
container start by the `alertmanager` service's `command` (a `sed` pass,
since the upstream image ships BusyBox `sh`/`sed` but not `envsubst`) before
the real binary starts, writing the result to its persistent volume.

**Follow-up if you skip this**: until `alerting` is enabled, Prometheus still
evaluates and displays every alert rule (visible in its own UI/API); it just
has nowhere to deliver them. Treat "no notification channel configured" as an
explicit, tracked gap, not a silent one.

## Codex metrics wiring (required follow-up)

`apps/codex/services/doc-api` now exposes `GET /metrics`
(`apps/codex/services/doc-api/src/observability/metrics.ts`, registered from
`src/server.ts`), and `apps/codex/services/doc-processor` can expose one too
(`apps/codex/services/doc-processor/src/metrics-server.ts`) once configured.
Both follow the same bearer-token pattern as the VTT backend
(`METRICS_AUTH_TOKEN`, enforced only when set, so local dev stays open by
default).

**This phase intentionally does not edit `deploy/homelab/compose.codex.yaml`**
(that file belongs to whichever engineer next touches the Codex deploy
surface, to avoid an out-of-scope conflict). Before the Prometheus scrape
config's `codex-doc-api` and `codex-doc-processor` jobs will do anything
useful, that file needs:

```yaml
doc-api:
  environment:
    # ...existing keys...
    METRICS_AUTH_TOKEN: ${CODEX_METRICS_AUTH_TOKEN:?CODEX_METRICS_AUTH_TOKEN is required}

doc-processor:
  environment:
    # ...existing keys...
    METRICS_PORT: 9464
    METRICS_AUTH_TOKEN: ${CODEX_METRICS_AUTH_TOKEN:?CODEX_METRICS_AUTH_TOKEN is required}
```

`doc-processor` does not need a `ports:` publish for this -- Prometheus
reaches it by container DNS name on `nexus-internal-net`, the same way it
already reaches `postgres`/`redis`. Until that wiring lands:

- `doc-api`'s `/metrics` is reachable, unauthenticated, from any container on
  `nexus-internal-net` (not the internet -- that boundary is unaffected).
  Treat this the same as any other pre-Phase-0-style gap and prioritize the
  `METRICS_AUTH_TOKEN` wiring accordingly.
- `doc-processor` has no metrics endpoint at all yet, so its Prometheus
  target and every `codex_doc_processor_*` panel/alert will show as
  down/no-data. This is expected and not a bug in this change.

## Dashboard ownership

All seven dashboards live under the "Nexus" folder in Grafana, provisioned
from `monitoring/grafana/provisioning/dashboards/*.json`
(`allowUiUpdates: false` -- edit the JSON and redeploy, not the Grafana UI, so
changes survive a redeploy).

| Dashboard | Owner | Primary source |
| --- | --- | --- |
| Nexus Overview | Platform/on-call | Aggregates the others; start here during an incident. |
| Nexus User Load | VTT backend team | `nexus_vtt_*` room/connection/commit counters. |
| Nexus Multiplayer | VTT backend team | Durability SLOs; mirrors the multiplayer-observability runbook. |
| Nexus Persistence | Platform/on-call | `postgres_exporter`, `redis_exporter`, VTT pool gauges. |
| Nexus Codex | Codex team | `codex_doc_api_*` / `codex_doc_processor_*` (see wiring note above). |
| Nexus Assets | Phase 5 owner | `asset_*` metric names (see contract below); no data until Phase 5 instruments them. |
| Nexus Infrastructure | Platform/on-call | `cadvisor`/`node_exporter` container and host metrics. |

### Asset-service metric contract (for Phase 5)

The Assets dashboard and the `asset-service` Prometheus job are placeholders
referencing an agreed-on, not-yet-implemented contract. When
`apps/vtt/services/asset-service` adds `GET /metrics`, it should expose at
least:

- `asset_objects_total` (gauge) -- total tracked asset objects;
- `asset_bytes_total` (gauge) -- total bytes across tracked assets;
- `asset_derivative_failures_total` (counter) -- failed derivative
  (thumbnail/webp/etc.) generations;
- `asset_manifest_age_seconds` (gauge) -- time since the manifest was last
  rebuilt; and
- `asset_missing_files` (gauge) -- manifest entries whose backing file is
  absent.

Use the same `METRICS_AUTH_TOKEN`-gated pattern as the VTT backend and
doc-api once implemented, and update
`monitoring/prometheus.homelab.yml`/this table if the final names differ.

## Codex Admin Health page placeholder inventory

`apps/codex/services/admin-ui/src/pages/Health.tsx` (owned by the Phase 2/
Admin UI engineer; not edited by this change) renders values from
`GET /api/admin/health` and `GET /api/admin/metrics/*`, which are served by
`apps/codex/services/doc-api/src/services/health.service.ts` and
`metrics.service.ts`. The following displayed values are **not real
telemetry** and must not be treated as production signal until replaced:

| Health/metrics page field | Current source | Real replacement |
| --- | --- | --- |
| API "Requests/min", "Avg Response Time", "Error Rate", "Active Connections" | `HealthService.collectApiMetrics()` returns hardcoded zeros | `rate(codex_doc_api_http_requests_total[5m])`, `histogram_quantile(..., codex_doc_api_http_request_duration_seconds_bucket)`, the 5xx-rate query from the Codex dashboard, and `codex_doc_api_http_requests_in_flight` (this change's new metrics). |
| Database "Query Count", "Slow Queries", "Pool Usage" | Hardcoded zeros in `collectDatabaseMetrics()` | `connections` in the same function IS real (a live `pg_stat_activity` count); the other three need either `pg_stat_statements` or the `postgres_exporter`/`pg_long_running_queries_count` metrics this change adds. |
| Queue "Completed", "Failed" | `collectQueueMetrics()` calls `redis.get('bull:document-processing:completed')` / `...:failed`, which are not the keys BullMQ uses (BullMQ tracks completed/failed jobs as sorted sets, not GET-able strings) -- these always read back `null` -> `0` | `codex_doc_processor_jobs_total{outcome="completed"\|"failed"}` (this change's new counter) or `Queue.getJobCounts()` as `queue.service.ts`'s own `getQueueStats()` already does correctly elsewhere in doc-api. |
| Queue "Throughput" | Hardcoded zero | Derivable from `rate(codex_doc_processor_jobs_total[5m])`. |
| Storage "Total Size", "Used Size", "File Count", "Upload Rate" | All hardcoded zeros in `collectStorageMetrics()` (comment: "no listObjects method") | Needs either an S3/MinIO bucket-stats call or a Postgres aggregate over `Document.fileSize`; out of scope for this change. |
| Search "Query Count", "Avg Query Time" | Hardcoded zeros in `collectSearchMetrics()` | `codex_doc_api_elasticsearch_search_duration_seconds` (this change's new histogram) gives both count and latency. |
| Search "Index Size", "Documents" | Real (`elasticClient.indices.stats()`) | No change needed. |

This inventory does not change `Health.tsx`, `health.service.ts`, or
`metrics.service.ts` -- swapping the Admin UI over to real metrics (ideally by
querying Prometheus/Grafana rather than re-deriving the same numbers a second
time, per the "Prometheus and Grafana remain the operational telemetry
source" invariant) is separate, scoped work for whoever owns that surface
next.

## Health semantics

Per the control-plane plan: liveness stays cheap and dependency-free,
readiness checks only what is required to serve traffic, and detailed
dependency health is authenticated and private. This phase does not change
any existing liveness/readiness endpoint; it only adds `/metrics` (a
measurement surface, not a health surface) to `doc-api` and, optionally,
`doc-processor`.

## Retention and backup

- **Prometheus**: 30 days by default (`PROMETHEUS_RETENTION`), stored in the
  `nexus-monitoring-prometheus-data` named volume. Prometheus's TSDB is not
  a point-in-time-recoverable database in the way Postgres is; back it up by
  snapshotting the volume (or accept that a lost volume only costs recent
  history, not correctness of the running system).
- **Grafana**: dashboards are provisioned from Git (this repository) and
  reprovision automatically on redeploy; the only state worth backing up in
  `nexus-monitoring-grafana-data` is anything created through the UI
  (ad hoc panels, annotations, alert silences) that was never intended to be
  provisioned. Prefer committing anything durable as a provisioned JSON file
  instead of relying on the volume.
- **Alertmanager**: `nexus-monitoring-alertmanager-data` holds only
  in-flight notification/silence state, not history worth restoring.

Back up all three volumes the same way you back up any other named Docker
volume on the HomePod host; there is no additional Phase-3-specific backup
mechanism.

## Alert response

This table covers the alerts added by this phase
(`monitoring/alerts/nexus-platform.yml`). See
[Multiplayer reliability operations](/vtt/operations/multiplayer-observability#alert-response)
for the existing `NexusVtt*` multiplayer alerts.

| Alert | Response |
| --- | --- |
| `NexusPlatformTargetDown` | Check whether the target container is running and on the expected network before assuming an application bug; a stopped container is the most common cause. |
| `NexusPlatformPostgresDown` | Treat as a full outage for both VTT and Codex; check `postgres` container health and logs first. |
| `NexusPlatformPostgresConnectionsNearMax` | Identify the noisiest connecting service (VTT backend vs. doc-api) before raising `max_connections`; a leak is more likely than genuine load. |
| `NexusPlatformPostgresLongRunningQueries` / `NexusPlatformPostgresBlockedLocks` | Inspect `pg_stat_activity`/`pg_locks` directly; do not kill backends without understanding what they are blocking. |
| `NexusPlatformRedisDown` | The VTT backend already has its own `NexusVttRealtimeDisconnected` alert for this; this one covers the exporter/Redis pair generally, including Codex's BullMQ queues. |
| `NexusPlatformRedisMemoryHigh` / `NexusPlatformRedisEvictions` | Check `maxmemory`/`maxmemory-policy`; evictions on the VTT's db 0 vs. Codex's db 1 have different blast radii (session/presence data vs. job queues). |
| `NexusPlatformContainerRestarting` / `NexusPlatformContainerOOMKilled` | Check the named container's logs and, for OOM, whether it needs a `deploy.resources.limits` adjustment (Elasticsearch already has one). |
| `NexusPlatformHostDiskHigh` | Check the NAS mount (`NEXUS_STORAGE_ROOT`) and Docker's own image/volume disk usage before assuming it's application data growth. |
| `NexusPlatformDocApiErrorRateHigh` / `NexusPlatformDocApiLatencyHigh` | Correlate with the Nexus Codex dashboard's per-route breakdown; check Elasticsearch/Postgres health first since doc-api depends on both synchronously. |
| `NexusPlatformCodexQueueBacklogged` / `NexusPlatformCodexJobsFailing` | Requires doc-processor's `METRICS_PORT` wiring (see above) to fire at all. Once wired: check OCR throughput and worker concurrency (`WORKER_CONCURRENCY`/`ASSET_WORKER_CONCURRENCY`) before scaling. |

## Local development

`apps/vtt/docker/docker-compose.observability.yml` is unchanged in shape and
continues to use `monitoring/prometheus.yml` (only the VTT backend target) --
it now also picks up the Grafana dashboard provisioning added by this phase,
since it mounts the same `monitoring/grafana/provisioning` directory. Do not
point it at `monitoring/prometheus.homelab.yml`; the two configs intentionally
diverge (bearer-token secret files, exporter/Codex/asset targets, and
Alertmanager wiring that only make sense in the homelab deployment).
