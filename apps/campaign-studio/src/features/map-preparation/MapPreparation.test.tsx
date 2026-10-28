import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { MapPreparationViewModel } from './mapPreparationModels';
import { MapPreparation } from './MapPreparation';

const model: MapPreparationViewModel = {
  id: 'map-1',
  imagePath: '/map.png',
  layers: [{ id: 'locations', label: 'Locations', visible: true }],
  availableObjects: [
    {
      id: 'npc-2',
      kind: 'NPC',
      subtitle: 'Watch Captain',
      title: 'Theron Vane',
    },
    {
      id: 'enc-1',
      kind: 'Encounter',
      subtitle: 'Hard',
      title: 'Harbor Ambush',
    },
  ],
  locations: [
    {
      description: ['Old stone offices watch the quay.'],
      id: 'customs',
      linkedObjects: [
        {
          id: 'npc-1',
          kind: 'NPC',
          subtitle: 'Harbor Master',
          title: 'Captain Serin',
        },
      ],
      name: 'Old Customs House',
      notes: 'The lower stair is unlisted.',
      shortDescription: 'A weathered government office.',
      tags: ['Government'],
      typeLabel: 'government',
    },
    {
      description: ['The tide knocks against the pilings.'],
      id: 'pier',
      linkedObjects: [],
      name: 'South Pier',
      notes: 'Watch changes at dusk.',
      shortDescription: 'A deep-water pier.',
      tags: ['Pier'],
      typeLabel: 'pier',
    },
  ],
  pins: [
    {
      id: 'pin-1',
      label: 'Old Customs House',
      layerIds: ['locations'],
      locationId: 'customs',
      x: 0.4,
      y: 0.4,
      visibility: 'players',
      color: '#22c55e',
      linkedObjects: [
        {
          id: 'npc-1',
          kind: 'NPC',
          subtitle: 'Harbor Master',
          title: 'Captain Serin',
        },
      ],
    },
    {
      id: 'pin-2',
      label: 'South Pier',
      layerIds: ['locations'],
      locationId: 'pier',
      x: 0.7,
      y: 0.7,
      visibility: 'players',
      color: '#3b82f6',
    },
  ],
  selectedPinId: 'pin-1',
  title: 'Glass Harbor',
};

describe('MapPreparation', () => {
  it('updates the inspector when a location is selected', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={vi.fn()} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Old Customs House' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Open South Pier details' }),
    );
    expect(
      screen.getByRole('heading', { name: 'South Pier' }),
    ).toBeInTheDocument();
  });

  it('toggles layers and sends planned map commands to the registry callback', async () => {
    const user = userEvent.setup();
    const onCapability = vi.fn();
    render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={onCapability} />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Locations', pressed: true }),
    );
    expect(
      screen.queryByRole('button', { name: 'Select Old Customs House' }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: /add pin/i }));
    expect(onCapability).toHaveBeenCalledWith('map.pin.create');
  });

  it('edits pin label and saves changes via onSave callback', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={vi.fn()} onSave={onSave} />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText('Pin Label');
    await user.clear(input);
    await user.type(input, 'Renamed Customs House');

    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    // leaving the field saves immediately
    await user.tab();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedPayload = onSave.mock.calls[0][0];
    expect(savedPayload.pins[0].label).toBe('Renamed Customs House');
  });

  it('nudges pin position with keyboard arrow keys', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={vi.fn()} onSave={onSave} />
      </MemoryRouter>,
    );

    const pinButton = screen.getByRole('button', {
      name: 'Select Old Customs House',
    });
    pinButton.focus();

    // ArrowRight nudges X by +0.01 (from 0.400 to 0.410)
    fireEvent.keyDown(pinButton, { key: 'ArrowRight' });

    // debounced autosave
    await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 3000 });
    const savedPin = onSave.mock.calls[0][0].pins[0];
    expect(savedPin.x).toBe(0.41);
  });

  it('serializes saves made while one is in flight', async () => {
    const user = userEvent.setup();
    const resolvers: Array<() => void> = [];
    const onSave = vi.fn(() => new Promise<void>((r) => resolvers.push(r)));
    render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={vi.fn()} onSave={onSave} />
      </MemoryRouter>,
    );
    const input = screen.getByLabelText('Pin Label');
    await user.type(input, 'A');
    await user.tab();
    expect(onSave).toHaveBeenCalledTimes(1);

    await user.click(input);
    await user.type(input, 'B');
    await user.tab();
    expect(onSave).toHaveBeenCalledTimes(1);

    resolvers[0]();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0].pins[0].label).toMatch(/AB$/);
    resolvers[1]();
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('flushes unsaved edits on unmount', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={vi.fn()} onSave={onSave} />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Pin Label'), '!');
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows an error with retry when saving fails', async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={vi.fn()} onSave={onSave} />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Pin Label'), '!');
    await user.tab();
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('renders headerActions in the editor header', () => {
    render(
      <MemoryRouter>
        <MapPreparation
          headerActions={<button type="button">Remove map</button>}
          model={model}
          onCapability={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Remove map' })).toBeVisible();
  });

  it('deletes selected pin when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Select Old Customs House' })).toBeInTheDocument();
    const deleteButton = screen.getByRole('button', { name: /delete pin/i });
    await user.click(deleteButton);

    expect(screen.queryByRole('button', { name: 'Select Old Customs House' })).toBeNull();
  });

  it('opens object modal and links a campaign object to the selected pin', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MapPreparation model={model} onCapability={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /link existing object/i }));
    expect(screen.getByText('Link Object to Pin')).toBeInTheDocument();

    const option = screen.getByText('Theron Vane');
    await user.click(option);

    expect(screen.queryByText('Link Object to Pin')).toBeNull();
    expect(screen.getByText('Theron Vane')).toBeInTheDocument();

    // Unlink the newly added object
    const unlinkButton = screen.getByRole('button', { name: 'Unlink Theron Vane' });
    await user.click(unlinkButton);
    expect(screen.queryByText('Theron Vane')).toBeNull();
  });

  it('invokes onCreateScene when Create Scene is clicked', async () => {
    const user = userEvent.setup();
    const onCreateScene = vi.fn();
    render(
      <MemoryRouter>
        <MapPreparation
          model={model}
          onCapability={vi.fn()}
          onCreateScene={onCreateScene}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /create scene/i }));
    expect(onCreateScene).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'map-1' }),
      expect.objectContaining({ id: 'pin-1' }),
    );
  });

  it('allows creating and linking a new location inline from the object modal', async () => {
    const user = userEvent.setup();
    const onCreateLocation = vi
      .fn()
      .mockResolvedValue({ id: 'loc-new-1', title: 'Rusty Anchor Tavern' });

    render(
      <MemoryRouter>
        <MapPreparation
          model={model}
          onCapability={vi.fn()}
          onCreateLocation={onCreateLocation}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /link existing object/i }));
    expect(screen.getByText('Link Object to Pin')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create new location/i }));
    const nameInput = screen.getByPlaceholderText('New location name...');
    await user.type(nameInput, 'Rusty Anchor Tavern');
    await user.click(screen.getByRole('button', { name: /create & link/i }));

    expect(onCreateLocation).toHaveBeenCalledWith('Rusty Anchor Tavern');
    expect(screen.getByText('Rusty Anchor Tavern')).toBeInTheDocument();
  });
});
