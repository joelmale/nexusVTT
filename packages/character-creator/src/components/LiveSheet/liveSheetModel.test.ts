import { describe, expect, it } from 'vitest';
import { buildLiveSheet } from './liveSheetModel';
import { initialCreationData } from '../CharacterCreationWizard/constants/wizard.constants';
import { REFERENCE_BUILDS } from '../../tests/fixtures/referenceBuilds';
import type { CharacterCreationData } from '../../types/dnd';
import { calculateCharacterStats } from '../../utils/characterCreationUtils';

const wizard = REFERENCE_BUILDS.W24.creationData as CharacterCreationData;

describe('buildLiveSheet', () => {
  it('shows no invented numbers for an empty draft', () => {
    const sheet = buildLiveSheet(initialCreationData);
    expect(sheet.vitals).toMatchObject({
      hitPoints: null,
      armorClass: null,
      speed: null,
      initiative: null,
      proficiencyBonus: 2,
    });
    expect(sheet.abilities.every((a) => a.score === null)).toBe(true);
    expect(sheet.pending).toMatchObject({
      species: 'Choose a species',
      class: 'Choose a class',
      abilities: 'Assign ability scores',
      story: 'Name your character',
    });
    expect(sheet.spellcasting).toBeNull();
  });

  it('matches the calculators for a finished level 5 Wizard', () => {
    const data = { ...wizard, level: 5 } as CharacterCreationData;
    const stats = calculateCharacterStats(data);
    const sheet = buildLiveSheet(data);
    expect(sheet.vitals.hitPoints).toBe(stats.maxHitPoints);
    expect(sheet.vitals.armorClass).toBe(stats.armorClass);
    expect(sheet.vitals.proficiencyBonus).toBe(3);
    expect(sheet.className).toBe('Wizard');
    expect(sheet.abilities.find((a) => a.key === 'INT')?.savingThrow).toBe(true);
    expect(sheet.abilities.find((a) => a.key === 'STR')?.savingThrow).toBe(false);
    expect(sheet.spellcasting?.slots).toEqual([
      { level: 1, count: 4 },
      { level: 2, count: 3 },
      { level: 3, count: 2 },
    ]);
    expect(sheet.spellcasting?.saveDC).toBe(stats.spellcasting?.spellSaveDC);
  });

  it('shows Pact Magic for a level 5 Warlock', () => {
    const data = {
      ...wizard,
      classSlug: 'warlock',
      level: 5,
      spellSelection: { selectedCantrips: ['eldritch-blast'], preparedSpells: ['hex'] },
    } as unknown as CharacterCreationData;
    const sheet = buildLiveSheet(data);
    expect(sheet.spellcasting?.pactMagic).toBe(true);
    expect(sheet.spellcasting?.slots).toEqual([{ level: 3, count: 2 }]);
    expect(sheet.spellcasting?.cantrips).toEqual(['Eldritch Blast']);
    expect(sheet.spellcasting?.spells).toEqual(['Hex']);
  });

  it('shows the background by name, not its slug', () => {
    const data = { ...wizard, background: 'sage-2024' } as CharacterCreationData;
    expect(buildLiveSheet(data).backgroundName).toBe('Sage');
  });

  it('keeps vitals pending until the scores are assigned', () => {
    const data = {
      ...wizard,
      abilities: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    } as CharacterCreationData;
    const sheet = buildLiveSheet(data);
    expect(sheet.vitals.hitPoints).toBeNull();
    expect(sheet.vitals.armorClass).toBeNull();
    expect(sheet.vitals.speed).not.toBeNull();
    expect(sheet.pending.abilities).toBe('Assign ability scores');
  });
});
