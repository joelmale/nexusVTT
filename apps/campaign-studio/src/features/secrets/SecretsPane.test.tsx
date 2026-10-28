import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBundle, type CampaignFixtureBundle } from '@/demo/fixture-registry';
import { renderInSection } from '@/features/section-shell/testUtils';
import { SecretsPane } from './SecretsPane';

const baseFixture = getFixtureBundle('ashes-of-veyra')!;

function createTestBundle(): CampaignFixtureBundle {
  return {
    ...baseFixture,
    secrets: [
      {
        id: 'sec-1',
        campaignId: baseFixture.campaignId,
        text: 'The sunken temple holds the seal.',
        revealed: false,
        attachedTo: [{ kind: 'location', id: baseFixture.locations[0]?.id ?? 'loc-1' }],
      },
      {
        id: 'sec-2',
        campaignId: baseFixture.campaignId,
        text: 'The innkeeper is an exiled royal guard.',
        revealed: true,
        attachedTo: [{ kind: 'npc', id: baseFixture.npcs[0]?.id ?? 'npc-1' }],
      },
    ],
  };
}

describe('SecretsPane', () => {
  it('renders statistics and secrets list', () => {
    const bundle = createTestBundle();
    renderInSection(<SecretsPane />, {
      path: '/campaigns/test-c/notes?tab=secrets',
      store: { bundle, editable: false },
    });

    expect(screen.getByText('2')).toBeInTheDocument(); // total
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/sunken temple holds the seal/)).toBeInTheDocument();
    expect(screen.getByText(/innkeeper is an exiled royal guard/)).toBeInTheDocument();
  });

  it('filters by search query', async () => {
    const user = userEvent.setup();
    const bundle = createTestBundle();

    renderInSection(<SecretsPane />, {
      path: '/campaigns/test-c/notes?tab=secrets',
      store: { bundle, editable: false },
    });

    const searchBox = screen.getByRole('searchbox');
    await user.type(searchBox, 'innkeeper');

    expect(screen.getByText(/innkeeper is an exiled royal guard/)).toBeInTheDocument();
    expect(screen.queryByText(/sunken temple holds the seal/)).not.toBeInTheDocument();
  });

  it('adds a secret using Add Secret button and modal', async () => {
    const user = userEvent.setup();
    const bundle = createTestBundle();
    const addItem = vi.fn().mockResolvedValue({ ok: true, id: 'sec-new' });

    renderInSection(<SecretsPane />, {
      path: '/campaigns/test-c/notes?tab=secrets',
      store: { bundle, editable: true, addItem },
    });

    const addBtn = screen.getByRole('button', { name: /Add Secret/i });
    await user.click(addBtn);

    expect(screen.getByRole('heading', { name: 'New Secret / Clue' })).toBeInTheDocument();
    const textarea = screen.getByLabelText(/Secret or Clue/i);
    await user.type(textarea, 'A traitor lurks within the guard.');

    const saveBtn = screen.getByRole('button', { name: 'Create Secret' });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith('secret', expect.objectContaining({
        text: 'A traitor lurks within the guard.',
      }));
    });
  });

  it('toggles secret revealed status', async () => {
    const user = userEvent.setup();
    const bundle = createTestBundle();
    const updateItem = vi.fn().mockResolvedValue({ ok: true });

    renderInSection(<SecretsPane />, {
      path: '/campaigns/test-c/notes?tab=secrets',
      store: { bundle, editable: true, updateItem },
    });

    const toggleBtn = screen.getByRole('button', { name: 'Mark secret as revealed' });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(updateItem).toHaveBeenCalledWith('secret', 'sec-1', {
        revealed: true,
      });
    });
  });

  it('deletes secret', async () => {
    const user = userEvent.setup();
    const bundle = createTestBundle();
    const removeItem = vi.fn().mockResolvedValue({ ok: true });

    renderInSection(<SecretsPane />, {
      path: '/campaigns/test-c/notes?tab=secrets',
      store: { bundle, editable: true, removeItem },
    });

    const deleteBtns = screen.getAllByRole('button', { name: 'Delete secret' });
    await user.click(deleteBtns[0]);

    await waitFor(() => {
      expect(removeItem).toHaveBeenCalledWith('secret', 'sec-1');
    });
  });
});
