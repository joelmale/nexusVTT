/**
 * Local study recorder & lightweight telemetry for usability and completion analysis (CC-602).
 * Operates purely locally in-memory/session without any external cloud analytics.
 */

export type StudyEventType =
  | 'flow_enter'
  | 'step_transition'
  | 'recommendation_accepted'
  | 'choice_customized'
  | 'back_navigation'
  | 'validation_error'
  | 'draft_resumed'
  | 'draft_saved'
  | 'character_saved'
  | 'session_accepted'
  | 'handoff_completed';

export interface StudyEvent {
  id: string;
  type: StudyEventType;
  timestamp: number;
  step?: number | string;
  metadata?: Record<string, string | number | boolean>;
}

export interface StudySessionMetrics {
  totalDurationMs: number;
  totalControlActions: number;
  backtrackingCount: number;
  recommendationsAcceptedCount: number;
  validationErrorsCount: number;
  completed: boolean;
  stepDurationsMs: Record<string, number>;
}

class StudyRecorder {
  private events: StudyEvent[] = [];
  private sessionStartTime: number = Date.now();

  public recordEvent(
    type: StudyEventType,
    step?: number | string,
    metadata?: Record<string, string | number | boolean>,
  ): StudyEvent {
    const now = Date.now();
    const event: StudyEvent = {
      id: `${now}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      timestamp: now,
      step,
      metadata,
    };

    this.events.push(event);

    return event;
  }

  public getEvents(): StudyEvent[] {
    return [...this.events];
  }

  public getMetrics(): StudySessionMetrics {
    const totalDurationMs =
      this.events.length > 0
        ? this.events[this.events.length - 1].timestamp - this.sessionStartTime
        : 0;

    let totalControlActions = 0;
    let backtrackingCount = 0;
    let recommendationsAcceptedCount = 0;
    let validationErrorsCount = 0;
    let completed = false;

    const stepDurationsMs: Record<string, number> = {};
    let lastTimestamp = this.sessionStartTime;
    let activeStep = '0';

    for (const evt of this.events) {
      switch (evt.type) {
        case 'recommendation_accepted':
          recommendationsAcceptedCount++;
          totalControlActions++;
          break;
        case 'choice_customized':
          totalControlActions++;
          break;
        case 'back_navigation':
          backtrackingCount++;
          totalControlActions++;
          break;
        case 'validation_error':
          validationErrorsCount++;
          break;
        case 'handoff_completed':
        case 'character_saved':
          completed = true;
          totalControlActions++;
          break;
        case 'draft_saved':
        case 'session_accepted':
          totalControlActions++;
          break;
        case 'step_transition':
          totalControlActions++;
          const duration = evt.timestamp - lastTimestamp;
          stepDurationsMs[activeStep] =
            (stepDurationsMs[activeStep] || 0) + duration;
          activeStep = String(evt.step ?? 'unknown');
          lastTimestamp = evt.timestamp;
          break;
        default:
          break;
      }
    }

    return {
      totalDurationMs: Math.max(0, totalDurationMs),
      totalControlActions,
      backtrackingCount,
      recommendationsAcceptedCount,
      validationErrorsCount,
      completed,
      stepDurationsMs,
    };
  }

  public reset(): void {
    this.events = [];
    this.sessionStartTime = Date.now();
  }
}

export const studyRecorder = new StudyRecorder();
