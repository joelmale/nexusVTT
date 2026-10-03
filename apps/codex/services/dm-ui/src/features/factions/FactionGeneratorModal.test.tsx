import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { SectionContext } from '@/features/section-shell/SectionContext';
import type { BundleStore } from '@/features/section-shell/bundleStore';

import { FactionGeneratorModal } from './FactionGeneratorModal';

describe('FactionGeneratorModal', () => {
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
    onCreated?: (primaryFactionId: string) => void;
    mockStore?: Partial<BundleStore>;
  }) {
    const bundle = getFixtureBundle('ashes-of-veyra')!;
    let currentIdIndex = 1;
    const addItemMock = vi.fn().mockImplementation((kind: string) => {
      const id = `${kind}-gen-${currentIdIndex++}`;
      return Promise.resolve({ ok: true, id });
    });
    const updateItemMock = vi.fn().mockResolvedValue({ ok: true });

    const store: BundleStore = {
      bundle,
      editable: true,
      lastError: null,
      reload: vi.fn(),
      status: 'idle',
      updateItem: updateItemMock,
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
        <FactionGeneratorModal
          onClose={onClose}
          onCreated={onCreated}
          open={props?.open ?? true}
        />
      </SectionContext.Provider>,
    );

    return { addItemMock, updateItemMock, onClose, onCreated };
  }

  it('renders modal dialog with initial 3 factions and central flashpoint', () => {
    renderModal();

    expect(
      screen.getByRole('heading', { name: /Procedural Faction Generator/ }),
    ).toBeVisible();
    expect(screen.getByText(/Central Flashpoint:/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Reroll Ecosystem/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Add 3 Factions to Campaign/ })).toBeVisible();
  });

  it('allows changing count to 1 and hides flashpoint and relationship options', async () => {
    const user = userEvent.setup();
    renderModal();

    const countSelect = screen.getByLabelText(/Count/);
    await user.selectOptions(countSelect, '1');

    // Central flashpoint and multi-faction tabs should be hidden for count 1
    expect(screen.queryByText(/Central Flashpoint:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Relationship Web Graphic/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Faction to Campaign/ })).toBeVisible();
  });

  it('allows switching between Faction Profiles and Relationship Web Graphic tabs', async () => {
    const user = userEvent.setup();
    renderModal();

    const mapTab = screen.getByRole('button', { name: /Relationship Web Graphic/ });
    await user.click(mapTab);

    expect(screen.getByLabelText('Faction Ecosystem Relationship Web')).toBeVisible();

    const cardsTab = screen.getByRole('button', { name: /Faction Profiles/ });
    await user.click(cardsTab);

    expect(screen.queryByLabelText('Faction Ecosystem Relationship Web')).not.toBeInTheDocument();
  });

  it('rerolls ecosystem when Reroll button is clicked', async () => {
    const user = userEvent.setup();
    renderModal();

    const rerollButton = screen.getByRole('button', { name: /Reroll Ecosystem/ });
    await user.click(rerollButton);

    expect(screen.getByRole('button', { name: /Add 3 Factions to Campaign/ })).toBeVisible();
  });

  it('preserves locked faction during reroll', async () => {
    const user = userEvent.setup();
    renderModal();

    const inputs = screen.getAllByPlaceholderText('Faction Name');
    const firstInput = inputs[0] as HTMLInputElement;
    await user.clear(firstInput);
    await user.type(firstInput, 'Locked Test Syndicate');

    // Lock first faction
    const lockButtons = screen.getAllByTitle('Lock faction from rerolls');
    await user.click(lockButtons[0]);

    // Reroll ecosystem
    const rerollButton = screen.getByRole('button', { name: /Reroll Ecosystem/ });
    await user.click(rerollButton);

    // First input should remain 'Locked Test Syndicate'
    const updatedInputs = screen.getAllByPlaceholderText('Faction Name');
    expect((updatedInputs[0] as HTMLInputElement).value).toBe('Locked Test Syndicate');
  });

  it('allows rerolling a single faction independently', async () => {
    const user = userEvent.setup();
    renderModal();

    const singleRerollButtons = screen.getAllByTitle('Reroll only this faction');
    await user.click(singleRerollButtons[0]);

    expect(screen.getAllByPlaceholderText('Faction Name').length).toBe(3);
  });

  it('persists factions and key figures to campaign store on submit', async () => {
    const user = userEvent.setup();
    const { addItemMock, updateItemMock, onClose, onCreated } = renderModal();

    const submitButton = screen.getByRole('button', { name: /Add 3 Factions to Campaign/ });
    await user.click(submitButton);

    await waitFor(() => {
      // 3 factions created + key figures NPCs
      expect(addItemMock).toHaveBeenCalledWith('faction', expect.any(Object));
      expect(addItemMock).toHaveBeenCalledWith('npc', expect.any(Object));
      // Cross-linking relationships updated
      expect(updateItemMock).toHaveBeenCalledWith('faction', expect.any(String), expect.objectContaining({
        alliedFactionIds: expect.any(Array),
        rivalFactionIds: expect.any(Array),
      }));
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays validation error if faction name is cleared', async () => {
    const user = userEvent.setup();
    renderModal();

    const inputs = screen.getAllByPlaceholderText('Faction Name');
    await user.clear(inputs[0]);

    const submitButton = screen.getByRole('button', { name: /Add 3 Factions to Campaign/ });
    await user.click(submitButton);

    expect(screen.getByText('All factions must have a name.')).toBeVisible();
  });

  it('displays store error if faction addition fails', async () => {
    const user = userEvent.setup();
    const failingStore: Partial<BundleStore> = {
      addItem: vi.fn().mockResolvedValue({ ok: false, error: 'Database conflict on faction name' }),
    };

    renderModal({ mockStore: failingStore });

    const submitButton = screen.getByRole('button', { name: /Add 3 Factions to Campaign/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Database conflict on faction name')).toBeVisible();
    });
  });
});
