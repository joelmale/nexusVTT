import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as fixtureRegistry from '@/demo/fixture-registry';
import { renderSection } from '@/features/section-shell/testUtils';

import { participantTotal } from './encountersModels';

describe('EncountersSection', () => {
  it('shows composition, total, and Deploy fires the capability notice', async () => {
    const encounter = fixtureRegistry.getFixtureBundle('ashes-of-veyra')!.encounters[0];
    const { user } = renderSection(
      `/demo/ashes-of-veyra/encounters/${encounter.id}`,
      { singlePane: false },
    );
    const table = screen.getByRole('table');
    expect(
      within(table).getByText(encounter.composition[0].name),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('row', { name: /Total participants/ }),
    ).toHaveTextContent(String(participantTotal(encounter)));
    expect(screen.queryByRole('button', { name: /Add|Edit|New/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Deploy to VTT' }));
    expect(await screen.findByText('Deploy encounter')).toBeInTheDocument();
    expect(screen.getByText(/not connected to a VTT/)).toBeInTheDocument();
  });

  it('hides Deploy in complete campaigns', () => {
    const encounter = fixtureRegistry.getFixtureBundle('stars-below-kharad')!.encounters[0];
    renderSection(`/demo/stars-below-kharad/encounters/${encounter.id}`, {
      singlePane: false,
    });
    expect(screen.queryByRole('button', { name: 'Deploy to VTT' })).toBeNull();
  });

  it('renders every fixture list and the real-campaign empty state', () => {
    for (const slug of [
      'ashes-of-veyra',
      'crown-of-cinders',
      'lanterns-of-mourningfen',
      'stars-below-kharad',
    ]) {
      const { unmount } = renderSection(`/demo/${slug}/encounters`, {
        singlePane: false,
      });
      expect(
        screen.getByRole('navigation', { name: 'Encounter list' }),
      ).toBeInTheDocument();
      unmount();
    }
    renderSection('/campaigns/campaign-blank/encounters', {
      singlePane: false,
    });
    expect(screen.getByText('No encounters prepared.')).toBeInTheDocument();
  });

  it('renders a trap encounter with specification and empty hazard composition', () => {
    const ashes = fixtureRegistry.getFixtureBundle('ashes-of-veyra')!;
    const trapEncounter = {
      ...ashes.encounters[0],
      id: 'enc-lowering-ceiling',
      title: 'Spiked Ceiling Trap',
      kind: 'trap' as const,
      composition: [],
      trapDetails: {
        complexity: 'complex' as const,
        detectionDc: 15,
        disarmDc: 17,
        initiativeOrTimer: 'Initiative 20 & 10 (4 rounds)',
        saveOrAttack: 'DC 15 Dex save',
        effect: '4d10 piercing damage and restrained',
        countermeasures: 'Jam gears with iron spikes; press zodiac runes in sequence',
        reset: 'Manual winch in control room',
      },
    };
    const spy = vi.spyOn(fixtureRegistry, 'getFixtureBundle').mockImplementation((slug: string) => {
      if (slug === 'ashes-of-veyra') {
        return {
          ...ashes,
          encounters: [trapEncounter, ...ashes.encounters],
        };
      }
      return fixtureRegistry.getFixtureBundle(slug);
    });

    try {
      renderSection('/demo/ashes-of-veyra/encounters/enc-lowering-ceiling', {
        singlePane: false,
      });

      expect(screen.getByRole('heading', { name: 'Spiked Ceiling Trap' })).toBeInTheDocument();
      expect(screen.getAllByText('Trap / Puzzle').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Complex Trap')).toBeInTheDocument();
      expect(screen.getByText('Detection: DC 15')).toBeInTheDocument();
      expect(screen.getByText('Disarm: DC 17')).toBeInTheDocument();
      expect(screen.getByText('Timer/Initiative: Initiative 20 & 10 (4 rounds)')).toBeInTheDocument();
      expect(screen.getByText('Attack/Save: DC 15 Dex save')).toBeInTheDocument();
      expect(screen.getByText('4d10 piercing damage and restrained')).toBeInTheDocument();
      expect(screen.getByText('Jam gears with iron spikes; press zodiac runes in sequence')).toBeInTheDocument();
      expect(screen.getByText('Manual winch in control room')).toBeInTheDocument();
      expect(
        screen.getByText('Mechanical / environmental hazard with no hostile creatures.'),
      ).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});

