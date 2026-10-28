export interface MaterializedEncounterRef {
  encounterRef: {
    kind: 'encounter';
    id: string;
    revision: number;
  };
  monsterCount: number;
  created: boolean;
}

export interface EncounterMonsterStats {
  key: string;
  name: string;
  cr: string;
  ac: number;
  hp: number;
  speed: number;
  abilities: number[];
}

export interface ActiveSessionPlanResult {
  activation: {
    id: string;
    campaignId: string;
    sessionPlanId: string;
    sessionPlanRevision: number;
    status: 'active' | 'completed' | 'abandoned';
    currentStepIndex: number;
    stepStates: Record<string, unknown>;
  };
  plan: {
    id: string;
    campaignId: string;
    title: string;
    revision: number;
    steps: Array<{
      id: string;
      title: string;
      type: string;
      track?: 'main' | 'parallel';
      [key: string]: unknown;
    }>;
  };
}

export interface DeployActivationEncounterResult {
  encounterRunId: string;
  duplicate: boolean;
  activation: Record<string, unknown>;
}

export interface CommandExecutionResult {
  success: boolean;
  duplicate?: boolean;
  error?: string;
  receipt?: Record<string, unknown>;
}

export class StudioApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'StudioApiError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === 'string'
        ? body.error
        : `Request failed with status ${response.status}`;
    const code =
      isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
    throw new StudioApiError(message, response.status, code);
  }

  return body as T;
}

/**
 * Materializes an authored encounter into pinned library definitions.
 * Conforms to CS-06 by calling POST /api/campaigns/:id/prep/objects/:objectId/materialize-encounter
 * with fallback to the existing /prep/encounters/:objectId/materialize route.
 */
export async function materializeEncounter(
  campaignId: string,
  objectId: string,
  monsters?: EncounterMonsterStats[],
): Promise<MaterializedEncounterRef> {
  const payload = JSON.stringify({ monsters: monsters ?? [] });
  const primaryPath = `/api/campaigns/${encodeURIComponent(campaignId)}/prep/objects/${encodeURIComponent(objectId)}/materialize-encounter`;
  const fallbackPath = `/api/campaigns/${encodeURIComponent(campaignId)}/prep/encounters/${encodeURIComponent(objectId)}/materialize`;

  try {
    return await apiRequest<MaterializedEncounterRef>(primaryPath, {
      method: 'POST',
      body: payload,
    });
  } catch (err) {
    if (err instanceof StudioApiError && (err.status === 404 || err.status === 405)) {
      return await apiRequest<MaterializedEncounterRef>(fallbackPath, {
        method: 'POST',
        body: payload,
      });
    }
    throw err;
  }
}

/**
 * Fetches the currently active session plan activation for a campaign, if one exists.
 */
export async function getActiveSessionPlan(
  campaignId: string,
  sessionId?: string,
): Promise<ActiveSessionPlanResult | null> {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  const path = `/api/campaigns/${encodeURIComponent(campaignId)}/session-plans/active${query}`;

  try {
    return await apiRequest<ActiveSessionPlanResult>(path, { method: 'GET' });
  } catch (err) {
    if (err instanceof StudioApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Deploys an encounter directly to a scene table via the authoritative DeployEncounter domain command.
 */
export async function deployEncounterToTable(
  campaignId: string,
  templateRef: { kind: 'encounter'; id: string; revision: number },
  sceneId: string,
  options?: {
    anchorPosition?: { x: number; y: number };
    hiddenFromPlayers?: boolean;
    issuerUserId?: string;
  },
): Promise<CommandExecutionResult> {
  const commandId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const command = {
    commandId,
    protocolVersion: '1.0',
    campaignId,
    issuerUserId: options?.issuerUserId || 'studio-dm',
    timestamp: new Date().toISOString(),
    expectedActorVersions: {},
    payload: {
      type: 'DeployEncounter',
      templateRef,
      sceneId,
      anchorPosition: options?.anchorPosition ?? { x: 0, y: 0 },
      hiddenFromPlayers: options?.hiddenFromPlayers ?? false,
    },
  };

  const path = `/api/campaigns/${encodeURIComponent(campaignId)}/commands`;
  return await apiRequest<CommandExecutionResult>(path, {
    method: 'POST',
    body: JSON.stringify(command),
  });
}

/**
 * Deploys an encounter beat from an active session plan step onto the table.
 */
export async function deployEncounterToSessionPlan(
  campaignId: string,
  activationId: string,
  stepId: string,
  options: {
    sceneId: string;
    anchorPosition?: { x: number; y: number };
    hiddenFromPlayers?: boolean;
  },
): Promise<DeployActivationEncounterResult> {
  const path = `/api/campaigns/${encodeURIComponent(campaignId)}/session-plans/activations/${encodeURIComponent(activationId)}/steps/${encodeURIComponent(stepId)}/deploy-encounter`;
  return await apiRequest<DeployActivationEncounterResult>(path, {
    method: 'POST',
    body: JSON.stringify({
      sceneId: options.sceneId,
      anchorPosition: options.anchorPosition ?? { x: 0, y: 0 },
      hiddenFromPlayers: options.hiddenFromPlayers ?? false,
    }),
  });
}

/**
 * Adds an encounter beat as a deploy-encounter step to an active session plan.
 */
export async function addEncounterBeatToSessionPlan(
  campaignId: string,
  sessionPlanId: string,
  encounterId: string,
  encounterTitle: string,
  monsters?: EncounterMonsterStats[],
): Promise<{ success: boolean; stepId: string; encounterRef: MaterializedEncounterRef['encounterRef'] }> {
  const materialized = await materializeEncounter(campaignId, encounterId, monsters);

  const stepId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Retrieve current session plan prep object
  const planObjPath = `/api/campaigns/${encodeURIComponent(campaignId)}/prep/objects/${encodeURIComponent(sessionPlanId)}`;
  const planRecord = await apiRequest<{
    object: { currentRevision: number; id: string };
    data?: Record<string, unknown>;
  }>(planObjPath, { method: 'GET' });

  const existingSteps = Array.isArray(planRecord.data?.steps) ? planRecord.data.steps : [];
  const newStep = {
    id: stepId,
    title: `Deploy: ${encounterTitle}`,
    command: 'Deploy encounter',
    type: 'deploy-encounter',
    track: 'main',
    encounterId,
    encounterRef: materialized.encounterRef,
    encounterMonsters: monsters ?? [],
  };

  const nextSteps = [...existingSteps, newStep];
  const nextData = {
    ...planRecord.data,
    steps: nextSteps,
  };

  await apiRequest(planObjPath, {
    method: 'PUT',
    body: JSON.stringify({
      expectedRevision: planRecord.object.currentRevision,
      data: nextData,
    }),
  });

  return {
    success: true,
    stepId,
    encounterRef: materialized.encounterRef,
  };
}
