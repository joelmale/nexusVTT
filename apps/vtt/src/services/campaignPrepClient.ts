import type {
  CampaignEntry,
  SessionPlan,
  SessionPlanActivation,
  SessionPlanActivationStatus,
  SessionPlanStepState,
} from '@nexus/game-contracts';

const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL || 'http://localhost:5001'
  : '';

export interface ActivePlanResponse {
  activation: SessionPlanActivation;
  plan: SessionPlan;
}

export class CampaignPrepRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'CampaignPrepRequestError';
  }
}

export interface UpdateProgressPayload {
  /** The activation revision the caller observed. */
  expectedRevision: number;
  currentStepIndex?: number;
  status?: SessionPlanActivationStatus;
  stepStates?: Record<string, SessionPlanStepState>;
}

export interface CampaignPrepObjectListItem {
  id: string;
  kind: string;
  title: string;
  status: string;
  currentRevision: number;
  updatedAt: string;
}

export interface ListCampaignObjectsResponse {
  objects: CampaignPrepObjectListItem[];
}

export interface CampaignEntryResponse {
  object: {
    id: string;
    kind: string;
    title: string;
  };
  revision: {
    data: CampaignEntry;
  };
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
    const query = sessionId
      ? `?sessionId=${encodeURIComponent(sessionId)}`
      : '';
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
      throw new Error(
        `Failed to fetch active session plan (${res.status}): ${errorText}`,
      );
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
      throw new CampaignPrepRequestError(
        `Failed to update session plan progress (${res.status}): ${errorText}`,
        res.status,
      );
    }

    const data = (await res.json()) as { activation: SessionPlanActivation };
    return data.activation;
  }

  async advanceActivationStep(
    campaignId: string,
    activationId: string,
    stepId: string,
    stepIndex: number,
    expectedRevision?: number,
  ): Promise<SessionPlanActivation> {
    const res = await fetch(
      `${this.baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/session-plans/activations/${encodeURIComponent(activationId)}/advance`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, stepIndex, expectedRevision }),
      },
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Request failed');
      throw new CampaignPrepRequestError(
        `Failed to advance session plan (${res.status}): ${errorText}`,
        res.status,
      );
    }

    const data = (await res.json()) as { activation: SessionPlanActivation };
    return data.activation;
  }

  /**
   * Deploy a deploy-encounter step. Idempotent per (activation, step): the
   * server returns the recorded encounterRunId instead of spawning again.
   */
  async deployActivationEncounter(
    campaignId: string,
    activationId: string,
    stepId: string,
    options: {
      sceneId: string;
      anchorPosition?: { x: number; y: number };
      hiddenFromPlayers?: boolean;
    },
  ): Promise<{
    encounterRunId: string;
    duplicate: boolean;
    activation: SessionPlanActivation;
  }> {
    const res = await fetch(
      `${this.baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/session-plans/activations/${encodeURIComponent(activationId)}/steps/${encodeURIComponent(stepId)}/deploy-encounter`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: options.sceneId,
          anchorPosition: options.anchorPosition ?? { x: 0, y: 0 },
          hiddenFromPlayers: options.hiddenFromPlayers ?? false,
        }),
      },
    );
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Request failed');
      throw new CampaignPrepRequestError(
        `Failed to deploy encounter (${res.status}): ${errorText}`,
        res.status,
      );
    }
    return (await res.json()) as {
      encounterRunId: string;
      duplicate: boolean;
      activation: SessionPlanActivation;
    };
  }

  async getCampaignEntry(
    campaignId: string,
    entryId: string,
  ): Promise<CampaignEntryResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/prep/objects/${encodeURIComponent(entryId)}`,
      {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Request failed');
      throw new Error(
        `Failed to fetch campaign entry (${res.status}): ${errorText}`,
      );
    }

    return (await res.json()) as CampaignEntryResponse;
  }

  /**
   * List campaign prep objects (optionally filtered by kind e.g. 'npc', or status)
   */
  async listCampaignObjects(
    campaignId: string,
    options?: { kind?: string; status?: string },
  ): Promise<CampaignPrepObjectListItem[]> {
    const params = new URLSearchParams();
    if (options?.kind) params.set('kind', options.kind);
    if (options?.status) params.set('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(
      `${this.baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/prep/objects${query}`,
      {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Request failed');
      throw new Error(
        `Failed to list campaign prep objects (${res.status}): ${errorText}`,
      );
    }

    const data = (await res.json()) as ListCampaignObjectsResponse;
    return data.objects;
  }

  /**
   * List all NPCs for a campaign
   */
  async listCampaignNpcs(campaignId: string): Promise<CampaignPrepObjectListItem[]> {
    return this.listCampaignObjects(campaignId, { kind: 'npc' });
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
      throw new Error(
        `Failed to activate session plan (${res.status}): ${errorText}`,
      );
    }

    return (await res.json()) as ActivePlanResponse;
  }
}

export const campaignPrepClient = new CampaignPrepClient();
