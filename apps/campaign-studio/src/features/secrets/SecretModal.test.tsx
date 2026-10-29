import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBundle, type CampaignSecret } from '@/demo/fixture-registry';
import { renderInSection } from '@/features/section-shell/testUtils';
import { SecretModal } from './SecretModal';

const bundle = getFixtureBundle('ashes-of-veyra')!;

describe('SecretModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = renderInSection(
      <SecretModal
        bundle={bundle}
        isOpen={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
      {
        path: '/demo/ashes-of-veyra/notes',
        store: { bundle, editable: true },
      },
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders creation form and submits new secret with attachments', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    renderInSection(
      <SecretModal
        bundle={bundle}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />,
      {
        path: '/demo/ashes-of-veyra/notes',
        store: { bundle, editable: true },
      },
    );

    expect(screen.getByRole('heading', { name: 'New Secret / Clue' })).toBeInTheDocument();

    const textarea = screen.getByLabelText(/Secret or Clue/i);
    await user.type(textarea, 'The cult meets under the old mill.');

    // Add an attachment (NPC)
    const attachBtn = screen.getByRole('button', { name: /Attach/i });
    await user.click(attachBtn);
    expect(screen.getByLabelText('Attached entities list')).toBeInTheDocument();

    // Check revealed checkbox
    const revealedCheck = screen.getByLabelText(/Revealed to players/i);
    await user.click(revealedCheck);

    // Save
    const saveBtn = screen.getByRole('button', { name: 'Create Secret' });
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith({
      id: undefined,
      text: 'The cult meets under the old mill.',
      attachedTo: expect.arrayContaining([
        expect.objectContaining({ kind: 'npc' }),
      ]),
      revealed: true,
      revealedInSessionId: undefined,
    });
  });

  it('populates initialSecret and saves changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    const existingSecret: CampaignSecret = {
      id: 'sec-42',
      campaignId: bundle.campaignId,
      text: 'Original secret text',
      revealed: false,
      attachedTo: [{ kind: 'npc', id: bundle.npcs[0]?.id ?? 'npc-1' }],
      revealedInSessionId: bundle.sessions[0]?.id,
    };

    renderInSection(
      <SecretModal
        bundle={bundle}
        initialSecret={existingSecret}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />,
      {
        path: '/demo/ashes-of-veyra/notes',
        store: { bundle, editable: true },
      },
    );

    expect(screen.getByRole('heading', { name: 'Edit Secret / Clue' })).toBeInTheDocument();
    const textarea = screen.getByLabelText(/Secret or Clue/i);
    expect(textarea).toHaveValue('Original secret text');

    // Remove existing attachment
    const removeBtn = screen.getByRole('button', { name: /Remove attachment/i });
    await user.click(removeBtn);
    expect(screen.queryByLabelText('Attached entities list')).not.toBeInTheDocument();

    // Update text
    await user.clear(textarea);
    await user.type(textarea, 'Updated secret text');

    // Submit
    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith({
      id: 'sec-42',
      text: 'Updated secret text',
      attachedTo: [],
      revealed: false,
      revealedInSessionId: bundle.sessions[0]?.id,
    });
  });

  it('calls onClose when close or cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderInSection(
      <SecretModal
        bundle={bundle}
        isOpen={true}
        onClose={onClose}
        onSave={vi.fn()}
      />,
      {
        path: '/demo/ashes-of-veyra/notes',
        store: { bundle, editable: true },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
