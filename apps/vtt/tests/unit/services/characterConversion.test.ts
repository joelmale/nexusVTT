/**
 * Conversion and data-preservation tests for the shared character creator.
 *
 * These cover the single conversion used by both the live creator
 * (`createdCharacterToNexus`) and the Forge JSON import path
 * (`ForgeCharacterAdapter.transform`).
 */

import { describe, expect, it } from 'vitest';
import {
  createdCharacterToNexus,
  toNexusCharacter,
} from '@nexus/character-creator';
import { ForgeCharacterAdapter } from '@/services/characterImport/forgeAdapter';
import {
  cleric2024,
  fighter2014,
  golden2014Artificer,
  legacyForgeExport,
  rogue2024Level8,
  wizard2014,
} from './forgeCharacterFixtures';

const convert = (source: unknown, playerId = 'player-1') =>
  toNexusCharacter(source as never, { playerId, now: '2026-09-15T00:00:00.000Z' });

describe('shared creator → VTT character conversion', () => {
  describe('2014 martial character (Fighter 1)', () => {
    const result = convert(fighter2014);

    it('preserves identity, edition and level', () => {
      expect(result.name).toBe('Bren Halloway');
      expect(result.species).toBe('human');
      expect(result.race).toBe('human'); // filled from species for legacy readers
      expect(result.class).toBe('Fighter');
      expect(result.classSlug).toBe('fighter');
      expect(result.background).toBe('soldier');
      expect(result.edition).toBe('2014');
      expect(result.level).toBe(1);
      expect(result.playerId).toBe('player-1');
    });

    it('preserves ability scores and recomputes modifiers', () => {
      expect(result.abilities.STR).toEqual({ score: 16, modifier: 3 });
      expect(result.abilities.CHA).toEqual({ score: 8, modifier: -1 });
    });

    it('normalises skill keys and keeps proficiency', () => {
      expect(result.skills.Athletics).toMatchObject({
        proficient: true,
        value: 5,
      });
      // A complete skill list is always produced, never a partial map.
      expect(Object.keys(result.skills)).toHaveLength(18);
      expect(result.skills['Animal Handling']).toBeDefined();
      expect(result.skills['Sleight of Hand']).toBeDefined();
    });

    it('preserves armour, weapon and tool proficiencies', () => {
      expect(result.proficiencies?.armor).toContain('Heavy Armor');
      expect(result.proficiencies?.weapons).toContain('Martial Weapons');
      expect(result.proficiencies?.tools).toContain("Smith's Tools");
    });

    it('preserves fighting style and class resources', () => {
      expect(result.selectedFightingStyle).toBe('Defense');
      expect(result.fightingStyle).toBe('defense');
      expect(result.secondWindUses).toBe(1);
      expect(result.resources).toHaveLength(1);
    });

    it('preserves inventory detail the old adapter discarded', () => {
      const kit = result.inventory?.find(
        (item) => item.equipmentSlug === 'healers-kit',
      );
      expect(kit).toBeDefined();
      expect(kit?.notes).toBe('Gift from the company medic.');
      expect(kit?.quantity).toBe(1);

      expect(result.equippedArmor).toBe('chain-mail');
      expect(result.equippedWeapons).toEqual([
        { weaponSlug: 'longsword', equipped: true, quantity: 1 },
      ]);
    });

    it('keeps both species traits and the legacy racialTraits alias', () => {
      expect(result.featuresAndTraits?.speciesTraits).toEqual(['Extra Language']);
      expect(result.featuresAndTraits?.racialTraits).toEqual(['Extra Language']);
    });

    it('derives saving throw proficiencies from the class', () => {
      const withSaves = toNexusCharacter(fighter2014 as never, {
        playerId: 'p',
        proficientSaves: ['STR', 'CON'],
      });
      expect(withSaves.savingThrowProficiencies).toEqual({
        STR: true,
        DEX: false,
        CON: true,
        INT: false,
        WIS: false,
        CHA: false,
      });
    });
  });

  describe('2014 spellcaster (Wizard 5)', () => {
    const result = convert(wizard2014);

    it('preserves the full spellcasting block', () => {
      expect(result.spellcasting?.spellcastingType).toBe('wizard');
      expect(result.spellcasting?.spellbook).toHaveLength(7);
      expect(result.spellcasting?.preparedSpells).toContain('fireball');
      expect(result.spellcasting?.cantripsKnown).toHaveLength(4);
      expect(result.spellcasting?.spellSlots).toEqual([
        0, 4, 3, 2, 0, 0, 0, 0, 0, 0,
      ]);
      expect(result.spellcasting?.usedSpellSlots).toEqual([
        0, 1, 0, 1, 0, 0, 0, 0, 0, 0,
      ]);
    });

    it('preserves level-by-level spell choices', () => {
      expect(result.spellcasting?.cantripChoicesByLevel).toEqual({
        1: 'fire-bolt',
        4: 'light',
      });
      expect(result.spellcasting?.spellChoicesByLevel).toEqual({
        3: 'fireball',
      });
    });

    it('preserves subclass and structured SRD features', () => {
      expect(result.subclass).toBe('evocation');
      expect(result.srdFeatures?.subclassFeatures?.[0]).toMatchObject({
        slug: 'sculpt-spells',
        level: 2,
      });
    });

    it('preserves species variant and attunement', () => {
      expect(result.selectedSpeciesVariant).toBe('high-elf');
      const cloak = result.inventory?.find(
        (item) => item.equipmentSlug === 'cloak-of-protection',
      );
      expect(cloak?.attuned).toBe(true);
    });

    it('preserves current/max/temp hit points independently', () => {
      expect(result.hitPoints).toBe(27);
      expect(result.maxHitPoints).toBe(32);
      expect(result.temporaryHitPoints).toBe(5);
      expect(result.hitDice).toEqual({ current: 3, max: 5, dieType: 6 });
    });
  });

  describe('2024 character (Cleric 3)', () => {
    const result = convert(cleric2024);

    it('preserves 2024-only class and origin choices', () => {
      expect(result.edition).toBe('2024');
      expect(result.divineOrder).toBe('protector');
      expect(result.weaponMastery).toEqual(['mace', 'warhammer']);
      expect(result.originFeat).toBe('magic-initiate');
      expect(result.backgroundFeat).toBe('magic-initiate');
      expect(result.heroicInspiration).toBe(true);
    });

    it('preserves feat selections and their follow-up choices', () => {
      expect(result.selectedFeats).toEqual(['magic-initiate']);
      expect(result.featChoices).toEqual({
        'magic-initiate': { spellList: 'cleric' },
      });
      expect(result.featEffects).toEqual({ inspiringLeader: false });
    });

    it('preserves feat-granted spells', () => {
      expect(result.spellcasting?.featGrantedSpells).toEqual([
        {
          spellSlug: 'detect-magic',
          spellcastingAbility: 'WIS',
          usesPerDay: 1,
          rechargeType: 'long-rest',
          featSlug: 'magic-initiate',
        },
      ]);
    });

    it('preserves the rolled trinket', () => {
      expect(result.trinket?.short_name).toBe('Worn holy symbol');
      expect(result.trinket?.tags).toContain('heirloom');
    });
  });

  describe('higher-level creation (Rogue 8)', () => {
    const result = convert(rogue2024Level8);

    it('preserves expertise on both the skill map and the summary list', () => {
      expect(result.skills.Stealth).toMatchObject({
        proficient: true,
        expertise: true,
        value: 11,
      });
      expect(result.skills['Sleight of Hand']?.expertise).toBe(true);
      expect(result.expertiseSkills).toEqual(['Stealth', 'Sleight of Hand']);
    });

    it('preserves progression data from multi-level creation', () => {
      expect(result.level).toBe(8);
      expect(result.proficiencyBonus).toBe(3);
      expect(result.levelHistory).toHaveLength(2);
      expect(result.feats).toEqual(['alert', 'skulker']);
      expect(result.experiencePoints).toBe(34000);
    });

    it('preserves lineage and electrum currency', () => {
      expect(result.selectedLineage).toBe('lightfoot');
      expect(result.currency?.ep).toBe(2);
      expect(result.currency?.pp).toBe(4);
    });

    it('normalises every equipped weapon slug', () => {
      expect(result.equippedWeapons).toEqual([
        { weaponSlug: 'rapier', equipped: true, quantity: 1 },
        { weaponSlug: 'dagger', equipped: true, quantity: 1 },
      ]);
    });
  });

  describe('backwards compatibility with existing JSON exports', () => {
    const adapter = new ForgeCharacterAdapter();

    it('still recognises a legacy Forge export', () => {
      expect(adapter.validate(legacyForgeExport)).toBe(true);
      expect(adapter.validate({ name: 'not forge' })).toBe(false);
      expect(adapter.validate(null)).toBe(false);
    });

    it('resolves slugs from legacy id/name inventory entries', () => {
      const result = adapter.transform(legacyForgeExport as never, 'player-9');
      expect(result.inventory?.[0]).toMatchObject({
        equipmentSlug: 'scale-mail',
        name: 'Scale Mail',
        weight: 45,
        equipped: true,
      });
      expect(result.inventory?.[1]).toMatchObject({
        equipmentSlug: 'warhammer',
        type: 'weapon',
      });
    });

    it('accepts object-shaped equippedWeapons unchanged', () => {
      const result = adapter.transform(legacyForgeExport as never, 'player-9');
      expect(result.equippedWeapons).toEqual([
        { weaponSlug: 'warhammer', equipped: true, quantity: 1 },
      ]);
    });

    it('keeps the deprecated race field when species is absent', () => {
      const result = adapter.transform(legacyForgeExport as never, 'player-9');
      expect(result.race).toBe('Dwarf');
      expect(result.species).toBe('dwarf');
    });

    it('produces import metadata', () => {
      const metadata = adapter.generateMetadata(legacyForgeExport as never);
      expect(metadata).toMatchObject({
        sourceType: 'forge',
        sourceVersion: '2014',
        originalId: 'fixture-legacy-export',
      });
    });
  });

  describe('conversion is total', () => {
    const fixtures = [
      fighter2014,
      wizard2014,
      cleric2024,
      rogue2024Level8,
      legacyForgeExport,
      golden2014Artificer,
    ];

    it('never drops a populated top-level field without a mapping', () => {
      // Fields the contract deliberately does not carry, each with a reason
      // documented in UNMAPPED_CREATOR_FIELDS or handled by a rename.
      const knownRenames = new Set(['_export']);

      for (const fixture of fixtures) {
        const converted = convert(fixture) as Record<string, unknown>;
        for (const key of Object.keys(fixture)) {
          if (knownRenames.has(key)) continue;
          expect(
            converted[key] !== undefined,
            `${fixture.name}: "${key}" was dropped during conversion`,
          ).toBe(true);
        }
      }
    });

    it('always produces creation timestamps', () => {
      for (const fixture of fixtures) {
        const converted = convert(fixture);
        expect(converted.createdAt).toBeTruthy();
        expect(converted.updatedAt).toBeTruthy();
      }
    });
  });

  describe('golden output captured from the running creator', () => {
    const result = convert(golden2014Artificer, 'player-golden');

    it('preserves class, subclass and origin feat', () => {
      expect(result.class).toBe('Artificer');
      expect(result.classSlug).toBe('artificer');
      expect(result.subclass).toBe('battle-smith');
      expect(result.originFeat).toBe('tough');
    });

    it('preserves every proficiency group', () => {
      expect(result.proficiencies).toEqual({
        armor: ['Light Armor', 'Medium Armor', 'Shields'],
        weapons: ['Simple Weapons'],
        tools: [
          "Thieves' Tools",
          "Tinker's Tools",
          'Musical Instrument (one choice)',
        ],
      });
    });

    it('preserves the full nine-item inventory with quantities', () => {
      expect(result.inventory).toHaveLength(9);
      const trap = result.inventory?.find(
        (item) => item.equipmentSlug === 'hunting-trap',
      );
      expect(trap?.quantity).toBe(2);
    });

    it('preserves languages, species traits and skill proficiencies', () => {
      expect(result.languages).toEqual(['Slaad', 'Deep Speech', 'Gnomish']);
      expect(result.featuresAndTraits?.speciesTraits).toContain('Savage Attacks');
      const proficient = Object.entries(result.skills)
        .filter(([, skill]) => skill.proficient)
        .map(([name]) => name)
        .sort();
      expect(proficient).toEqual([
        'Arcana',
        'Athletics',
        'Perception',
        'Survival',
      ]);
    });

    it('preserves the half-caster spellcasting block', () => {
      expect(result.spellcasting?.ability).toBe('INT');
      expect(result.spellcasting?.spellSaveDC).toBe(12);
      expect(result.spellcasting?.spellcastingType).toBe('prepared');
      expect(result.spellcasting?.cantripChoicesByLevel).toEqual({ 1: '' });
    });

    it('derives Artificer saving throws from the shared rules data', () => {
      const withSaves = createdCharacterToNexus(golden2014Artificer as never, {
        playerId: 'player-golden',
      });
      expect(withSaves.savingThrowProficiencies).toEqual({
        STR: false,
        DEX: false,
        CON: true,
        INT: true,
        WIS: false,
        CHA: false,
      });
    });
  });
});
