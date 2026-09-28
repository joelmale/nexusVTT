export interface CampaignSummary {
  createdAt: string;
  description: string | null;
  id: string;
  name: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  description?: string;
  name: string;
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
  const body = await campaignRequest('/api/campaigns');
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
      }),
      method: 'POST',
    }),
  );
}
