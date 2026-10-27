import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Character } from '@nexus/character-contracts';
import type { SpellDefinition } from '@nexus/game-contracts';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';
import {
  loadActorSpellbook,
  type SpellbookActor,
} from '@/services/actorSpellbook';
import { commandClient } from '@/services/commandClient';
import { SpellbookPanel } from '@/components/Panels/SpellbookPanel';

vi.mock('@/services/actorSpellbook', () => ({ loadActorSpellbook: vi.fn() }));
vi.mock('@/services/commandClient', () => ({
  commandClient: {
    castSpell: vi.fn(),
    applyPreparationPlan: vi.fn(),
    endConcentration: vi.fn(),
    restActor: vi.fn(),
    consumeClassResource: vi.fn(),
    recordClassResource: vi.fn(),
  },
}));
const spell = {
  id: '11111111-1111-4111-8111-111111111111',
  revision: 4,
  slug: 'healing-word',
  name: 'Healing Word',
  level: 1,
  castingTime: 'Bonus action',
  range: '60 feet',
  duration: 'Instantaneous',
  description: 'Healing description',
} as SpellDefinition;
const actor: SpellbookActor = {
  id: 'canonical-actor',
  stateVersion: 7,
  pools: {
    cleric: {
      id: 'cleric',
      name: 'Cleric slots',
      poolType: 'slots',
      slots: { '1': { current: 2, total: 2 } },
      resetOn: 'long-rest',
    },
  },
  profiles: [
    {
      profileId: 'cleric-source',
      name: 'Cleric',
      sourceType: 'class',
      sourceSlug: 'cleric',
      spellcastingAbility: 'WIS',
      spellSaveDC: 13,
      spellAttackBonus: 5,
      isRitualCaster: true,
      preparationMode: 'prepared',
      resourcePoolId: 'cleric',
      boundCollectionIds: [],
      knownSpellSlugs: ['healing-word'],
      preparedSpellSlugs: ['healing-word'],
    },
  ],
};
const renderPanel = () =>
  render(
    <SpellbookPanel
      link={{ kind: 'spellbook', id: 'character', campaignId: 'campaign' }}
      onClose={vi.fn()}
      isPopout={false}
    />,
  );
beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    user: { ...useGameStore.getState().user, id: 'player', type: 'player' },
  });
  useCharacterStore.setState({
    characters: [
      { id: 'character', playerId: 'player', name: 'Real Cleric' } as Character,
    ],
  });
  vi.mocked(loadActorSpellbook).mockResolvedValue({ actor, spells: [spell] });
  vi.mocked(commandClient.castSpell).mockResolvedValue({ success: true });
});

describe('canonical character spellbook', () => {
  it('lets a martial actor spend its server resource using the current version and refreshes the saved balance', async () => {
    const fighter: SpellbookActor = {
      ...actor,
      profiles: [],
      pools: {
        'feature:second-wind': {
          id: 'feature:second-wind',
          name: 'Second Wind',
          poolType: 'uses',
          classResourceId: 'second-wind',
          max: 2,
          current: 2,
          resetOn: 'long-rest',
          recovery: { shortRest: 1, longRest: 'full' },
        },
      },
    };
    vi.mocked(loadActorSpellbook)
      .mockResolvedValueOnce({ actor: fighter, spells: [] })
      .mockResolvedValue({
        actor: {
          ...fighter,
          stateVersion: 8,
          pools: {
            'feature:second-wind': {
              ...fighter.pools['feature:second-wind'],
              current: 1,
            },
          },
        },
        spells: [],
      });
    vi.mocked(commandClient.consumeClassResource).mockResolvedValue({
      success: true,
    });
    renderPanel();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Use Second Wind' }),
    );
    await waitFor(() =>
      expect(commandClient.consumeClassResource).toHaveBeenCalledWith(
        'campaign',
        'canonical-actor',
        'second-wind',
        1,
        expect.objectContaining({
          expectedVersion: 7,
          commandId: expect.any(String),
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByText('1 / 2 remaining')).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /short rest/i }),
    ).toBeInTheDocument();
  });

  it('keeps the prior resource balance visible when the command is rejected', async () => {
    vi.mocked(loadActorSpellbook).mockResolvedValue({
      actor: {
        ...actor,
        profiles: [],
        pools: {
          'feature:rage': {
            id: 'feature:rage',
            name: 'Rage',
            poolType: 'uses',
            classResourceId: 'rage',
            max: 2,
            current: 1,
            resetOn: 'long-rest',
          },
        },
      },
      spells: [],
    });
    vi.mocked(commandClient.consumeClassResource).mockRejectedValue(
      new Error('Version changed'),
    );
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Use Rage' }));
    await waitFor(() =>
      expect(
        screen.getByText(/Resource use could not be saved/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('1 / 2 remaining')).toBeInTheDocument();
  });
  it('uses actual profile and definition references and refreshes committed slots', async () => {
    vi.mocked(loadActorSpellbook)
      .mockResolvedValueOnce({ actor, spells: [spell] })
      .mockResolvedValue({
        actor: {
          ...actor,
          stateVersion: 8,
          pools: {
            cleric: {
              ...actor.pools.cleric,
              slots: { '1': { current: 1, total: 2 } },
            },
          },
        },
        spells: [spell],
      });
    renderPanel();
    expect(
      await screen.findByText('WIS · Save DC 13 · Attack +5'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cast Healing Word' }));
    await waitFor(() =>
      expect(commandClient.castSpell).toHaveBeenCalledWith(
        'campaign',
        actor.id,
        { kind: 'spell', id: spell.id, revision: 4 },
        'cleric-source',
        1,
        expect.objectContaining({
          expectedVersion: 7,
          commandId: expect.any(String),
        }),
      ),
    );
    expect(await screen.findByText('Level 1: 1 / 2')).toBeInTheDocument();
  });
  it('keeps resources unchanged on rejection and retries uncertain outcomes with the same operation id', async () => {
    vi.mocked(commandClient.castSpell)
      .mockResolvedValueOnce({ success: false, uncertain: true })
      .mockResolvedValueOnce({ success: false, error: 'Version conflict' });
    renderPanel();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cast Healing Word' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry confirmation' }),
    );
    expect(await screen.findByText('Version conflict')).toBeInTheDocument();
    expect(commandClient.castSpell).toHaveBeenCalledTimes(2);
    expect(vi.mocked(commandClient.castSpell).mock.calls[0][5]?.commandId).toBe(
      vi.mocked(commandClient.castSpell).mock.calls[1][5]?.commandId,
    );
    expect(screen.getByText('Level 1: 2 / 2')).toBeInTheDocument();
  });
  it('disables an exhausted or unprepared spell and explains missing campaign access', async () => {
    vi.mocked(loadActorSpellbook).mockResolvedValue({
      actor: {
        ...actor,
        pools: {
          cleric: {
            ...actor.pools.cleric,
            slots: { '1': { current: 0, total: 2 } },
          },
        },
      },
      spells: [spell],
    });
    renderPanel();
    expect(
      await screen.findByRole('button', { name: 'Cast Healing Word' }),
    ).toBeDisabled();
    expect(commandClient.castSpell).not.toHaveBeenCalled();
  });
});
