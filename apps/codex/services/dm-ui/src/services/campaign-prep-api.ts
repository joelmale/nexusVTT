import type {
  CampaignEntry,
  CampaignObjectRef,
  SceneTemplate,
  SessionPlan,
} from '@nexus/game-contracts';

interface CampaignRecord {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
}

interface PrepObjectRecord {
  currentRevision: number;
  id: string;
  kind: string;
  status: string;
  title: string;
}

interface UserAsset {
  id: string;
  name: string;
}

interface PublishResponse {
  plan: SessionPlan;
  published: true;
}

const CAMPAIGN_NAME = 'Ashes of Veyra';
const MAP_ASSET_NAME = 'Glass Harbor Docks Map';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

async function ensureSession(): Promise<UserProfile> {
  try {
    return await request<UserProfile>('/api/users/profile');
  } catch {
    try {
      await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'dm@nexusvtt.local',
          password: 'nexus-dev-password-123',
        }),
      });
    } catch {
      await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'dm@nexusvtt.local',
          password: 'nexus-dev-password-123',
          displayName: 'Dungeon Master',
        }),
      });
    }
    return request<UserProfile>('/api/users/profile');
  }
}

async function ensureCampaign(): Promise<CampaignRecord> {
  const campaigns = await request<CampaignRecord[]>('/api/campaigns');
  const existing = campaigns.find((campaign) => campaign.name === CAMPAIGN_NAME);
  if (existing) return existing;
  return request<CampaignRecord>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      name: CAMPAIGN_NAME,
      description:
        'A coastal campaign about the Ember Key, the Hollow Crown, and the factions of Glass Harbor.',
    }),
  });
}

async function ensureMapAsset(userId: string): Promise<UserAsset> {
  try {
    const current = await request<{ assets: UserAsset[] }>(
      `/api/user/${encodeURIComponent(userId)}/assets`,
    );
    const existing = current.assets.find((asset) => asset.name === MAP_ASSET_NAME);
    if (existing) return existing;

    const mapResponse = await fetch(
      `${import.meta.env.BASE_URL}demo/ashes-of-veyra/glass-harbor-map.png`,
    );
    if (!mapResponse.ok) throw new Error('Glass Harbor map asset is unavailable');
    const form = new FormData();
    form.append(
      'file',
      new File([await mapResponse.blob()], 'glass-harbor-map.png', {
        type: 'image/png',
      }),
    );
    form.append('name', MAP_ASSET_NAME);
    form.append('category', 'maps');
    const uploaded = await request<{ asset: UserAsset }>(
      `/api/user/${encodeURIComponent(userId)}/upload`,
      { method: 'POST', body: form },
    );
    return uploaded.asset;
  } catch {
    return {
      id: 'demo-glass-harbor-map-asset',
      name: MAP_ASSET_NAME,
    };
  }
}

async function createPrepObject(
  campaignId: string,
  kind: string,
  data: CampaignEntry | SceneTemplate | SessionPlan,
): Promise<PrepObjectRecord> {
  const result = await request<{ object: PrepObjectRecord }>(
    `/api/campaigns/${campaignId}/prep/objects`,
    {
      method: 'POST',
      body: JSON.stringify({
        kind,
        data,
        requestId: crypto.randomUUID(),
      }),
    },
  );
  return result.object;
}

export async function publishGlassHarborPlan(): Promise<PublishResponse> {
  const profile = await ensureSession();
  const campaign = await ensureCampaign();
  const [mapAsset, existingObjects] = await Promise.all([
    ensureMapAsset(profile.id),
    request<{ objects: PrepObjectRecord[] }>(
      `/api/campaigns/${campaign.id}/prep/objects`,
    ),
  ]);
  const now = new Date().toISOString();

  let note = existingObjects.objects.find(
    (object) => object.kind === 'note' && object.title === "Harbormaster's Warning",
  );
  if (!note) {
    const id = crypto.randomUUID();
    const data: CampaignEntry = {
      id,
      campaignId: campaign.id,
      schemaVersion: 1,
      revision: 1,
      kind: 'note',
      title: "Harbormaster's Warning",
      visibility: 'dm-only',
      content: {
        format: 'lexical',
        schemaVersion: 1,
        value: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Watch the eastern pier without involving the Watch.',
                  },
                ],
              },
            ],
          },
        },
      },
      links: [],
      tags: ['glass-harbor', 'captain-serin'],
      createdAt: now,
      updatedAt: now,
    };
    note = await createPrepObject(campaign.id, 'note', data);
  }

  let scene = existingObjects.objects.find(
    (object) =>
      object.kind === 'scene-template' && object.title === 'Glass Harbor Docks',
  );
  if (!scene) {
    const id = crypto.randomUUID();
    const data: SceneTemplate = {
      id,
      campaignId: campaign.id,
      schemaVersion: 1,
      revision: 1,
      name: 'Glass Harbor Docks',
      backgroundAssetRef: { target: 'asset', assetId: mapAsset.id },
      grid: {
        enabled: true,
        type: 'square',
        size: 100,
        offsetX: 0,
        offsetY: 0,
        snapToGrid: true,
      },
      lighting: {
        enabled: true,
        globalIllumination: false,
        ambientLight: 0.35,
        darkness: 0.65,
      },
      fogPreset: { mode: 'concealed', revealedShapes: [] },
      createdAt: now,
      updatedAt: now,
    };
    scene = await createPrepObject(campaign.id, 'scene-template', data);
  }

  let plan = existingObjects.objects.find(
    (object) =>
      object.kind === 'session-plan' &&
      object.title === 'Session 12 - The Glass Harbor',
  );
  if (plan?.status === 'ready') {
    const current = await request<{ revision: { data: SessionPlan } }>(
      `/api/campaigns/${campaign.id}/prep/objects/${plan.id}`,
    );
    return { published: true, plan: current.revision.data };
  }
  if (!plan) {
    const sceneRef: CampaignObjectRef = {
      target: 'campaign-object',
      campaignId: campaign.id,
      id: scene.id,
      revision: scene.currentRevision,
    };
    const noteRef: CampaignObjectRef = {
      target: 'campaign-object',
      campaignId: campaign.id,
      id: note.id,
      revision: note.currentRevision,
    };
    const id = crypto.randomUUID();
    const data: SessionPlan = {
      id,
      campaignId: campaign.id,
      schemaVersion: 1,
      revision: 1,
      title: 'Session 12 - The Glass Harbor',
      status: 'draft',
      steps: [
        { id: crypto.randomUUID(), type: 'reminder', title: 'Opening recap', estimatedMinutes: 10, visibility: 'players', text: 'Re-establish the burned ledger and the pressure from the harbor factions.' },
        { id: crypto.randomUUID(), type: 'activate-scene', title: 'Glass Harbor Docks', estimatedMinutes: 5, visibility: 'players', sceneTemplateRef: sceneRef },
        { id: crypto.randomUUID(), type: 'open-entry', title: "Harbormaster's Warning", estimatedMinutes: 10, visibility: 'dm-only', entryRef: noteRef },
        { id: crypto.randomUUID(), type: 'reminder', title: 'Deploy Dockside Ambush', estimatedMinutes: 30, visibility: 'dm-only', text: 'Encounter deployment becomes active when the encounter definition is persisted.' },
        { id: crypto.randomUUID(), type: 'reminder', title: 'Share Burned Shipping Ledger', estimatedMinutes: 5, visibility: 'players', text: 'Handout sharing becomes active when the ledger asset is persisted.' },
        { id: crypto.randomUUID(), type: 'reminder', title: 'Follow the fleeing bandit or confront the Watch', estimatedMinutes: 20, visibility: 'dm-only', text: 'Offer the chainwalk pursuit or the Watch negotiation.' },
        { id: crypto.randomUUID(), type: 'reminder', title: 'The bell below the harbor', estimatedMinutes: 5, visibility: 'players', text: 'At low tide, a bell sounds beneath the harbor.' },
      ],
      dependencies: [
        sceneRef,
        noteRef,
        { target: 'asset', assetId: mapAsset.id },
      ],
      createdAt: now,
      updatedAt: now,
    };
    plan = await createPrepObject(campaign.id, 'session-plan', data);
  }

  return request<PublishResponse>(
    `/api/campaigns/${campaign.id}/prep/objects/${plan.id}/publish`,
    {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: plan.currentRevision,
        requestId: crypto.randomUUID(),
      }),
    },
  );
}

export interface ActivatePlanResponse {
  activation: {
    id: string;
    campaignId: string;
    sessionPlanId: string;
    planRevision: number;
    sessionId: string;
    currentStepIndex: number;
    status: string;
  };
  plan: SessionPlan;
}

export async function activateGlassHarborPlan(): Promise<ActivatePlanResponse> {
  const published = await publishGlassHarborPlan();
  return request<ActivatePlanResponse>(
    `/api/campaigns/${published.plan.campaignId}/session-plans/${published.plan.id}/activate`,
    {
      method: 'POST',
      body: JSON.stringify({
        planRevision: published.plan.revision,
        requestId: crypto.randomUUID(),
      }),
    },
  );
}

