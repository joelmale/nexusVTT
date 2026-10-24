import { describe, it, expect } from 'vitest';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';

describe('Phase 0 - Reference Builds Oracles (CC-002)', () => {
  it('F14: calculates Standard Human Fighter/Soldier (2014) stats correctly', () => {
    const { creationData, expected } = REFERENCE_BUILDS.F14;
    const character = calculateCharacterStats(creationData);

    expect(character.abilities.STR.score).toBe(expected.abilities.STR);
    expect(character.abilities.DEX.score).toBe(expected.abilities.DEX);
    expect(character.abilities.CON.score).toBe(expected.abilities.CON);
    expect(character.abilities.INT.score).toBe(expected.abilities.INT);
    expect(character.abilities.WIS.score).toBe(expected.abilities.WIS);
    expect(character.abilities.CHA.score).toBe(expected.abilities.CHA);

    expect(character.hitPoints).toBe(expected.hp);
    expect(character.armorClass).toBe(expected.ac); // 16 Chain Mail + 2 Shield + 1 Defense = 19
    expect(character.initiative).toBe(expected.initiative);
  });

  it('F24: calculates Human Fighter/Soldier (2024) stats with Tough and Defense correctly', () => {
    const { creationData, expected } = REFERENCE_BUILDS.F24;
    const character = calculateCharacterStats(creationData);

    expect(character.abilities.STR.score).toBe(expected.abilities.STR);
    expect(character.abilities.DEX.score).toBe(expected.abilities.DEX);
    expect(character.abilities.CON.score).toBe(expected.abilities.CON);

    expect(character.hitPoints).toBe(expected.hp); // 10 + 2 CON + 2 Tough = 14
    expect(character.armorClass).toBe(expected.ac); // 16 Chain Mail + 1 Defense = 17
    expect(character.initiative).toBe(expected.initiative);
    expect(character.currency?.gp).toBe(expected.currency?.gp);
  });

  it('R14: calculates Wood Elf Rogue/Criminal (2014) stats correctly', () => {
    const { creationData, expected } = REFERENCE_BUILDS.R14;
    const character = calculateCharacterStats(creationData);

    expect(character.abilities.DEX.score).toBe(expected.abilities.DEX);
    expect(character.abilities.WIS.score).toBe(expected.abilities.WIS);

    expect(character.hitPoints).toBe(expected.hp);
    expect(character.armorClass).toBe(expected.ac); // 11 Leather + 3 DEX = 14
    expect(character.initiative).toBe(expected.initiative);
  });

  it('R24: calculates Wood Elf Rogue/Criminal (2024) stats with Alert initiative correctly', () => {
    const { creationData, expected } = REFERENCE_BUILDS.R24;
    const character = calculateCharacterStats(creationData);

    expect(character.abilities.DEX.score).toBe(expected.abilities.DEX);
    expect(character.abilities.CON.score).toBe(expected.abilities.CON);

    expect(character.hitPoints).toBe(expected.hp); // 8 + 2 CON = 10
    expect(character.armorClass).toBe(expected.ac); // 11 Leather + 3 DEX = 14
    expect(character.initiative).toBe(expected.initiative); // +3 DEX + 2 PB (Alert) = +5
  });

  it('W14: calculates High Elf Wizard/Sage (2014) stats correctly', () => {
    const { creationData, expected } = REFERENCE_BUILDS.W14;
    const character = calculateCharacterStats(creationData);

    expect(character.abilities.INT.score).toBe(expected.abilities.INT);
    expect(character.abilities.DEX.score).toBe(expected.abilities.DEX);

    expect(character.hitPoints).toBe(expected.hp);
    expect(character.armorClass).toBe(expected.ac); // 10 Unarmored + 3 DEX = 13
    expect(character.initiative).toBe(expected.initiative);
  });

  it('W24: calculates High Elf Wizard/Sage (2024) stats correctly', () => {
    const { creationData, expected } = REFERENCE_BUILDS.W24;
    const character = calculateCharacterStats(creationData);

    expect(character.abilities.INT.score).toBe(expected.abilities.INT);
    expect(character.abilities.CON.score).toBe(expected.abilities.CON);

    expect(character.hitPoints).toBe(expected.hp);
    expect(character.armorClass).toBe(expected.ac); // 10 Unarmored + 2 DEX = 12
    expect(character.initiative).toBe(expected.initiative);
  });
});
