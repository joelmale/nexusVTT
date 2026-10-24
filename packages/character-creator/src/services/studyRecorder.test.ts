import { describe, it, expect, beforeEach } from 'vitest';
import { studyRecorder } from './studyRecorder';

describe('studyRecorder (CC-602)', () => {
  beforeEach(() => {
    studyRecorder.reset();
  });

  it('records study events and aggregates metrics accurately', () => {
    studyRecorder.recordEvent('flow_enter', 0);
    studyRecorder.recordEvent('recommendation_accepted', 1, { choice: 'fighter' });
    studyRecorder.recordEvent('step_transition', 2);
    studyRecorder.recordEvent('choice_customized', 2, { field: 'species' });
    studyRecorder.recordEvent('back_navigation', 1);
    studyRecorder.recordEvent('step_transition', 2);
    studyRecorder.recordEvent('validation_error', 2, { reason: 'missing_name' });
    studyRecorder.recordEvent('handoff_completed', 4);

    const events = studyRecorder.getEvents();
    expect(events.length).toBe(8);

    const metrics = studyRecorder.getMetrics();
    expect(metrics.completed).toBe(true);
    expect(metrics.recommendationsAcceptedCount).toBe(1);
    expect(metrics.backtrackingCount).toBe(1);
    expect(metrics.validationErrorsCount).toBe(1);
    expect(metrics.totalControlActions).toBe(6);
  });
});
