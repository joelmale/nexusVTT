import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import { renderSection } from '@/features/section-shell/testUtils';

import { participantTotal } from './encountersModels';

describe('EncountersSection', () => {
  it('shows composition, total, and Deploy fires the capability notice', async () => {
    const encounter = getFixtureBundle('ashes-of-veyra')!.encounters[0];
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
    const encounter = getFixtureBundle('stars-below-kharad')!.encounters[0];
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
});
