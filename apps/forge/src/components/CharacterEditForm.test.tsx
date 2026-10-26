import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draftToCreationData } from '@nexus/character-creator/adapters/draftAdapter';
import { getRecommendation } from '@nexus/character-creator/services/recommendationService';
import { calculateCharacterStats } from '@nexus/character-creator/utils/characterCreationUtils';
import { CharacterEditForm } from './CharacterEditForm';

describe('CharacterEditForm behavior', () => {
  it('preserves a Wizard spellbook, preparations, inventory and spent resources when renaming', async () => {
    const draft = getRecommendation({
      classSlug: 'wizard',
      edition: '2024',
    }).draft;
    const character = calculateCharacterStats(draftToCreationData(draft));
    character.name = 'Before';
    character.hitPoints = 0;
    character.resources = [
      {
        id: 'arcane-recovery',
        name: 'Arcane Recovery',
        description: 'Recover spell slots.',
        currentUses: 0,
        maxUses: 1,
        rechargeType: 'long-rest',
      },
    ];
    character.spellcasting = {
      ...character.spellcasting!,
      spellbook: ['shield', 'magic-missile', 'detect-magic', 'sleep'],
      preparedSpells: ['shield', 'sleep'],
      usedSpellSlots: [0, 1],
    };
    const original = structuredClone(character);
    const saved = vi.fn();
    render(
      <CharacterEditForm
        character={character}
        onSave={saved}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Character Name' }),
      {
        target: { value: 'After' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(saved).toHaveBeenCalledOnce();
    const result = saved.mock.calls[0][0];
    expect(result.name).toBe('After');
    for (const key of [
      'spellcasting',
      'inventory',
      'resources',
      'currency',
      'hitPoints',
      'hitDice',
      'skills',
    ] as const) {
      expect(result[key]).toEqual(original[key]);
    }
    expect(character).toEqual(original);
  });
});
