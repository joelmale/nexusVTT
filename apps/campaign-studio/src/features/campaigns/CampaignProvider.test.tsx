import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as campaignApi from '@/services/campaign-api';

import { useCampaignContext } from './CampaignContext';
import { CampaignProvider } from './CampaignProvider';

vi.mock('@/services/campaign-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/campaign-api')>();
  return { ...actual, listCampaigns: vi.fn() };
});

function Probe() {
  const context = useCampaignContext();
  return (
    <>
      <output aria-label="state">{context.state}</output>
      <output aria-label="active campaign">
        {context.activeCampaign?.name ?? 'none'}
      </output>
      <output aria-label="last campaign">
        {context.lastValidCampaignId ?? 'none'}
      </output>
    </>
  );
}

const campaigns: campaignApi.CampaignSummary[] = [
  {
    createdAt: '2026-01-01T00:00:00Z',
    description: null,
    id: 'campaign-one',
    name: 'One',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    createdAt: '2026-01-01T00:00:00Z',
    description: null,
    id: 'campaign-two',
    name: 'Two',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

describe('CampaignProvider', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.clearAllMocks();
  });

  it('derives the active campaign from the canonical route', async () => {
    vi.mocked(campaignApi.listCampaigns).mockResolvedValueOnce(campaigns);
    render(
      <MemoryRouter initialEntries={['/campaigns/campaign-two/overview']}>
        <CampaignProvider>
          <Probe />
        </CampaignProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('active campaign')).toHaveTextContent(
      'Two',
    );
    await waitFor(() => {
      expect(
        localStorage.getItem('nexus.campaign-studio.last-campaign-id'),
      ).toBe('campaign-two');
    });
  });

  it('replaces a stale remembered ID with the most recent valid campaign', async () => {
    localStorage.setItem(
      'nexus.campaign-studio.last-campaign-id',
      'deleted-campaign',
    );
    vi.mocked(campaignApi.listCampaigns).mockResolvedValueOnce(campaigns);
    render(
      <MemoryRouter initialEntries={['/']}>
        <CampaignProvider>
          <Probe />
        </CampaignProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('last campaign')).toHaveTextContent(
        'campaign-one',
      );
    });
  });

  it('reports authentication and retryable service failures separately', async () => {
    vi.mocked(campaignApi.listCampaigns).mockRejectedValueOnce(
      new campaignApi.CampaignApiError('Sign in', 401),
    );
    render(
      <MemoryRouter>
        <CampaignProvider>
          <Probe />
        </CampaignProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('state')).toHaveTextContent(
      'authentication-required',
    );
  });
});
