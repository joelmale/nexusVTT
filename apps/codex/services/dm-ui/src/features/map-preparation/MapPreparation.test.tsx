import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { MapPreparationViewModel } from './mapPreparationModels';
import { MapPreparation } from './MapPreparation';

const model: MapPreparationViewModel = {
  id: 'map-1',
  imagePath: '/map.png',
  layers: [{ id: 'locations', label: 'Locations', visible: true }],
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
    },
    {
      id: 'pin-2',
      label: 'South Pier',
      layerIds: ['locations'],
      locationId: 'pier',
      x: 0.7,
      y: 0.7,
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
});
