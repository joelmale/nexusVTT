import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { SectionContext } from '@/features/section-shell/SectionContext';
import type { BundleStore } from '@/features/section-shell/bundleStore';

import { QuickNpcModal } from './QuickNpcModal';

describe('QuickNpcModal', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  });

  function renderModal(props?: {
    open?: boolean;
    onClose?: () => void;
    onCreated?: (id: string) => void;
    mockStore?: Partial<BundleStore>;
  }) {
    const bundle = getFixtureBundle('ashes-of-veyra');
    const addItemMock = vi.fn().mockResolvedValue({ ok: true, id: 'npc-new-123' });
    const store: BundleStore = {
      bundle,
      editable: true,
      lastError: null,
      reload: vi.fn(),
      status: 'idle',
      updateItem: vi.fn(),
      addItem: addItemMock,
      ...props?.mockStore,
    };

    const onClose = props?.onClose ?? vi.fn();
    const onCreated = props?.onCreated ?? vi.fn();

    render(
      <SectionContext.Provider
        value={{
          basePath: '/campaigns/test',
          bundle,
          store,
        }}
      >
        <QuickNpcModal
          onClose={onClose}
          onCreated={onCreated}
          open={props?.open ?? true}
        />
      </SectionContext.Provider>,
    );

    return { addItemMock, onClose, onCreated };
  }

  it('renders procedural draft with default preset and rolls a new one on Roll Again', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByRole('heading', { name: 'Quick Roll NPC' })).toBeVisible();

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBeTruthy();

    const rollAgainButton = screen.getByRole('button', { name: /Roll Again/ });
    await user.click(rollAgainButton);

    // After reroll without locks, draft fields are present
    expect(screen.getByLabelText('Name')).toBeVisible();
  });

  it('preserves locked fields during reroll', async () => {
    const user = userEvent.setup();
    renderModal();

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, 'Locked Bob');

    // Click lock button for Name
    const lockNameButton = screen.getByTitle('Lock Name');
    await user.click(lockNameButton);
    expect(screen.getByTitle('Unlock Name')).toBeVisible();

    // Roll again
    const rollAgainButton = screen.getByRole('button', { name: /Roll Again/ });
    await user.click(rollAgainButton);

    // Name should remain 'Locked Bob'
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Locked Bob');

    // Unlock
    await user.click(screen.getByTitle('Unlock Name'));
    expect(screen.getByTitle('Lock Name')).toBeVisible();
  });

  it('updates combat summary when preset is changed', async () => {
    const user = userEvent.setup();
    renderModal();

    const presetSelect = screen.getByRole('combobox', {
      name: 'Combat & Defense Baseline',
    }) as HTMLSelectElement;
    await user.selectOptions(presetSelect, 'guard');

    expect(screen.getByText('HP: 16')).toBeVisible();
    expect(screen.getByText('AC: 16')).toBeVisible();
    expect(screen.getByText('CR: 1/8')).toBeVisible();
    expect(screen.getByText('Ref: guard')).toBeVisible();
  });

  it('submits procedural NPC and calls onCreated and onClose', async () => {
    const user = userEvent.setup();
    const { addItemMock, onCreated, onClose } = renderModal();

    const saveButton = screen.getByRole('button', { name: 'Add to Campaign' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(addItemMock).toHaveBeenCalledWith(
        'npc',
        expect.objectContaining({
          combatSummary: expect.objectContaining({
            hp: expect.any(Number),
            ac: expect.any(Number),
          }),
        }),
      );
      expect(onCreated).toHaveBeenCalledWith('npc-new-123');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays error if name is empty', async () => {
    const user = userEvent.setup();
    renderModal();

    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);

    const saveButton = screen.getByRole('button', { name: 'Add to Campaign' });
    await user.click(saveButton);

    expect(await screen.findByText('Name is required.')).toBeVisible();
  });
});
