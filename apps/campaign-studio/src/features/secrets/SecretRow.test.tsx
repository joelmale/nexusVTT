import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBundle, type CampaignSecret } from '@/demo/fixture-registry';
import { renderInSection } from '@/features/section-shell/testUtils';
import { SecretRow } from './SecretRow';

const bundle = getFixtureBundle('ashes-of-veyra')!;

const testSecret: CampaignSecret = {
  id: 'sec-1',
  campaignId: bundle.campaignId,
  text: 'The mayor has a secret key to the sunken vault.',
  revealed: false,
  attachedTo: [
    { kind: 'npc', id: bundle.npcs[0]?.id ?? 'npc-1' },
    { kind: 'location', id: bundle.locations[0]?.id ?? 'loc-1' },
  ],
  revealedInSessionId: bundle.sessions[0]?.id,
};

describe('SecretRow', () => {
  it('renders unrevealed secret with attachments and session link', () => {
    renderInSection(
      <SecretRow
        basePath="/demo/ashes-of-veyra"
        bundle={bundle}
        editable={false}
        secret={testSecret}
      />,
      {
        path: '/demo/ashes-of-veyra/notes',
        store: { bundle, editable: false },
      },
    );

    expect(screen.getByText(/secret key to the sunken vault/)).toBeInTheDocument();
    expect(screen.getByText('Unrevealed')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Session ${bundle.sessions[0]?.number}`))).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Attached entities' })).toBeInTheDocument();
  });

  it('renders revealed secret and toggle button when onToggleRevealed is passed', () => {
    const revealedSecret: CampaignSecret = {
      ...testSecret,
      revealed: true,
    };

    renderInSection(
      <SecretRow
        basePath="/demo/ashes-of-veyra"
        bundle={bundle}
        editable={true}
        onToggleRevealed={vi.fn()}
        secret={revealedSecret}
      />,
      {
        path: '/demo/ashes-of-veyra/notes',
        store: { bundle, editable: true },
      },
    );

    expect(screen.getByText('Revealed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark secret as unrevealed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Session/i })).toBeInTheDocument();
  });

  it('triggers onToggleRevealed, onEdit, and onDelete in editable mode', async () => {
    const user = userEvent.setup();
    const onToggleRevealed = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    renderInSection(
      <SecretRow
        basePath="/demo/ashes-of-veyra"
        bundle={bundle}
        editable={true}
        onDelete={onDelete}
        onEdit={onEdit}
        onToggleRevealed={onToggleRevealed}
        secret={testSecret}
      />,
      {
        path: '/demo/ashes-of-veyra/notes',
        store: { bundle, editable: true },
      },
    );

    const toggleBtn = screen.getByRole('button', { name: 'Mark secret as revealed' });
    await user.click(toggleBtn);
    expect(onToggleRevealed).toHaveBeenCalledWith(testSecret);

    const editBtn = screen.getByRole('button', { name: 'Edit secret' });
    await user.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(testSecret);

    const deleteBtn = screen.getByRole('button', { name: 'Delete secret' });
    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(testSecret);
  });
});
