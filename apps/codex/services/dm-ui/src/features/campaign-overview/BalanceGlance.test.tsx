import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getFixtureBundle, type CampaignFixtureBundle } from '@/demo/fixture-registry';
import { BalanceGlance } from './BalanceGlance';

describe('BalanceGlance', () => {
  const baseBundle = getFixtureBundle('stars-below-kharad', 'test')!;

  it('renders Balance at a Glance title and party badge', () => {
    render(<BalanceGlance bundle={baseBundle} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Balance at a Glance' })).toBeInTheDocument();
    expect(screen.getByText(/PCs · Level/i)).toBeInTheDocument();
    expect(screen.getByTestId('balance-status-pill')).toBeInTheDocument();
  });

  it('renders combat balance section with XP progress bar and encounters', () => {
    render(<BalanceGlance bundle={baseBundle} />);

    expect(screen.getByRole('article', { name: 'Encounter Combat Balance' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Daily Encounter XP Budget' })).toBeInTheDocument();
    expect(screen.getByText(/Party Thresholds:/i)).toBeInTheDocument();
  });

  it('renders treasure progression with campaign wealth and expected range', () => {
    render(<BalanceGlance bundle={baseBundle} />);

    expect(screen.getByRole('article', { name: 'Party Wealth & Treasure Progression' })).toBeInTheDocument();
    expect(screen.getByText('Campaign Placed Wealth:')).toBeInTheDocument();
    expect(screen.getByText('Expected Tier Range:')).toBeInTheDocument();
    expect(screen.getByText('Pacing Status:')).toBeInTheDocument();
  });

  it('renders advisories section when warnings are present', () => {
    const deadlyBundle: CampaignFixtureBundle = {
      ...baseBundle,
      encounters: [
        {
          id: 'enc-deadly',
          campaignId: baseBundle.campaignId,
          title: 'Ancient Red Dragon Surprise',
          summary: 'A dragon attacks',
          kind: 'combat',
          difficulty: 'high',
          trigger: 'Immediate',
          locationIds: [],
          npcIds: [],
          factionIds: [],
          sessionIds: [baseBundle.sessions[0].id],
          composition: [
            {
              monsterKey: 'srd:ancient-red-dragon',
              name: 'Ancient Red Dragon',
              count: 1,
              cr: '24',
            },
          ],
        },
      ],
    };

    render(<BalanceGlance bundle={deadlyBundle} sessionId={baseBundle.sessions[0].id} />);

    expect(screen.getByRole('complementary', { name: 'Balance Advisories' })).toBeInTheDocument();
    expect(screen.getByText(/High lethal risk:/i)).toBeInTheDocument();
    expect(screen.getByText(/never restrict preparation or table play/i)).toBeInTheDocument();
    expect(screen.getByTestId('balance-status-pill')).toHaveTextContent('Lethal Risk');
  });

  it('does not render advisories section when no warnings exist', () => {
    const cleanBundle: CampaignFixtureBundle = {
      ...baseBundle,
      encounters: [
        {
          id: 'enc-low',
          campaignId: baseBundle.campaignId,
          title: 'Goblin Scout',
          kind: 'combat',
          difficulty: 'low',
          locationIds: [],
          npcIds: [],
          factionIds: [],
          sessionIds: [baseBundle.sessions[0].id],
          composition: [
            {
              name: 'Goblin',
              count: 1,
              cr: '1/4',
            },
          ],
        },
      ],
      items: [
        {
          id: 'item-balanced',
          campaignId: baseBundle.campaignId,
          name: 'Hoard Gold',
          itemType: 'treasure',
          rarity: 'rare',
          requiresAttunement: false,
          valueGp: 45000,
          quantity: 1,
          description: 'A hoard of gold',
          holder: { kind: 'none' },
          discovered: true,
          identified: true,
          questIds: [],
        },
      ],
    };

    render(<BalanceGlance bundle={cleanBundle} sessionId={baseBundle.sessions[0].id} />);

    expect(screen.queryByRole('complementary', { name: 'Balance Advisories' })).not.toBeInTheDocument();
    expect(screen.getByTestId('balance-status-pill')).toHaveTextContent('Balanced');
  });
});
