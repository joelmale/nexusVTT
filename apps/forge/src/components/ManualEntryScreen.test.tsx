import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import * as storage from '../services/dbService';
import { OfficialSkillsList } from './CharacterSheet/OfficialSkillsList';
import { SavingThrows } from './CharacterSheet/SavingThrows';
import ManualEntryScreen from './ManualEntryScreen';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

it.each([
  {
    edition: '2014',
    name: 'Fighter',
    slug: 'fighter',
    level: 5,
    bonus: 3,
    dieType: 10,
    save: 'CON',
  },
  {
    edition: '2024',
    name: 'Rogue',
    slug: 'rogue',
    level: 15,
    bonus: 5,
    dieType: 8,
    save: 'CHA',
  },
] as const)(
  'saves $edition manual entry with preview values and rolls matching the loaded sheet',
  async ({ edition, name, slug, level, bonus, dieType, save }) => {
    const onClose = vi.fn();
    const onCharacterCreated = vi.fn();
    const editor = render(
      <ManualEntryScreen
        isOpen
        edition={edition}
        onClose={onClose}
        onCharacterCreated={onCharacterCreated}
      />,
    );
    const nameInput = await screen.findByRole('textbox', {
      name: 'Character Name',
    });
    fireEvent.change(nameInput, { target: { value: `Manual ${edition}` } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Level' }), {
      target: { value: level },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Class' }), {
      target: { value: name },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Species' }), {
      target: { value: 'Human' },
    });
    const background = screen.getByRole('combobox', {
      name: 'Background',
    }) as HTMLSelectElement;
    fireEvent.change(background, {
      target: { value: background.options[1].value },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'DEX' }), {
      target: { value: 16 },
    });
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Stealth proficiency' }),
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Language 2' }), {
      target: { value: 'Elvish' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'GP currency' }), {
      target: { value: 12 },
    });

    const stealthModifier = bonus + 3;
    expect(
      screen.getByRole('group', { name: 'Armor Class' }),
    ).toHaveTextContent('13');
    expect(screen.getByRole('group', { name: 'Initiative' })).toHaveTextContent(
      '+3',
    );
    expect(
      within(screen.getByRole('group', { name: 'Stealth' })).getByText(
        `+${stealthModifier}`,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('group', { name: `${save} saving throw` }),
    ).toHaveTextContent(`+${bonus}`);
    const proficientSave = screen.getByRole('checkbox', {
      name: `${save} saving throw proficiency`,
    });
    expect(proficientSave).toBeChecked();
    expect(proficientSave).toBeDisabled();

    const saveButton = screen.getByRole('button', { name: 'Save Character' });
    if (edition === '2014') {
      const fail = vi
        .spyOn(storage, 'addCharacter')
        .mockRejectedValueOnce(new Error('Storage unavailable'));
      try {
        fireEvent.click(saveButton);
        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Storage unavailable',
        );
        expect(nameInput).toHaveValue('Manual 2014');
        expect(onClose).not.toHaveBeenCalled();
        expect(await storage.getAllCharacters()).toHaveLength(0);
      } finally {
        fail.mockRestore();
      }
    }
    fireEvent.click(saveButton);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    const records = await storage.getAllCharacters();
    expect(records).toHaveLength(1);
    const [character] = records;
    expect(character).toMatchObject({
      name: `Manual ${edition}`,
      edition,
      class: slug,
      classSlug: slug,
      level,
      abilities: { DEX: { score: 16, modifier: 3 } },
      armorClass: 13,
      initiative: 3,
      proficiencyBonus: bonus,
      hitDice: { current: level, max: level, dieType },
      skills: {
        Stealth: { value: stealthModifier, proficient: true },
        SleightOfHand: { value: 3, proficient: false },
      },
      currency: { gp: 12 },
      languages: ['Elvish'],
      inventory: [],
    });
    expect(onCharacterCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: character.id }),
    );

    editor.unmount();
    const onDiceRoll = vi.fn();
    render(
      <>
        <OfficialSkillsList
          character={character}
          onDiceRoll={onDiceRoll}
          setRollResult={vi.fn()}
        />
        <SavingThrows
          character={character}
          onDiceRoll={onDiceRoll}
          setRollResult={vi.fn()}
        />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Stealth/ }));
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${save}`) }),
    );
    expect(onDiceRoll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ modifier: stealthModifier }),
    );
    expect(onDiceRoll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ modifier: bonus }),
    );
  },
);
