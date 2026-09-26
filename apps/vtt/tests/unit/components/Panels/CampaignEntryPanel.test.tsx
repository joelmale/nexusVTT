import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignEntryPanel } from '../../../../src/components/Panels/CampaignEntryPanel';
import { campaignPrepClient } from '../../../../src/services/campaignPrepClient';
import type { ObjectLink } from '../../../../src/services/panelRegistry';

vi.mock('../../../../src/services/campaignPrepClient', () => ({
  campaignPrepClient: {
    getCampaignEntry: vi.fn(),
  },
}));

const link: ObjectLink = {
  kind: 'campaign-entry',
  id: 'entry-1',
  campaignId: 'campaign-1',
  title: 'Campaign Entry',
};

describe('CampaignEntryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders text and tags from a campaign entry', async () => {
    vi.mocked(campaignPrepClient.getCampaignEntry).mockResolvedValueOnce({
      object: { id: 'entry-1', kind: 'note', title: 'Captain Serin' },
      revision: {
        data: {
          id: 'entry-1',
          campaignId: 'campaign-1',
          schemaVersion: 1,
          revision: 1,
          kind: 'note',
          title: 'Captain Serin',
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
                      { type: 'text', text: 'Trust no ship at dusk.' },
                    ],
                  },
                ],
              },
            },
          },
          links: [],
          tags: ['npc', 'harbor'],
          createdAt: '2026-09-25T12:00:00.000Z',
          updatedAt: '2026-09-25T12:00:00.000Z',
        },
      },
    });

    render(
      <CampaignEntryPanel isPopout={false} link={link} onClose={vi.fn()} />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Captain Serin' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Trust no ship at dusk.')).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Campaign entry tags' }),
    ).toHaveTextContent('npc');
  });

  it('shows the API error when the entry cannot be loaded', async () => {
    vi.mocked(campaignPrepClient.getCampaignEntry).mockRejectedValueOnce(
      new Error('Entry no longer exists'),
    );

    render(
      <CampaignEntryPanel isPopout={false} link={link} onClose={vi.fn()} />,
    );

    expect(
      await screen.findByText('Entry no longer exists'),
    ).toBeInTheDocument();
  });
});
