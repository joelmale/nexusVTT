import type { RealtimeCoordinatorMetrics } from '../services/realtimeCoordinator.js';

export const COMMIT_LATENCY_BUCKETS_MS = [
  10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000,
] as const;

export interface CommitLatencyHistogram {
  buckets: Record<string, number>;
  count: number;
  maxMs: number;
  totalMs: number;
}

export interface MultiplayerSloConfig {
  commitP95Ms: number;
  heapUtilizationRatio: number;
  queueDepth: number;
  resyncRateRatio: number;
}

export interface MultiplayerMetricsSnapshot {
  timestamp: number;
  process: {
    uptimeSeconds: number;
    residentMemoryBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    heapUtilizationRatio: number;
  };
  rooms: number;
  connections: number;
  gameStateQueueDepth: number;
  database: {
    totalConnections: number;
    idleConnections: number;
    waitingRequests: number;
  };
  gameState: {
    commits: { legacy: number; full: number; patch: number };
    committed: number;
    conflicts: number;
    failures: number;
    resync: Record<string, number>;
    totalResyncs: number;
    totalUploads: number;
    resyncRateRatio: number;
    patchBytesSaved: number;
    commitLatency: CommitLatencyHistogram;
  };
  orderedEvents: {
    committed: number;
    duplicates: number;
    failed: number;
    replayRequests: number;
    replayed: number;
    truncatedReplays: number;
    versionConflicts: number;
  };
  realtime: RealtimeCoordinatorMetrics;
}

export interface MultiplayerSloResult {
  compliant: boolean;
  evaluatedAt: number;
  objectives: Array<{
    name: string;
    compliant: boolean;
    observed: number;
    threshold: number;
    unit: string;
  }>;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getMultiplayerSloConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MultiplayerSloConfig {
  return {
    commitP95Ms: positiveNumber(environment.MULTIPLAYER_SLO_COMMIT_P95_MS, 250),
    heapUtilizationRatio: positiveNumber(
      environment.MULTIPLAYER_SLO_HEAP_UTILIZATION_RATIO,
      0.9,
    ),
    queueDepth: positiveNumber(environment.MULTIPLAYER_SLO_QUEUE_DEPTH, 100),
    resyncRateRatio: positiveNumber(
      environment.MULTIPLAYER_SLO_RESYNC_RATE_RATIO,
      0.01,
    ),
  };
}

export function createCommitLatencyHistogram(): CommitLatencyHistogram {
  return {
    buckets: Object.fromEntries(
      COMMIT_LATENCY_BUCKETS_MS.map((upperBound) => [String(upperBound), 0]),
    ),
    count: 0,
    maxMs: 0,
    totalMs: 0,
  };
}

export function observeCommitLatency(
  histogram: CommitLatencyHistogram,
  latencyMs: number,
): void {
  const observed = Math.max(0, latencyMs);
  histogram.count += 1;
  histogram.totalMs += observed;
  histogram.maxMs = Math.max(histogram.maxMs, observed);
  for (const upperBound of COMMIT_LATENCY_BUCKETS_MS) {
    if (observed <= upperBound) {
      histogram.buckets[String(upperBound)] += 1;
    }
  }
}

export function histogramQuantileMs(
  histogram: CommitLatencyHistogram,
  quantile: number,
): number {
  if (histogram.count === 0) return 0;
  const rank = Math.ceil(histogram.count * Math.min(1, Math.max(0, quantile)));
  for (const upperBound of COMMIT_LATENCY_BUCKETS_MS) {
    if (histogram.buckets[String(upperBound)] >= rank) return upperBound;
  }
  return histogram.maxMs;
}

export function evaluateMultiplayerSlos(
  snapshot: MultiplayerMetricsSnapshot,
  config: MultiplayerSloConfig = getMultiplayerSloConfig(),
): MultiplayerSloResult {
  const objectives = [
    {
      name: 'durable-commit-failures',
      compliant: snapshot.gameState.failures === 0,
      observed: snapshot.gameState.failures,
      threshold: 0,
      unit: 'failures',
    },
    {
      name: 'ordered-event-failures',
      compliant: snapshot.orderedEvents.failed === 0,
      observed: snapshot.orderedEvents.failed,
      threshold: 0,
      unit: 'failures',
    },
    {
      name: 'realtime-publish-failures',
      compliant: snapshot.realtime.publishFailures === 0,
      observed: snapshot.realtime.publishFailures,
      threshold: 0,
      unit: 'failures',
    },
    {
      name: 'commit-p95',
      compliant:
        histogramQuantileMs(snapshot.gameState.commitLatency, 0.95) <=
        config.commitP95Ms,
      observed: histogramQuantileMs(snapshot.gameState.commitLatency, 0.95),
      threshold: config.commitP95Ms,
      unit: 'milliseconds',
    },
    {
      name: 'resync-rate',
      compliant: snapshot.gameState.resyncRateRatio <= config.resyncRateRatio,
      observed: snapshot.gameState.resyncRateRatio,
      threshold: config.resyncRateRatio,
      unit: 'ratio',
    },
    {
      name: 'commit-queue-depth',
      compliant: snapshot.gameStateQueueDepth <= config.queueDepth,
      observed: snapshot.gameStateQueueDepth,
      threshold: config.queueDepth,
      unit: 'queued-rooms',
    },
    {
      name: 'heap-utilization',
      compliant:
        snapshot.process.heapUtilizationRatio <= config.heapUtilizationRatio,
      observed: snapshot.process.heapUtilizationRatio,
      threshold: config.heapUtilizationRatio,
      unit: 'ratio',
    },
    {
      name: 'realtime-connected',
      compliant: !snapshot.realtime.enabled || snapshot.realtime.connected,
      observed: snapshot.realtime.connected ? 1 : 0,
      threshold: snapshot.realtime.enabled ? 1 : 0,
      unit: 'boolean',
    },
  ];

  return {
    compliant: objectives.every((objective) => objective.compliant),
    evaluatedAt: snapshot.timestamp,
    objectives,
  };
}

function metric(
  name: string,
  help: string,
  type: 'counter' | 'gauge',
  value: number,
  labels = '',
): string[] {
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} ${type}`,
    `${name}${labels} ${Number.isFinite(value) ? value : 0}`,
  ];
}

function labelValue(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('"', '\\"');
}

export function renderPrometheusMetrics(
  snapshot: MultiplayerMetricsSnapshot,
  slo: MultiplayerSloResult = evaluateMultiplayerSlos(snapshot),
): string {
  const lines: string[] = [];
  const add = (...values: string[]) => lines.push(...values);

  add(
    ...metric(
      'nexus_vtt_rooms',
      'Active multiplayer rooms.',
      'gauge',
      snapshot.rooms,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_connections',
      'Active WebSocket connections.',
      'gauge',
      snapshot.connections,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_game_state_commit_queue_depth',
      'Rooms with a queued durable game-state commit.',
      'gauge',
      snapshot.gameStateQueueDepth,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_process_resident_memory_bytes',
      'Resident process memory.',
      'gauge',
      snapshot.process.residentMemoryBytes,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_process_heap_used_bytes',
      'Used JavaScript heap.',
      'gauge',
      snapshot.process.heapUsedBytes,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_process_heap_utilization_ratio',
      'Used-to-total JavaScript heap ratio.',
      'gauge',
      snapshot.process.heapUtilizationRatio,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_database_pool_connections',
      'PostgreSQL pool connections.',
      'gauge',
      snapshot.database.totalConnections,
      '{state="total"}',
    ),
  );
  lines.push(
    `nexus_vtt_database_pool_connections{state="idle"} ${snapshot.database.idleConnections}`,
  );
  lines.push(
    `nexus_vtt_database_pool_connections{state="waiting"} ${snapshot.database.waitingRequests}`,
  );

  add(
    ...metric(
      'nexus_vtt_game_state_commits_total',
      'Durably committed game-state uploads.',
      'counter',
      snapshot.gameState.commits.legacy,
      '{kind="legacy"}',
    ),
  );
  lines.push(
    `nexus_vtt_game_state_commits_total{kind="full"} ${snapshot.gameState.commits.full}`,
  );
  lines.push(
    `nexus_vtt_game_state_commits_total{kind="patch"} ${snapshot.gameState.commits.patch}`,
  );
  add(
    ...metric(
      'nexus_vtt_game_state_commit_conflicts_total',
      'Durable game-state compare-and-swap conflicts.',
      'counter',
      snapshot.gameState.conflicts,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_game_state_commit_failures_total',
      'Durable game-state commit failures.',
      'counter',
      snapshot.gameState.failures,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_game_state_patch_bytes_saved_total',
      'Bytes avoided by delta patches.',
      'counter',
      snapshot.gameState.patchBytesSaved,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_game_state_resync_rate_ratio',
      'Game-state uploads requiring a resync.',
      'gauge',
      snapshot.gameState.resyncRateRatio,
    ),
  );
  add(
    '# HELP nexus_vtt_game_state_resyncs_total Game-state resynchronizations by reason.',
    '# TYPE nexus_vtt_game_state_resyncs_total counter',
  );
  for (const [reason, count] of Object.entries(snapshot.gameState.resync)) {
    lines.push(
      `nexus_vtt_game_state_resyncs_total{reason="${labelValue(reason)}"} ${count}`,
    );
  }

  add(
    '# HELP nexus_vtt_game_state_commit_duration_seconds Durable game-state commit latency.',
    '# TYPE nexus_vtt_game_state_commit_duration_seconds histogram',
  );
  for (const upperBound of COMMIT_LATENCY_BUCKETS_MS) {
    lines.push(
      `nexus_vtt_game_state_commit_duration_seconds_bucket{le="${upperBound / 1_000}"} ${snapshot.gameState.commitLatency.buckets[String(upperBound)]}`,
    );
  }
  lines.push(
    `nexus_vtt_game_state_commit_duration_seconds_bucket{le="+Inf"} ${snapshot.gameState.commitLatency.count}`,
  );
  lines.push(
    `nexus_vtt_game_state_commit_duration_seconds_sum ${snapshot.gameState.commitLatency.totalMs / 1_000}`,
  );
  lines.push(
    `nexus_vtt_game_state_commit_duration_seconds_count ${snapshot.gameState.commitLatency.count}`,
  );

  for (const [key, value] of Object.entries(snapshot.orderedEvents)) {
    add(
      ...metric(
        `nexus_vtt_ordered_events_${key.replaceAll(/[A-Z]/g, (character) => `_${character.toLowerCase()}`)}_total`,
        `Ordered-event ${key} count.`,
        'counter',
        value,
      ),
    );
  }

  add(
    ...metric(
      'nexus_vtt_realtime_enabled',
      'Whether distributed realtime coordination is configured.',
      'gauge',
      snapshot.realtime.enabled ? 1 : 0,
    ),
  );
  add(
    ...metric(
      'nexus_vtt_realtime_connected',
      'Whether the distributed realtime coordinator is connected.',
      'gauge',
      snapshot.realtime.connected ? 1 : 0,
    ),
  );
  for (const key of [
    'publishFailures',
    'reconnects',
    'sequenceGaps',
    'journalCatchUps',
    'replayedEvents',
    'duplicateFanout',
    'presenceRefreshFailures',
    'hostLeaseConflicts',
  ] as const) {
    const snakeCase = key.replaceAll(
      /[A-Z]/g,
      (character) => `_${character.toLowerCase()}`,
    );
    add(
      ...metric(
        `nexus_vtt_realtime_${snakeCase}_total`,
        `Realtime ${key} count.`,
        'counter',
        snapshot.realtime[key],
      ),
    );
  }

  add(
    ...metric(
      'nexus_vtt_slo_compliant',
      'Whether every multiplayer SLO is currently compliant.',
      'gauge',
      slo.compliant ? 1 : 0,
    ),
  );
  add(
    '# HELP nexus_vtt_slo_objective_compliant Multiplayer SLO compliance by objective.',
    '# TYPE nexus_vtt_slo_objective_compliant gauge',
  );
  for (const objective of slo.objectives) {
    lines.push(
      `nexus_vtt_slo_objective_compliant{objective="${labelValue(objective.name)}"} ${objective.compliant ? 1 : 0}`,
    );
  }

  return `${lines.join('\n')}\n`;
}
