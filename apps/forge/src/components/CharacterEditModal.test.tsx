import 'fake-indexeddb/auto';
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { draftToCreationData } from '@nexus/character-creator/adapters/draftAdapter';
import { getRecommendation } from '@nexus/character-creator/services/recommendationService';
import { calculateCharacterStats } from '@nexus/character-creator/utils/characterCreationUtils';

import { IndexedDbAdapter } from '../services/storage/IndexedDbAdapter';
import type { Character } from '../types/dnd';
import { CharacterEditModal } from './CharacterEditModal';
import { OfficialSkillsList } from './CharacterSheet/OfficialSkillsList';

it('keeps edits open after a failed save and applies the preview on retry and reopen', async () => {
  const draft = getRecommendation({
    classSlug: 'fighter',
    edition: '2024',
  }).draft;
  const character = calculateCharacterStats(draftToCreationData(draft));
  character.abilities.DEX = { score: 14, modifier: 2 };
  character.equippedArmor = undefined;
  character.equippedWeapons = [];
  character.armorClass = 12;
  character.initiative = 5;
  character.proficiencyBonus = 2;
  character.skills.Stealth = { value: 4, proficient: false };
  character.skills.Insight = { value: 6, proficient: true };
  character.expertiseSkills = ['Insight', 'Thieves’ Tools'];
  const storage = new IndexedDbAdapter();
  await storage.addCharacter(character);
  let rejectFirstSave!: (error: Error) => void;
  const firstSave = new Promise<void>((_resolve, reject) => {
    rejectFirstSave = reject;
  });
  const onSave = vi
    .fn<(updated: Character) => Promise<void>>()
    .mockReturnValueOnce(firstSave)
    .mockImplementation((updated) => storage.updateCharacter(updated));
  const onClose = vi.fn();
  const editor = render(
    <CharacterEditModal
      character={character}
      isOpen
      onSave={onSave}
      onClose={onClose}
    />,
  );

  const dexterity = await screen.findByRole('spinbutton', { name: 'DEX' });
  expect(screen.getByRole('spinbutton', { name: 'Level' })).toHaveAttribute(
    'readonly',
  );
  expect(screen.getByRole('combobox', { name: 'Class' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Edition' })).toBeDisabled();
  fireEvent.change(dexterity, { target: { value: '18' } });
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Stealth proficiency' }),
  );
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Insight proficiency' }),
  );

  const verifyPreview = () => {
    expect(
      screen.getByRole('group', { name: 'Armor Class' }),
    ).toHaveTextContent('14');
    expect(screen.getByRole('group', { name: 'Initiative' })).toHaveTextContent(
      '+7',
    );
    expect(
      screen.getByRole('group', { name: 'DEX saving throw' }),
    ).toHaveTextContent('+4');
    expect(
      within(screen.getByRole('group', { name: 'Stealth' })).getByText('+8'),
    ).toBeVisible();
    expect(
      within(screen.getByRole('group', { name: 'Insight' })).getByText('+2'),
    ).toBeVisible();
  };
  verifyPreview();
  fireEvent.click(screen.getByRole('button', { name: 'Save Character' }));
  const saving = screen.getByRole('button', { name: /Saving Character/ });
  expect(saving).toBeDisabled();
  expect(dexterity).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Close character editor' }),
  ).toBeDisabled();
  fireEvent.click(saving);
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();

  await act(async () => {
    rejectFirstSave(new Error('Storage unavailable'));
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable');
  expect(dexterity).toHaveValue(18);
  expect(dexterity).toBeEnabled();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save Character' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

  const characters = await storage.getAllCharacters();
  expect(characters).toHaveLength(1);
  const [saved] = characters;
  expect(saved.id).toBe(character.id);
  expect(saved).toMatchObject({
    abilities: { DEX: { score: 18, modifier: 4 } },
    armorClass: 14,
    initiative: 7,
    skills: {
      Stealth: { value: 8, proficient: true },
      Insight: { value: 2, proficient: false, expertise: false },
    },
    expertiseSkills: ['Thieves’ Tools'],
  });
  editor.unmount();
  const onDiceRoll = vi.fn();
  render(
    <>
      <CharacterEditModal
        character={saved}
        isOpen
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
      <OfficialSkillsList
        character={saved}
        onDiceRoll={onDiceRoll}
        setRollResult={vi.fn()}
      />
    </>,
  );
  await screen.findByRole('spinbutton', { name: 'DEX' });
  verifyPreview();
  fireEvent.click(screen.getByRole('button', { name: /^Stealth/ }));
  expect(onDiceRoll).toHaveBeenCalledWith(
    expect.objectContaining({ modifier: 8 }),
  );
});
