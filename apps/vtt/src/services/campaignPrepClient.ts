import type {
  SessionPlan,
  SessionPlanActivation,
  SessionPlanStepState,
} from '@nexus/game-contracts';

const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL || 'http://localhost:5001'
  : '';

export interface ActivePlanResponse {
  activation: SessionPlanActivation;
  plan: SessionPlan;
}

export interface UpdateProgressPayload {
  currentStepIndex: number;
  stepStates?: Record<string, SessionPlanStepState>;
}

export class CampaignPrepClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch the currently active session plan activation and full plan for a campaign/session
   */
  async getActiveSessionPlan(
    campaignId: string,
    sessionId?: string,
  ): Promise<ActivePlanResponse | null> {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    const res = await fetch(
      `${this.baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/session-plans/active${query}`,
      {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Request failed');
      throw new Error(`Failed to fetch active session plan (${res.status}): ${errorText}`);
    }

    return (await res.json()) as ActivePlanResponse;
  }

  /**
   * Update current step and completion status of steps in an active session plan
   */
  async updateActivationProgress(
    campaignId: string,
    activationId: string,
    progress: UpdateProgressPayload,
  ): Promise<SessionPlanActivation> {
    const res = await fetch(
      `${this.baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/session-plans/activations/${encodeURIComponent(activationId)}/progress`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progress),
      },
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Request failed');
      throw new Error(`Failed to update session plan progress (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as { activation: SessionPlanActivation };
    return data.activation;
  }

  /**
   * Activate a published session plan revision for a live session
   */
  async activateSessionPlan(
    campaignId: string,
    planId: string,
    planRevision: number,
    sessionId?: string,
  ): Promise<ActivePlanResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/session-plans/${encodeURIComponent(planId)}/activate`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planRevision,
          sessionId,
          requestId: crypto.randomUUID(),
        }),
      },
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Request failed');
      throw new Error(`Failed to activate session plan (${res.status}): ${errorText}`);
    }

    return (await res.json()) as ActivePlanResponse;
  }
}

export const campaignPrepClient = new CampaignPrepClient();
