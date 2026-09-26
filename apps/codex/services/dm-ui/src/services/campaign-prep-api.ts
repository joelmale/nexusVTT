import type {
  CampaignEntry,
  CampaignObjectRef,
  SceneTemplate,
  SessionPlan,
  SessionPlanStep,
} from '@nexus/game-contracts';

import type { SessionStepViewModel } from '@/features/session-plan/sessionPlanModels';

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

interface AuthoredObjectResponse {
  object: PrepObjectRecord;
}

export interface PublishResponse {
  plan: SessionPlan;
  published: true;
}

export interface PublishSessionPlanInput {
  campaignDescription?: string;
  campaignTitle: string;
  planTitle: string;
  revision: number;
  sceneMapPath?: string;
  steps: SessionStepViewModel[];
}

const DEFAULT_MAP_ASSET_NAME = 'Session Scene Map';

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

async function ensureCampaign(
  title: string,
  description?: string,
): Promise<CampaignRecord> {
  const campaigns = await request<CampaignRecord[]>('/api/campaigns');
  const existing = campaigns.find((campaign) => campaign.name === title);
  if (existing) return existing;
  return request<CampaignRecord>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name: title, description: description || '' }),
  });
}

async function uploadAsset(
  userId: string,
  name: string,
  content: Blob,
  fileName: string,
  category: 'documents' | 'maps',
): Promise<UserAsset> {
  const form = new FormData();
  form.append('file', new File([content], fileName, { type: content.type }));
  form.append('name', name);
  form.append('category', category);
  const uploaded = await request<{ asset: UserAsset }>(
    `/api/user/${encodeURIComponent(userId)}/upload`,
    { method: 'POST', body: form },
  );
  return uploaded.asset;
}

async function ensureTextAsset(
  userId: string,
  assets: UserAsset[],
  name: string,
  text: string,
): Promise<UserAsset> {
  const existing = assets.find((asset) => asset.name === name);
  if (existing) return existing;
  const asset = await uploadAsset(
    userId,
    name,
    new Blob([text || name], { type: 'text/plain' }),
    `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`,
    'documents',
  );
  assets.push(asset);
  return asset;
}

async function ensureMapAsset(
  userId: string,
  assets: UserAsset[],
  sceneMapPath: string,
): Promise<UserAsset> {
  const existing = assets.find(
    (asset) => asset.name === DEFAULT_MAP_ASSET_NAME,
  );
  if (existing) return existing;
  const response = await fetch(sceneMapPath);
  if (!response.ok) throw new Error('The session scene map is unavailable.');
  const asset = await uploadAsset(
    userId,
    DEFAULT_MAP_ASSET_NAME,
    await response.blob(),
    'session-scene-map.png',
    'maps',
  );
  assets.push(asset);
  return asset;
}

function lexicalContent(text: string): CampaignEntry['content'] {
  return {
    format: 'lexical',
    schemaVersion: 1,
    value: {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text }],
          },
        ],
      },
    },
  };
}

async function createPrepObject(
  campaignId: string,
  kind: string,
  data: CampaignEntry | SceneTemplate | SessionPlan,
): Promise<PrepObjectRecord> {
  const result = await request<AuthoredObjectResponse>(
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

async function revisePrepObject(
  campaignId: string,
  object: PrepObjectRecord,
  data: CampaignEntry | SceneTemplate | SessionPlan,
): Promise<PrepObjectRecord> {
  const result = await request<AuthoredObjectResponse>(
    `/api/campaigns/${campaignId}/prep/objects/${object.id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        data,
        expectedRevision: object.currentRevision,
        requestId: crypto.randomUUID(),
      }),
    },
  );
  return result.object;
}

function campaignObjectRef(
  campaignId: string,
  object: PrepObjectRecord,
): Extract<CampaignObjectRef, { target: 'campaign-object' }> {
  return {
    target: 'campaign-object',
    campaignId,
    id: object.id,
    revision: object.currentRevision,
  };
}

async function ensureEntry(
  campaignId: string,
  existingObjects: PrepObjectRecord[],
  step: SessionStepViewModel,
  now: string,
): Promise<PrepObjectRecord> {
  const existing = existingObjects.find(
    (object) => object.kind === 'note' && object.title === step.title,
  );
  const data: CampaignEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    campaignId,
    schemaVersion: 1,
    revision: existing ? existing.currentRevision + 1 : 1,
    kind: 'note',
    title: step.title,
    visibility: step.visibility === 'shared' ? 'players' : 'dm-only',
    content: lexicalContent(step.body || step.title),
    links: [],
    tags: step.track === 'parallel' ? ['parallel-thread'] : [],
    createdAt: now,
    updatedAt: now,
  };
  const saved = existing
    ? await revisePrepObject(campaignId, existing, data)
    : await createPrepObject(campaignId, 'note', data);
  if (!existing) existingObjects.push(saved);
  return saved;
}

async function ensureScene(
  campaignId: string,
  existingObjects: PrepObjectRecord[],
  mapAsset: UserAsset,
  title: string,
  now: string,
): Promise<PrepObjectRecord> {
  const existing = existingObjects.find(
    (object) => object.kind === 'scene-template' && object.title === title,
  );
  if (existing) return existing;
  const data: SceneTemplate = {
    id: crypto.randomUUID(),
    campaignId,
    schemaVersion: 1,
    revision: 1,
    name: title,
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
  const saved = await createPrepObject(campaignId, 'scene-template', data);
  existingObjects.push(saved);
  return saved;
}

async function buildContractSteps(
  input: PublishSessionPlanInput,
  campaignId: string,
  userId: string,
  assets: UserAsset[],
  existingObjects: PrepObjectRecord[],
  now: string,
): Promise<SessionPlanStep[]> {
  const orderedSteps = [
    ...input.steps.filter((step) => step.track === 'main'),
    ...input.steps.filter((step) => step.track === 'parallel'),
  ];
  const result: SessionPlanStep[] = [];

  for (const step of orderedSteps) {
    const base = {
      id: crypto.randomUUID(),
      title: step.title,
      estimatedMinutes: step.durationMinutes,
      visibility:
        step.visibility === 'shared'
          ? ('players' as const)
          : ('dm-only' as const),
      track: step.track,
    };

    if (step.command === 'Open note') {
      const entry = await ensureEntry(campaignId, existingObjects, step, now);
      result.push({
        ...base,
        type: 'open-entry',
        entryRef: campaignObjectRef(campaignId, entry),
      });
      continue;
    }

    if (step.command === 'Activate scene' && input.sceneMapPath) {
      const mapAsset = await ensureMapAsset(userId, assets, input.sceneMapPath);
      const scene = await ensureScene(
        campaignId,
        existingObjects,
        mapAsset,
        step.title,
        now,
      );
      result.push({
        ...base,
        type: 'activate-scene',
        sceneTemplateRef: campaignObjectRef(campaignId, scene),
      });
      continue;
    }

    if (step.command === 'Share handout') {
      const asset = await ensureTextAsset(
        userId,
        assets,
        step.title,
        step.body || step.title,
      );
      result.push({
        ...base,
        type: 'share-handout',
        assetRef: { target: 'asset', assetId: asset.id },
      });
      continue;
    }

    result.push({
      ...base,
      type: 'reminder',
      text: step.body || step.title,
    });
  }

  return result;
}

export async function publishSessionPlan(
  input: PublishSessionPlanInput,
): Promise<PublishResponse> {
  const profile = await ensureSession();
  const campaign = await ensureCampaign(
    input.campaignTitle,
    input.campaignDescription,
  );
  const [assetResponse, objectResponse] = await Promise.all([
    request<{ assets: UserAsset[] }>(
      `/api/user/${encodeURIComponent(profile.id)}/assets`,
    ),
    request<{ objects: PrepObjectRecord[] }>(
      `/api/campaigns/${campaign.id}/prep/objects`,
    ),
  ]);
  const now = new Date().toISOString();
  const steps = await buildContractSteps(
    input,
    campaign.id,
    profile.id,
    assetResponse.assets,
    objectResponse.objects,
    now,
  );
  let plan = objectResponse.objects.find(
    (object) =>
      object.kind === 'session-plan' && object.title === input.planTitle,
  );
  const planId = plan?.id ?? crypto.randomUUID();
  const revision = plan ? plan.currentRevision + 1 : 1;
  const data: SessionPlan = {
    id: planId,
    campaignId: campaign.id,
    schemaVersion: 1,
    revision,
    title: input.planTitle,
    status: 'draft',
    steps,
    dependencies: [],
    createdAt: now,
    updatedAt: now,
  };

  plan = plan
    ? await revisePrepObject(campaign.id, plan, data)
    : await createPrepObject(campaign.id, 'session-plan', data);

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

export async function activateSessionPlan(
  input: PublishSessionPlanInput,
): Promise<ActivatePlanResponse> {
  const published = await publishSessionPlan(input);
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
