import {
  campaignObjectRefKey,
  type CampaignEntry,
  type CampaignObjectRef,
  type SceneTemplate,
  type SessionPlan,
  type SessionPlanStep,
} from '@nexus/game-contracts';

import type {
  EncounterMonsterStats,
  SessionStepViewModel,
} from '@/features/session-plan/sessionPlanModels';
import { mentionsToPlainText } from '@/lib/mentions';

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

export interface UserAsset {
  id: string;
  name: string;
  /** Path under the asset root, for example users/<id>/<file>. */
  fullImage?: string;
  category?: string;
  tags?: string[];
  thumbnail?: string;
  size?: number;
  source?: string;
  /** ISO timestamp; absent on assets uploaded before it was recorded. */
  createdAt?: string;
}

interface AuthoredObjectResponse {
  object: PrepObjectRecord;
}

export interface PublishResponse {
  plan: SessionPlan;
  published: true;
}

export interface PublishSessionPlanInput {
  planId?: string;
  sessionId?: string;
  authoring?: import('@/demo/ashes-of-veyra/types').SessionPlan;
  activationRequestId?: string;
  campaignId: string;
  campaignDescription?: string;
  campaignTitle: string;
  planTitle: string;
  revision: number;
  sceneMapPath?: string;
  mapAssetId?: string;
  steps: SessionStepViewModel[];
}

const DEFAULT_MAP_ASSET_NAME = 'Session Scene Map';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRequestErrorMessage(body: unknown, status: number): string {
  if (!isRecord(body)) return `Request failed with status ${status}`;
  if (typeof body.error === 'string') return body.error;

  if (isRecord(body.validation) && Array.isArray(body.validation.issues)) {
    const issue = body.validation.issues.find(isRecord);
    if (issue && typeof issue.message === 'string') {
      return typeof issue.path === 'string'
        ? `${issue.message} (${issue.path})`
        : issue.message;
    }
  }

  return `Request failed with status ${status}`;
}

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
    throw new Error(getRequestErrorMessage(body, response.status));
  }
  return body as T;
}

export class AuthenticationRequiredError extends Error {
  readonly code = 'authentication-required';

  constructor(
    message = 'Authentication required. Please sign in to Nexus VTT.',
  ) {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export async function ensureSession(): Promise<UserProfile> {
  const profileResponse = await fetch('/api/users/profile', {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (profileResponse.ok) {
    return (await profileResponse.json()) as UserProfile;
  }

  // Development-only bootstrapping: explicitly opt-in and dead-code-eliminated in production
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_DEV_AUTH_BOOTSTRAP === 'true'
  ) {
    const devEmail = import.meta.env.VITE_DEV_AUTH_EMAIL || 'dm@nexusvtt.local';
    const devPassword =
      import.meta.env.VITE_DEV_AUTH_PASSWORD || 'nexus-dev-password-123';

    try {
      await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: devEmail, password: devPassword }),
      });
    } catch {
      await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: devEmail,
          password: devPassword,
          displayName: 'Dungeon Master',
        }),
      });
    }
    return request<UserProfile>('/api/users/profile');
  }

  const body = (await profileResponse.json().catch(() => null)) as unknown;
  const message = getRequestErrorMessage(body, profileResponse.status);
  if (profileResponse.status === 401 || profileResponse.status === 403) {
    throw new AuthenticationRequiredError(
      message.includes('status')
        ? 'Authentication required. Please sign in to Nexus VTT.'
        : message,
    );
  }
  throw new Error(message);
}

export async function uploadAsset(
  userId: string,
  name: string,
  content: Blob,
  fileName: string,
  category: string,
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

/** What the asset service accepts for a map image (see its upload route). */
export const MAP_IMAGE_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
];
export const MAP_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Why a file cannot be uploaded as a map image, or undefined when it can. */
export function mapImageProblem(file: {
  type: string;
  size: number;
}): string | undefined {
  if (!MAP_IMAGE_TYPES.includes(file.type)) {
    return 'Use a PNG, JPEG or WebP image.';
  }
  if (file.size > MAP_IMAGE_MAX_BYTES) {
    return 'That image is over 5 MB. Choose a smaller image or export it as WebP.';
  }
  return undefined;
}

export interface UploadedMapImage {
  assetId: string;
  /** Path the image is served from. */
  url: string;
}

/**
 * Uploads a map image to the signed-in user's assets (category maps) and
 * returns the real asset id and the path it is served from.
 */
export async function uploadMapImage(
  file: File,
  name: string,
): Promise<UploadedMapImage> {
  const problem = mapImageProblem(file);
  if (problem) throw new Error(problem);
  const profile = await ensureSession();
  const asset = await uploadAsset(profile.id, name, file, file.name, 'maps');
  if (!asset.fullImage) {
    throw new Error('The server did not return where the image was saved.');
  }
  return { assetId: asset.id, url: `/${asset.fullImage.replace(/^\/+/, '')}` };
}

async function ensureTextAsset(
  userId: string,
  assets: UserAsset[],
  name: string,
  text: string,
  identity = name,
): Promise<UserAsset> {
  const assetName = `${name} [${await sourceDigest(`${identity}:${text}`)}]`;
  const existing = assets.find((asset) => asset.name === assetName);
  if (existing) return existing;
  const cleanText = mentionsToPlainText(text);
  const asset = await uploadAsset(
    userId,
    assetName,
    new Blob([cleanText || name], { type: 'text/plain' }),
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
  const response = await fetch(sceneMapPath);
  if (!response.ok) throw new Error('The session scene map is unavailable.');
  const content = await response.blob();
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    await content.arrayBuffer(),
  );
  const contentKey = Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const assetName = `${DEFAULT_MAP_ASSET_NAME} [${await sourceDigest(`${sceneMapPath}:${contentKey}`)}]`;
  const existing = assets.find((asset) => asset.name === assetName);
  if (existing) return existing;
  const asset = await uploadAsset(
    userId,
    assetName,
    content,
    'session-scene-map.png',
    'maps',
  );
  assets.push(asset);
  return asset;
}

async function sourceDigest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function sourceUuid(value: string): Promise<string> {
  const hex = await sourceDigest(value);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
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
  if (step.objectId) {
    const linked = existingObjects.find(
      (object) => object.id === step.objectId,
    );
    if (!linked)
      throw new Error(
        `Link the missing campaign object for "${step.title}" before publishing.`,
      );
    return linked;
  }
  const objectId = await sourceUuid(`entry:${campaignId}:${step.id}`);
  const existing = existingObjects.find(
    (object) => object.kind === 'note' && object.id === objectId,
  );
  const data: CampaignEntry = {
    id: existing?.id ?? objectId,
    campaignId,
    schemaVersion: 1,
    revision: existing ? existing.currentRevision + 1 : 1,
    kind: 'note',
    title: step.title,
    visibility: step.visibility === 'shared' ? 'players' : 'dm-only',
    content: lexicalContent(mentionsToPlainText(step.body || step.title)),
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
  sourceKey = title,
  sceneIdOverride?: string,
): Promise<PrepObjectRecord> {
  const sceneId =
    sceneIdOverride || (await sourceUuid(`scene:${campaignId}:${sourceKey}`));
  const existing = existingObjects.find(
    (object) => object.kind === 'scene-template' && object.id === sceneId,
  );
  if (existing) {
    const detail = await request<{ revision: { data: SceneTemplate } }>(
      `/api/campaigns/${campaignId}/prep/objects/${existing.id}`,
    );
    if (detail.revision.data.backgroundAssetRef.assetId === mapAsset.id)
      return existing;
    return revisePrepObject(campaignId, existing, {
      ...detail.revision.data,
      revision: existing.currentRevision + 1,
      backgroundAssetRef: { target: 'asset', assetId: mapAsset.id },
      updatedAt: now,
    });
  }
  const data: SceneTemplate = {
    id: sceneId,
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

export interface CreateSceneTemplateInput {
  campaignId: string;
  mapTitle: string;
  assetId?: string;
  pinLabel?: string;
  grid?: {
    enabled?: boolean;
    type?: 'square' | 'hex';
    size?: number;
    offsetX?: number;
    offsetY?: number;
    snapToGrid?: boolean;
  };
  lighting?: {
    enabled?: boolean;
    globalIllumination?: boolean;
    ambientLight?: number;
    darkness?: number;
  };
  fogPreset?: {
    mode?: 'off' | 'concealed';
    preset?: 'clear' | 'unexplored' | 'full' | 'custom';
    revealedShapes?: unknown[];
  };
}

/**
 * Creates a new scene template from an authored campaign map.
 */
export async function createSceneTemplateFromMap(
  input: CreateSceneTemplateInput,
): Promise<PrepObjectRecord> {
  await ensureSession();
  const now = new Date().toISOString();
  const sceneTitle = input.pinLabel
    ? `${input.mapTitle} - ${input.pinLabel}`
    : input.mapTitle;
  const assetId = input.assetId ?? 'demo-map-scene';
  const fogMode =
    input.fogPreset?.mode ??
    (input.fogPreset?.preset === 'clear' ? 'off' : 'concealed');
  const data: SceneTemplate = {
    id: crypto.randomUUID(),
    campaignId: input.campaignId,
    schemaVersion: 1,
    revision: 1,
    name: sceneTitle,
    backgroundAssetRef: { target: 'asset', assetId },
    grid: {
      enabled: input.grid?.enabled ?? true,
      type: input.grid?.type ?? 'square',
      size: input.grid?.size ?? 100,
      offsetX: input.grid?.offsetX ?? 0,
      offsetY: input.grid?.offsetY ?? 0,
      snapToGrid: input.grid?.snapToGrid ?? true,
    },
    lighting: {
      enabled: input.lighting?.enabled ?? true,
      globalIllumination: input.lighting?.globalIllumination ?? false,
      ambientLight: input.lighting?.ambientLight ?? 0.35,
      darkness: input.lighting?.darkness ?? 0.65,
    },
    fogPreset: {
      mode: fogMode,
      revealedShapes: (input.fogPreset?.revealedShapes as unknown[]) ?? [],
    },
    createdAt: now,
    updatedAt: now,
  };
  return createPrepObject(input.campaignId, 'scene-template', data);
}

export interface MaterializedEncounterRef {
  encounterRef: { kind: 'encounter'; id: string; revision: number };
  monsterCount: number;
  created: boolean;
}

/**
 * Publishes an authored encounter as the library definitions the VTT deploys
 * from, and returns the pinned ref for a deploy-encounter step. Idempotent.
 */
export async function materializeEncounter(
  campaignId: string,
  encounterId: string,
  monsters: EncounterMonsterStats[],
): Promise<MaterializedEncounterRef> {
  return request<MaterializedEncounterRef>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/prep/encounters/${encodeURIComponent(encounterId)}/materialize`,
    { method: 'POST', body: JSON.stringify({ monsters }) },
  );
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

    if (step.command === 'Activate scene') {
      const existingScene = existingObjects.find(
        (object) =>
          object.kind === 'scene-template' &&
          object.id === step.sceneTemplateId,
      );
      if (
        existingScene &&
        !step.mapAssetId &&
        !step.mapImagePath &&
        !input.mapAssetId &&
        !input.sceneMapPath
      ) {
        result.push({
          ...base,
          type: 'activate-scene',
          sceneTemplateRef: campaignObjectRef(campaignId, existingScene),
        });
        continue;
      }

      const assetId = step.mapAssetId || input.mapAssetId;
      const mapPath = step.mapImagePath || input.sceneMapPath;
      const mapAsset =
        assetId &&
        !assetId.startsWith('default-map-') &&
        !assetId.startsWith('demo-')
          ? { id: assetId, name: step.title }
          : mapPath
            ? await ensureMapAsset(userId, assets, mapPath)
            : undefined;

      if (mapAsset) {
        const scene = await ensureScene(
          campaignId,
          existingObjects,
          mapAsset,
          step.title,
          now,
          step.objectId || step.id,
          step.sceneTemplateId,
        );
        result.push({
          ...base,
          type: 'activate-scene',
          sceneTemplateRef: campaignObjectRef(campaignId, scene),
        });
        continue;
      }
      throw new Error(
        `Select a map or linked scene for "${step.title}" before publishing.`,
      );
    }

    if (step.command === 'Deploy encounter') {
      if (!step.encounterId)
        throw new Error(
          `Select the encounter for "${step.title}" before publishing.`,
        );
      const { encounterRef } = await materializeEncounter(
        campaignId,
        step.encounterId,
        step.encounterMonsters ?? [],
      );
      result.push({ ...base, type: 'deploy-encounter', encounterRef });
      continue;
    }

    if (step.command === 'Share handout') {
      const asset = await ensureTextAsset(
        userId,
        assets,
        step.title,
        mentionsToPlainText(step.handoutBody ?? step.body ?? step.title),
        `${campaignId}:${step.objectId || step.id}`,
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
      text: mentionsToPlainText(step.body || step.title),
    });
  }

  return result;
}

function getSessionPlanDependencies(
  steps: SessionPlanStep[],
): CampaignObjectRef[] {
  const dependencies: CampaignObjectRef[] = [];
  const dependencyKeys = new Set<string>();

  for (const step of steps) {
    let reference: CampaignObjectRef | undefined;

    switch (step.type) {
      case 'open-entry':
        reference = step.entryRef;
        break;
      case 'activate-scene':
        reference = step.sceneTemplateRef;
        break;
      case 'deploy-encounter':
        reference = { target: 'definition', ref: step.encounterRef };
        break;
      case 'share-handout':
        reference = step.assetRef;
        break;
      case 'reminder':
        break;
    }

    if (!reference) continue;
    const key = campaignObjectRefKey(reference);
    if (dependencyKeys.has(key)) continue;
    dependencyKeys.add(key);
    dependencies.push(reference);
  }

  return dependencies;
}

export async function publishSessionPlan(
  input: PublishSessionPlanInput,
): Promise<PublishResponse> {
  const profile = await ensureSession();
  const campaignId = input.campaignId;
  const [assetResponse, objectResponse] = await Promise.all([
    request<{ assets: UserAsset[] }>(
      `/api/user/${encodeURIComponent(profile.id)}/assets`,
    ),
    request<{ objects: PrepObjectRecord[] }>(
      `/api/campaigns/${campaignId}/prep/objects`,
    ),
  ]);
  const now = new Date().toISOString();
  const steps = await buildContractSteps(
    input,
    campaignId,
    profile.id,
    assetResponse.assets,
    objectResponse.objects,
    now,
  );
  let plan = await resolvePlanObject(input, objectResponse.objects);
  if (plan && input.planId && plan.currentRevision !== input.revision) {
    throw new Error(
      'This plan changed elsewhere. Reload the current revision before publishing.',
    );
  }

  const planId = plan?.id ?? crypto.randomUUID();
  const revision = plan ? plan.currentRevision + 1 : 1;
  const data: SessionPlan = {
    id: planId,
    campaignId,
    schemaVersion: 1,
    revision,
    title: input.planTitle,
    status: 'draft',
    steps,
    dependencies: getSessionPlanDependencies(steps),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.authoring
      ? {
          authoring: {
            ...input.authoring,
            version: 1,
            defaultVisibility: input.authoring.defaultVisibility ?? 'dm-only',
          },
        }
      : {}),
    createdAt: now,
    updatedAt: now,
  };

  if (!plan) {
    plan = await createPrepObject(campaignId, 'session-plan', data);
  }

  return request<PublishResponse>(
    `/api/campaigns/${campaignId}/prep/objects/${plan.id}/publish`,
    {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: plan.currentRevision,
        requestId: crypto.randomUUID(),
        ...(plan.currentRevision < revision ? { data } : {}),
      }),
    },
  );
}

export interface SessionPlanStatus {
  planId?: string;
  campaignId?: string;
  status: 'draft' | 'ready' | 'none';
  revision?: number;
  published: boolean;
  activeSessionId?: string;
  isActivated?: boolean;
}

export async function fetchSessionPlanStatus(input: {
  campaignId: string;
  planTitle?: string;
  sessionId?: string;
  planId?: string;
}): Promise<SessionPlanStatus> {
  await ensureSession();
  const objectResponse = await request<{ objects: PrepObjectRecord[] }>(
    `/api/campaigns/${input.campaignId}/prep/objects?kind=session-plan`,
  );
  const plan = await resolvePlanObject(input, objectResponse.objects);
  if (!plan) {
    return {
      campaignId: input.campaignId,
      status: 'draft',
      published: false,
    };
  }

  const activeRes = await request<{
    activation?: {
      id: string;
      sessionId: string;
      sessionPlanId: string;
      status: string;
    };
  }>(`/api/campaigns/${input.campaignId}/session-plans/active`).catch(
    () => null,
  );

  const isActivated =
    activeRes?.activation?.sessionPlanId === plan.id &&
    activeRes.activation.status === 'active';

  return {
    planId: plan.id,
    campaignId: input.campaignId,
    status: plan.status === 'ready' ? 'ready' : 'draft',
    revision: plan.currentRevision,
    published: plan.status === 'ready',
    activeSessionId: activeRes?.activation?.sessionId,
    isActivated,
  };
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
  await ensureSession();
  const objectResponse = await request<{ objects: PrepObjectRecord[] }>(
    `/api/campaigns/${input.campaignId}/prep/objects?kind=session-plan`,
  );
  const existingPlan = await resolvePlanObject(input, objectResponse.objects);
  if (
    (input.planId || input.sessionId) &&
    (!existingPlan ||
      existingPlan.status !== 'ready' ||
      existingPlan.currentRevision !== input.revision)
  ) {
    throw new Error('Publish the current draft before playing it in VTT.');
  }

  // If the plan is already published (ready), activate without creating a new revision
  if (existingPlan && existingPlan.status === 'ready') {
    return request<ActivatePlanResponse>(
      `/api/campaigns/${input.campaignId}/session-plans/${existingPlan.id}/activate`,
      {
        method: 'POST',
        body: JSON.stringify({
          planRevision: existingPlan.currentRevision,
          requestId: input.activationRequestId ?? crypto.randomUUID(),
        }),
      },
    );
  }

  // Not yet published: publish first, then activate
  const published = await publishSessionPlan(input);
  return request<ActivatePlanResponse>(
    `/api/campaigns/${published.plan.campaignId}/session-plans/${published.plan.id}/activate`,
    {
      method: 'POST',
      body: JSON.stringify({
        planRevision: published.plan.revision,
        requestId: input.activationRequestId ?? crypto.randomUUID(),
      }),
    },
  );
}

/** Modern callers resolve a linked identity; title recovery is legacy-only and
 * refuses ambiguous labels instead of attaching another session's plan. */
async function resolvePlanObject(
  input: {
    campaignId: string;
    planId?: string;
    sessionId?: string;
    planTitle?: string;
  },
  objects: PrepObjectRecord[],
): Promise<PrepObjectRecord | undefined> {
  let planId = input.planId;
  if (!planId && input.sessionId) {
    const detail = await request<{ revision: { data: unknown } }>(
      `/api/campaigns/${input.campaignId}/prep/objects/${input.sessionId}`,
    );
    const data = detail.revision.data;
    if (
      isRecord(data) &&
      isRecord(data.content) &&
      isRecord(data.content.value) &&
      isRecord(data.content.value.nexusStudio) &&
      isRecord(data.content.value.nexusStudio.fields)
    ) {
      const candidate = data.content.value.nexusStudio.fields.planId;
      if (typeof candidate === 'string') planId = candidate;
    }
    if (!planId) return undefined;
  }
  if (planId)
    return objects.find(
      (object) => object.kind === 'session-plan' && object.id === planId,
    );
  const matches = objects.filter(
    (object) =>
      object.kind === 'session-plan' && object.title === input.planTitle,
  );
  if (matches.length > 1)
    throw new Error(
      'Several session plans share this title. Select the linked session plan before continuing.',
    );
  return matches[0];
}
