import {
  createCommitLatencyHistogram,
  evaluateMultiplayerSlos,
  histogramQuantileMs,
  observeCommitLatency,
  renderPrometheusMetrics,
  type MultiplayerMetricsSnapshot,
} from '../../../server/observability/multiplayerMetrics.js';

function createSnapshot(): MultiplayerMetricsSnapshot {
  return {
    timestamp: 1_700_000_000_000,
    process: {
      uptimeSeconds: 60,
      residentMemoryBytes: 128,
      heapUsedBytes: 50,
      heapTotalBytes: 100,
      heapUtilizationRatio: 0.5,
    },
    rooms: 2,
    connections: 8,
    gameStateQueueDepth: 0,
    database: {
      totalConnections: 4,
      idleConnections: 3,
      waitingRequests: 0,
    },
    gameState: {
      commits: { legacy: 0, full: 1, patch: 9 },
      committed: 10,
      conflicts: 0,
      failures: 0,
      resync: {
        'base-mismatch': 0,
        'integrity-mismatch': 0,
        'malformed-patch': 0,
        'payload-too-large': 0,
      },
      totalResyncs: 0,
      totalUploads: 10,
      resyncRateRatio: 0,
      patchBytesSaved: 2_048,
      commitLatency: createCommitLatencyHistogram(),
    },
    orderedEvents: {
      committed: 20,
      duplicates: 0,
      failed: 0,
      replayRequests: 0,
      replayed: 0,
      truncatedReplays: 0,
      versionConflicts: 0,
    },
    realtime: {
      enabled: true,
      connected: true,
      instanceId: 'test-instance',
      orderedPublished: 20,
      orderedReceived: 20,
      transientPublished: 0,
      transientReceived: 0,
      sequenceGaps: 0,
      journalCatchUps: 0,
      replayedEvents: 0,
      duplicateFanout: 0,
      publishFailures: 0,
      reconnects: 0,
      presenceRefreshFailures: 0,
      hostLeaseConflicts: 0,
    },
  };
}

describe('multiplayer metrics', () => {
  it('records cumulative latency buckets and estimates p95', () => {
    const histogram = createCommitLatencyHistogram();
    for (const latency of [10, 20, 30, 40, 50, 60, 70, 80, 90, 300]) {
      observeCommitLatency(histogram, latency);
    }

    expect(histogram.count).toBe(10);
    expect(histogram.buckets['100']).toBe(9);
    expect(histogram.buckets['500']).toBe(10);
    expect(histogramQuantileMs(histogram, 0.95)).toBe(500);
  });

  it('reports the breached objective without hiding other SLOs', () => {
    const snapshot = createSnapshot();
    snapshot.gameState.failures = 1;

    const result = evaluateMultiplayerSlos(snapshot, {
      commitP95Ms: 250,
      heapUtilizationRatio: 0.9,
      queueDepth: 100,
      resyncRateRatio: 0.01,
    });

    expect(result.compliant).toBe(false);
    expect(
      result.objectives.find(
        (objective) => objective.name === 'durable-commit-failures',
      ),
    ).toMatchObject({ compliant: false, observed: 1 });
  });

  it('renders counters, histograms, and per-objective gauges', () => {
    const snapshot = createSnapshot();
    observeCommitLatency(snapshot.gameState.commitLatency, 42);

    const output = renderPrometheusMetrics(snapshot);

    expect(output).toContain('nexus_vtt_connections 8');
    expect(output).toContain(
      'nexus_vtt_game_state_commit_duration_seconds_bucket{le="0.05"} 1',
    );
    expect(output).toContain('nexus_vtt_slo_compliant 1');
    expect(output).toMatch(/\n$/);
  });
});
