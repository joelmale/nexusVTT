import { describe, expect, test } from 'vitest';

import { compareComposes, summarizeService } from './check-compose-drift.mjs';

const compose = (services) => ({ services });

describe('check-compose-drift', () => {
  test('reports no drift for identical services, ignoring env values and image overrides', () => {
    const live = compose({ app: { image: 'x:latest', restart: 'unless-stopped', environment: { A: '1', B: '2' } } });
    const repo = compose({ app: { image: '${APP_IMAGE:-x:latest}', restart: 'unless-stopped', environment: ['A=9', 'B=8'] } });
    expect(compareComposes(live, repo)).toEqual([]);
  });

  test('flags the restart policy and missing hardening that caused the half-down stack', () => {
    const live = compose({ doc: { image: 'd', restart: 'on-failure', environment: { A: '1' } } });
    const repo = compose({
      doc: {
        image: 'd',
        restart: 'unless-stopped',
        stop_grace_period: '130s',
        healthcheck: { test: ['CMD', 'true'] },
        environment: { A: '1', METRICS_PORT: 9464 },
      },
    });
    expect(compareComposes(live, repo)).toEqual([
      'doc.restart: deployed on-failure, repo unless-stopped',
      'doc.stop_grace_period: deployed unset, repo 130s',
      'doc.healthcheck: deployed unset, repo defined',
      'doc.environment: missing from deployed: METRICS_PORT',
    ]);
  });

  test('flags depends_on conditions, including the list form meaning service_started', () => {
    const live = compose({ a: { depends_on: ['ocr'] } });
    const repo = compose({ a: { depends_on: { ocr: { condition: 'service_healthy' } } } });
    expect(compareComposes(live, repo)).toEqual(['a.depends_on.ocr: deployed service_started, repo service_healthy']);
  });

  test('flags services present on only one side', () => {
    const drift = compareComposes(compose({ only_live: {} }), compose({ only_repo: {} }));
    expect(drift).toEqual(['only_repo: in the repo compose but not deployed', 'only_live: deployed but not in the repo compose']);
  });

  test('summarizeService tolerates an empty service', () => {
    expect(summarizeService(undefined)).toMatchObject({ image: null, restart: null, environment: [], networks: [] });
  });
});
