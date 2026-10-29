export type CampaignRole = 'owner' | 'co-dm';

export interface CampaignSummary {
  createdAt: string;
  description: string | null;
  id: string;
  name: string;
  updatedAt: string;
  edition?: string;
  mode?: 'campaign' | 'one-shot';
  mood?: string | null;
  /** The signed-in user's role; absent means the user owns the campaign. */
  role?: CampaignRole;
}

export interface CreateCampaignInput {
  description?: string;
  name: string;
  edition?: string;
  mode?: 'campaign' | 'one-shot';
  mood?: string;
}

export class CampaignApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CampaignApiError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCampaign(value: unknown): CampaignSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string'
  ) {
    throw new Error('The campaign service returned an invalid campaign.');
  }

  return {
    createdAt:
      typeof value.createdAt === 'string'
        ? value.createdAt
        : new Date(0).toISOString(),
    description:
      typeof value.description === 'string' ? value.description : null,
    id: value.id,
    name: value.name,
    edition: typeof value.edition === 'string' ? value.edition : '2024',
    mode: value.mode === 'one-shot' ? 'one-shot' : 'campaign',
    mood: typeof value.mood === 'string' ? value.mood : null,
    role: value.role === 'co-dm' ? 'co-dm' : 'owner',
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : typeof value.createdAt === 'string'
          ? value.createdAt
          : new Date(0).toISOString(),
  };
}

function errorMessage(body: unknown, status: number): string {
  if (isRecord(body) && typeof body.error === 'string') return body.error;
  if (status === 401 || status === 403) {
    return 'Sign in to Nexus VTT to manage campaigns.';
  }
  return 'The campaign service is unavailable. Please try again.';
}

async function campaignRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
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
    throw new CampaignApiError(
      errorMessage(body, response.status),
      response.status,
    );
  }
  return body;
}

function byMostRecentlyUpdated(
  left: CampaignSummary,
  right: CampaignSummary,
): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const body = await campaignRequest('/api/campaigns?include=shared');
  if (!Array.isArray(body)) {
    throw new Error('The campaign service returned an invalid campaign list.');
  }
  return body.map(parseCampaign).sort(byMostRecentlyUpdated);
}

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<CampaignSummary> {
  const name = input.name.trim();
  if (!name) throw new Error('Campaign name is required.');

  return parseCampaign(
    await campaignRequest('/api/campaigns', {
      body: JSON.stringify({
        name,
        ...(input.description?.trim()
          ? { description: input.description.trim() }
          : {}),
        ...(input.edition ? { edition: input.edition } : {}),
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.mood ? { mood: input.mood } : {}),
      }),
      method: 'POST',
    }),
  );
}

export async function updateCampaign(
  id: string,
  updates: Partial<
    Pick<CampaignSummary, 'name' | 'description' | 'edition' | 'mode' | 'mood'>
  >,
): Promise<void> {
  await campaignRequest(`/api/campaigns/${encodeURIComponent(id)}`, {
    body: JSON.stringify(updates),
    method: 'PUT',
  });
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const id = campaignId.trim();
  if (!id) throw new Error('Campaign ID is required.');
  await campaignRequest(`/api/campaigns/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export interface CampaignMember {
  userId: string;
  name: string;
  email: string | null;
  role: CampaignRole;
}

export interface CampaignMembers {
  /** The signed-in user's role in this campaign. */
  role: CampaignRole;
  members: CampaignMember[];
}

function parseMembers(value: unknown): CampaignMembers {
  if (!isRecord(value) || !Array.isArray(value.members)) {
    throw new Error('The campaign service returned an invalid member list.');
  }
  return {
    role: value.role === 'owner' ? 'owner' : 'co-dm',
    members: value.members.filter(isRecord).map((member) => ({
      userId: String(member.userId),
      name: typeof member.name === 'string' ? member.name : 'Unknown',
      email: typeof member.email === 'string' ? member.email : null,
      role: member.role === 'owner' ? 'owner' : 'co-dm',
    })),
  };
}

function membersPath(campaignId: string): string {
  return `/api/campaigns/${encodeURIComponent(campaignId)}/members`;
}

export async function listCampaignMembers(
  campaignId: string,
): Promise<CampaignMembers> {
  return parseMembers(await campaignRequest(membersPath(campaignId)));
}

/** Owner only. The email must belong to an existing, non-guest account. */
export async function inviteCampaignMember(
  campaignId: string,
  email: string,
): Promise<CampaignMembers> {
  return parseMembers(
    await campaignRequest(membersPath(campaignId), {
      body: JSON.stringify({ email: email.trim() }),
      method: 'POST',
    }),
  );
}

/** Owner only. */
export async function removeCampaignMember(
  campaignId: string,
  userId: string,
): Promise<CampaignMembers> {
  return parseMembers(
    await campaignRequest(
      `${membersPath(campaignId)}/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    ),
  );
}
