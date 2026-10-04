import { describe, expect, it } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import {
  buildSessionPlanModel,
  findPlannedSession,
} from './buildSessionPlanModel';

const ASHES = getFixtureBundle('ashes-of-veyra')!;

describe('buildSessionPlanModel', () => {
  it('findPlannedSession finds any existing session by id in the bundle', () => {
    const plannedSession = findPlannedSession(ASHES, 'session-12');
    expect(plannedSession).toBeDefined();
    expect(plannedSession?.title).toBe('The Glass Harbor');

    const unknownSession = findPlannedSession(ASHES, 'session-999');
    expect(unknownSession).toBeUndefined();
  });

  it('returns undefined when the session does not exist in the bundle', () => {
    const result = buildSessionPlanModel(ASHES, 'session-nonexistent');
    expect(result).toBeUndefined();
  });

  it('builds a rich view model for a session that has a pre-authored plan', () => {
    const result = buildSessionPlanModel(
      ASHES,
      'session-12',
      '/campaigns/ashes-of-veyra',
    );
    expect(result).toBeDefined();
    expect(result?.title).toContain('The Glass Harbor');
    expect(result?.backHref).toBe('/campaigns/ashes-of-veyra/sessions');
    expect(result?.breadcrumb).toContain('Session 12');
    expect(result?.steps.length).toBeGreaterThan(0);
    expect(result?.checklist.length).toBeGreaterThan(0);
    expect(result?.dependencies.length).toBeGreaterThan(0);
    expect(result?.durationLabel).toContain('hours');
  });

  it('generates a baseline fallback plan for a session that has no pre-authored plan', () => {
    // Session 11 in Ashes of Veyra is a chronicle session without an authored plan
    const planlessSession = ASHES.sessions.find((s) => s.id === 'session-11');
    expect(planlessSession).toBeDefined();
    expect(planlessSession?.plan).toBeUndefined();

    const result = buildSessionPlanModel(ASHES, 'session-11');
    expect(result).toBeDefined();
    expect(result?.title).toContain('Session 11');
    // Verify fallback synthesized narrative spine steps
    expect(result?.steps.length).toBeGreaterThanOrEqual(4);
    expect(result?.steps[0]?.command).toBe('Opening recap');
    expect(result?.steps[result.steps.length - 1]?.command).toBe('Closing beat');
    expect(result?.checklist.length).toBeGreaterThan(0);
    expect(result?.dateLabel).toBeDefined();
  });
});
