import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draftToCreationData } from '@nexus/character-creator/adapters/draftAdapter';
import { getRecommendation } from '@nexus/character-creator/services/recommendationService';
import { calculateCharacterStats } from '@nexus/character-creator/utils/characterCreationUtils';
import { CharacterEditForm } from './CharacterEditForm';
import { OfficialSkillsList } from './CharacterSheet/OfficialSkillsList';
import { SavingThrows } from './CharacterSheet/SavingThrows';

describe('CharacterEditForm behavior', () => {
  it('preserves a Wizard spellbook, preparations, inventory and spent resources when renaming', async () => {
    const draft = getRecommendation({
      classSlug: 'wizard',
      edition: '2024',
    }).draft;
    const character = calculateCharacterStats(draftToCreationData(draft));
    character.name = 'Before';
    character.armorClass = 18;
    character.equippedArmor = 'chain-mail';
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
      'armorClass',
      'equippedArmor',
      'hitPoints',
      'hitDice',
      'skills',
    ] as const) {
      expect(result[key]).toEqual(original[key]);
    }
    expect(character).toEqual(original);
  });

  it('shows stored AC and skill values, including legacy skill keys and expertise', async () => {
    const draft = getRecommendation({
      classSlug: 'fighter',
      edition: '2024',
    }).draft;
    const character = calculateCharacterStats(draftToCreationData(draft));
    character.armorClass = 18;
    character.equippedArmor = 'chain-mail';
    character.skills = {
      ...character.skills,
      AnimalHandling: { value: 7, proficient: true },
      Perception: { value: 6, proficient: true, expertise: true },
      Stealth: { value: 0, proficient: false },
    };
    character.expertiseSkills = ['Animal Handling', 'Thieves’ Tools'];
    const onDiceRoll = vi.fn();

    render(
      <>
        <CharacterEditForm
          character={character}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
        <OfficialSkillsList
          character={character}
          onDiceRoll={onDiceRoll}
          setRollResult={vi.fn()}
        />
      </>,
    );

    expect(
      await screen.findByRole('group', { name: 'Armor Class' }),
    ).toHaveTextContent('18');
    expect(screen.queryByText('(10 + DEX)')).not.toBeInTheDocument();
    const animalHandling = within(
      screen.getByRole('group', { name: 'Animal Handling' }),
    );
    expect(animalHandling.getByText('+7')).toBeVisible();
    expect(animalHandling.getByText('Expertise')).toBeVisible();
    const proficiency = animalHandling.getByRole('checkbox', {
      name: 'Animal Handling proficiency',
    });
    expect(proficiency).toBeChecked();
    expect(proficiency).toBeEnabled();
    const perception = within(
      screen.getByRole('group', { name: 'Perception' }),
    );
    expect(perception.getByText('Expertise')).toBeVisible();
    expect(perception.getByText('+6')).toBeVisible();
    expect(
      screen.getByRole('group', { name: 'Passive Perception' }),
    ).toHaveTextContent('16');
    const stealth = within(screen.getByRole('group', { name: 'Stealth' }));
    expect(stealth.getByText('+0')).toBeVisible();
    expect(stealth.getByRole('checkbox')).not.toBeChecked();
    const sheetRoll = screen.getByRole('button', { name: /^Animal Handling/ });
    expect(sheetRoll).toHaveTextContent('+7');
    fireEvent.click(sheetRoll);
    expect(onDiceRoll).toHaveBeenCalledWith(
      expect.objectContaining({ modifier: 7 }),
    );
  });

  it('replaces a stored custom AC only when equipment recalculation is selected', async () => {
    const draft = getRecommendation({
      classSlug: 'fighter',
      edition: '2024',
    }).draft;
    const character = calculateCharacterStats(draftToCreationData(draft));
    character.equippedArmor = 'chain-mail';
    character.equippedWeapons = ['shield'];
    character.armorClass = 21;
    const save = vi.fn();
    render(
      <CharacterEditForm
        character={character}
        onSave={save}
        onCancel={vi.fn()}
      />,
    );

    const ac = await screen.findByRole('group', { name: 'Armor Class' });
    expect(ac).toHaveTextContent('21');
    const recalculate = screen.getByRole('checkbox', {
      name: 'Recalculate AC from equipment',
    });
    fireEvent.click(recalculate);
    expect(ac).toHaveTextContent('18');
    fireEvent.click(recalculate);
    expect(ac).toHaveTextContent('21');
    fireEvent.click(recalculate);
    fireEvent.click(screen.getByRole('button', { name: 'Save Character' }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ armorClass: 18 }),
    );
  });

  it.each([
    {
      edition: '2014',
      classSlug: 'unknown-slug',
      className: 'Rogue',
      charismaProficient: false,
      dexterityProficient: true,
    },
    {
      edition: '2024',
      classSlug: 'rogue',
      className: 'Fighter',
      charismaProficient: true,
      dexterityProficient: true,
    },
    {
      edition: '2024',
      classSlug: undefined,
      className: 'Unknown class',
      charismaProficient: false,
      dexterityProficient: false,
    },
  ] as const)(
    'uses the same $edition class saves in the editor, sheet, and rolls ($className)',
    async ({
      edition,
      classSlug,
      className,
      charismaProficient,
      dexterityProficient,
    }) => {
      const draft = getRecommendation({ classSlug: 'rogue', edition }).draft;
      const character = calculateCharacterStats(draftToCreationData(draft));
      character.class = className;
      character.classSlug = classSlug;
      character.level = 15;
      character.proficiencyBonus = 5;
      character.abilities.CHA = { score: 12, modifier: 1 };
      const onDiceRoll = vi.fn();

      render(
        <>
          <CharacterEditForm
            character={character}
            onSave={vi.fn()}
            onCancel={vi.fn()}
          />
          <SavingThrows
            character={character}
            onDiceRoll={onDiceRoll}
            setRollResult={vi.fn()}
          />
        </>,
      );

      const save = within(
        await screen.findByRole('group', { name: 'CHA saving throw' }),
      );
      const proficiency = save.getByRole('checkbox', {
        name: 'CHA saving throw proficiency',
      });
      expect(proficiency).toBeDisabled();
      expect(proficiency).toHaveProperty('checked', charismaProficient);
      expect(
        screen.getByRole('checkbox', { name: 'DEX saving throw proficiency' }),
      ).toHaveProperty('checked', dexterityProficient);
      const modifier = charismaProficient ? '+6' : '+1';
      expect(save.getByText(modifier)).toBeVisible();
      const roll = screen.getByRole('button', {
        name: new RegExp(`^CHA.*\\${modifier}$`),
      });
      fireEvent.click(roll);
      expect(onDiceRoll).toHaveBeenCalledWith(
        expect.objectContaining({ notation: `1d20${modifier}` }),
      );
    },
  );

  it('lets manual entry choose skill proficiencies and keeps class saves read-only', async () => {
    render(
      <CharacterEditForm
        isCreating
        edition="2014"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole('group', { name: 'Armor Class' }),
    ).toHaveTextContent('10');
    expect(
      screen.getByRole('checkbox', { name: 'Perception proficiency' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('checkbox', { name: 'WIS saving throw proficiency' }),
    ).toBeDisabled();
  });
});
