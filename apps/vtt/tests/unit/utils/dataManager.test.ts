import { describe, it, expect, beforeEach } from 'vitest';
import type {
  Weapon,
  Armor,
  Tool,
  Spell,
  Equipment,
  Feature,
  PersonalityData,
  CharacterClass,
  CharacterRace,
  CharacterBackground,
} from '@nexus/character-contracts';
import {
  getDataManager,
  resetDataManager,
  type AllData,
  type DataManager,
} from '@/utils/dataManager';

const validWeapon: Weapon = {
  id: 'test-sword',
  name: 'Test Sword',
  type: 'martial',
  category: 'melee',
  damage: '1d8',
  properties: ['versatile'],
};

const validArmor: Armor = {
  id: 'test-mail',
  name: 'Test Mail',
  type: 'medium',
  ac: 14,
};

const validTool: Tool = {
  id: 'test-tool',
  name: 'Test Tool',
  category: 'artisan',
  rarity: 'common',
};

const validSpell: Spell = {
  id: 'test-spell',
  name: 'Test Spell',
  level: 3,
  school: 'Evocation',
  castingTime: '1 action',
  range: '60 feet',
  duration: 'Instantaneous',
  concentration: false,
  ritual: false,
  description: 'A spell used in tests.',
  components: { verbal: true, somatic: true, material: false },
};

const validEquipment: Equipment = {
  id: 'test-rope',
  name: 'Test Rope',
  type: 'other',
  quantity: 1,
  weight: 10,
};

const validFeature: Feature = {
  id: 'test-feature',
  name: 'Test Feature',
  source: 'Fighter',
  description: 'A feature used in tests.',
  uses: { total: 2, used: 1, resetOn: 'short-rest' },
};

const validPersonality: PersonalityData = {
  traits: ['Test trait'],
  ideals: ['Test ideal'],
  bonds: ['Test bond'],
  flaws: ['Test flaw'],
};

const validClass: CharacterClass = {
  name: 'Test Class',
  level: 1,
  hitDie: 'd10',
};

const validRace: CharacterRace = {
  name: 'Test Race',
  traits: ['Test trait'],
  abilityScoreIncrease: { STR: 2 },
  languages: ['Common'],
  proficiencies: [],
};

const validBackground: CharacterBackground = {
  name: 'Test Background',
  skillProficiencies: ['Insight'],
  languages: ['Common'],
  equipment: ['Test Rope'],
  feature: 'Test Feature',
};

const fullPayload: AllData = {
  weapons: [validWeapon],
  armor: [validArmor],
  tools: [validTool],
  spells: [validSpell],
  equipment: [validEquipment],
  features: [validFeature],
  personality: validPersonality,
  classes: [validClass],
  races: [validRace],
  backgrounds: [validBackground],
};

describe('dataManager', () => {
  let manager: DataManager;

  beforeEach(() => {
    resetDataManager();
    manager = getDataManager();
  });

  describe('export/import round trip', () => {
    it('preserves all ten collections through export -> import -> export', () => {
      manager.importData(JSON.stringify(fullPayload));
      const exported = manager.exportData();

      resetDataManager();
      const fresh = getDataManager();
      const result = fresh.importData(exported);

      expect(result).toEqual({ isValid: true, errors: [] });
      expect(fresh.exportData()).toBe(exported);
      expect(JSON.parse(fresh.exportData())).toEqual(fullPayload);
    });

    it('round trips the shipped default data set', () => {
      const exported = manager.exportData();

      resetDataManager();
      const fresh = getDataManager();
      const result = fresh.importData(exported);

      expect(result).toEqual({ isValid: true, errors: [] });
      expect(fresh.exportData()).toBe(exported);
      expect(fresh.getWeapons()).toEqual(manager.getWeapons());
      expect(fresh.getArmor()).toEqual(manager.getArmor());
      expect(fresh.getTools()).toEqual(manager.getTools());
      expect(fresh.getSpells()).toEqual(manager.getSpells());
      expect(fresh.getEquipment()).toEqual(manager.getEquipment());
      expect(fresh.getFeatures()).toEqual(manager.getFeatures());
      expect(fresh.getPersonalityData()).toEqual(manager.getPersonalityData());
      expect(fresh.getClasses()).toEqual(manager.getClasses());
      expect(fresh.getRaces()).toEqual(manager.getRaces());
      expect(fresh.getBackgrounds()).toEqual(manager.getBackgrounds());
    });

    it('assigns every collection from an imported payload', () => {
      const result = manager.importData(JSON.stringify(fullPayload));

      expect(result).toEqual({ isValid: true, errors: [] });
      expect(manager.getWeapons()).toEqual([validWeapon]);
      expect(manager.getArmor()).toEqual([validArmor]);
      expect(manager.getTools()).toEqual([validTool]);
      expect(manager.getSpells()).toEqual([validSpell]);
      expect(manager.getEquipment()).toEqual([validEquipment]);
      expect(manager.getFeatures()).toEqual([validFeature]);
      expect(manager.getPersonalityData()).toEqual(validPersonality);
      expect(manager.getClasses()).toEqual([validClass]);
      expect(manager.getRaces()).toEqual([validRace]);
      expect(manager.getBackgrounds()).toEqual([validBackground]);
    });

    it('does not drop collections that have no dedicated validator', () => {
      const defaultClasses = manager.getClasses();
      const defaultRaces = manager.getRaces();
      const defaultBackgrounds = manager.getBackgrounds();

      manager.importData(JSON.stringify(fullPayload));

      expect(manager.getClasses()).not.toEqual(defaultClasses);
      expect(manager.getRaces()).not.toEqual(defaultRaces);
      expect(manager.getBackgrounds()).not.toEqual(defaultBackgrounds);
    });
  });

  describe('importData error reporting', () => {
    it('returns Invalid JSON format for malformed JSON', () => {
      expect(manager.importData('{ not json')).toEqual({
        isValid: false,
        errors: ['Invalid JSON format'],
      });
    });

    it('reports invalid entries instead of silently accepting them', () => {
      const defaults = {
        tools: manager.getTools(),
        spells: manager.getSpells(),
        equipment: manager.getEquipment(),
        features: manager.getFeatures(),
      };

      const result = manager.importData(
        JSON.stringify({
          tools: [{ ...validTool, category: '' }],
          spells: [{ ...validSpell, level: 12 }],
          equipment: [{ ...validEquipment, quantity: -1 }],
          features: [{ ...validFeature, source: '' }],
        }),
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        '1 invalid tools',
        '1 invalid spells',
        '1 invalid equipment items',
        '1 invalid features',
      ]);

      // Rejected collections keep their previous contents.
      expect(manager.getTools()).toEqual(defaults.tools);
      expect(manager.getSpells()).toEqual(defaults.spells);
      expect(manager.getEquipment()).toEqual(defaults.equipment);
      expect(manager.getFeatures()).toEqual(defaults.features);
    });

    it('reports invalid weapons and armor', () => {
      const result = manager.importData(
        JSON.stringify({
          weapons: [{ ...validWeapon, damage: 'lots' }],
          armor: [{ ...validArmor, ac: 2 }],
        }),
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        '1 invalid weapons',
        '1 invalid armor items',
      ]);
    });

    it('accepts valid collections even when another collection is rejected', () => {
      const result = manager.importData(
        JSON.stringify({
          tools: [validTool],
          spells: [{ ...validSpell, concentration: 'yes' }],
        }),
      );

      expect(result.errors).toEqual(['1 invalid spells']);
      expect(manager.getTools()).toEqual([validTool]);
    });
  });

  describe('validateWeapon', () => {
    it('accepts dice damage', () => {
      expect(manager.validateWeapon(validWeapon).isValid).toBe(true);
      expect(
        manager.validateWeapon({ ...validWeapon, damage: '2d6+2' }).isValid,
      ).toBe(true);
    });

    it('accepts flat damage, as a Blowgun (1) and a Net (0) carry', () => {
      expect(
        manager.validateWeapon({ ...validWeapon, damage: '1' }).isValid,
      ).toBe(true);
      expect(
        manager.validateWeapon({ ...validWeapon, damage: '0' }).isValid,
      ).toBe(true);
    });

    it('still rejects damage that is neither dice nor a number', () => {
      const result = manager.validateWeapon({
        ...validWeapon,
        damage: 'lots',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/Damage must be dice/);
    });

    it('accepts every shipped default weapon', () => {
      const invalid = manager
        .getWeapons()
        .map((weapon) => manager.validateWeapon(weapon))
        .filter((result) => !result.isValid);

      expect(invalid).toEqual([]);
    });
  });

  describe('validateArmor', () => {
    it('accepts worn armor with a base AC', () => {
      expect(manager.validateArmor(validArmor).isValid).toBe(true);
    });

    it('accepts a shield carrying an AC bonus rather than a base AC', () => {
      expect(
        manager.validateArmor({
          id: 'shield',
          name: 'Shield',
          type: 'shield',
          ac: 2,
        }).isValid,
      ).toBe(true);
    });

    it('still requires a base AC of 10 or higher for worn armor', () => {
      const result = manager.validateArmor({ ...validArmor, ac: 2 });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('AC must be 10 or higher');
    });

    it('rejects a negative shield bonus', () => {
      const result = manager.validateArmor({
        id: 'shield',
        name: 'Shield',
        type: 'shield',
        ac: -1,
      });

      expect(result.errors).toContain('Shield AC bonus must be 0 or higher');
    });

    it('reports a missing AC', () => {
      const result = manager.validateArmor({
        ...validArmor,
        ac: undefined,
      } as unknown as Armor);

      expect(result.errors).toContain('AC is required');
    });

    it('accepts every shipped default armor entry', () => {
      const invalid = manager
        .getArmor()
        .map((armor) => manager.validateArmor(armor))
        .filter((result) => !result.isValid);

      expect(invalid).toEqual([]);
    });
  });

  describe('validateTool', () => {
    it('accepts a valid tool', () => {
      expect(manager.validateTool(validTool)).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('accepts a tool with no rarity', () => {
      const withoutRarity: Tool = {
        id: validTool.id,
        name: validTool.name,
        category: validTool.category,
      };
      expect(manager.validateTool(withoutRarity).isValid).toBe(true);
    });

    it('requires id, name and category', () => {
      const result = manager.validateTool({
        id: '',
        name: '  ',
        category: '',
      } as Tool);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID is required');
      expect(result.errors).toContain('Name is required');
      expect(result.errors).toContain('Category is required');
    });

    it('rejects an unknown rarity', () => {
      const result = manager.validateTool({
        ...validTool,
        rarity: 'mythic',
      } as unknown as Tool);

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/Rarity must be one of/);
    });
  });

  describe('validateSpell', () => {
    it('accepts a valid spell', () => {
      expect(manager.validateSpell(validSpell)).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('accepts level 0 and level 9', () => {
      expect(manager.validateSpell({ ...validSpell, level: 0 }).isValid).toBe(
        true,
      );
      expect(manager.validateSpell({ ...validSpell, level: 9 }).isValid).toBe(
        true,
      );
    });

    it('requires the descriptive string fields', () => {
      const result = manager.validateSpell({
        ...validSpell,
        id: '',
        name: '',
        school: '',
        castingTime: '',
        range: '',
        duration: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'ID is required',
        'Name is required',
        'School is required',
        'Casting time is required',
        'Range is required',
        'Duration is required',
      ]);
    });

    it.each([-1, 10, 2.5])('rejects level %s', (level) => {
      const result = manager.validateSpell({ ...validSpell, level });
      expect(result.errors).toContain(
        'Level must be an integer between 0 and 9',
      );
    });

    it('rejects non-boolean concentration and ritual', () => {
      const result = manager.validateSpell({
        ...validSpell,
        concentration: 'yes',
        ritual: 1,
      } as unknown as Spell);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Concentration must be a boolean');
      expect(result.errors).toContain('Ritual must be a boolean');
    });
  });

  describe('validateEquipment', () => {
    it('accepts a valid equipment item', () => {
      expect(manager.validateEquipment(validEquipment)).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('requires id and name', () => {
      const result = manager.validateEquipment({
        ...validEquipment,
        id: '',
        name: '',
      });

      expect(result.errors).toContain('ID is required');
      expect(result.errors).toContain('Name is required');
    });

    it('rejects an unknown type', () => {
      const result = manager.validateEquipment({
        ...validEquipment,
        type: 'relic',
      } as unknown as Equipment);

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/Type must be one of/);
    });

    it('rejects negative or non-numeric quantity and weight', () => {
      const negative = manager.validateEquipment({
        ...validEquipment,
        quantity: -1,
        weight: -0.5,
      });
      expect(negative.errors).toContain(
        'Quantity must be a non-negative number',
      );
      expect(negative.errors).toContain('Weight must be a non-negative number');

      const missing = manager.validateEquipment({
        ...validEquipment,
        quantity: undefined,
        weight: 'heavy',
      } as unknown as Equipment);
      expect(missing.errors).toContain(
        'Quantity must be a non-negative number',
      );
      expect(missing.errors).toContain('Weight must be a non-negative number');
    });

    it('accepts zero quantity and weight', () => {
      expect(
        manager.validateEquipment({
          ...validEquipment,
          quantity: 0,
          weight: 0,
        }).isValid,
      ).toBe(true);
    });
  });

  describe('validateFeature', () => {
    it('accepts a valid feature', () => {
      expect(manager.validateFeature(validFeature)).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('accepts a feature without uses', () => {
      const withoutUses: Feature = {
        id: validFeature.id,
        name: validFeature.name,
        source: validFeature.source,
        description: validFeature.description,
      };
      expect(manager.validateFeature(withoutUses).isValid).toBe(true);
    });

    it('requires id, name, source and description', () => {
      const result = manager.validateFeature({
        id: '',
        name: '',
        source: '',
        description: '',
      });

      expect(result.errors).toEqual([
        'ID is required',
        'Name is required',
        'Source is required',
        'Description is required',
      ]);
    });

    it('rejects used greater than total', () => {
      const result = manager.validateFeature({
        ...validFeature,
        uses: { total: 2, used: 3, resetOn: 'long-rest' },
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Uses used cannot exceed uses total');
    });

    it('rejects an unknown resetOn value', () => {
      const result = manager.validateFeature({
        ...validFeature,
        uses: { total: 2, used: 0, resetOn: 'monthly' },
      } as unknown as Feature);

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/Uses resetOn must be one of/);
    });
  });

  describe('validateAllData', () => {
    it('covers every validated collection', () => {
      manager.importData(JSON.stringify(fullPayload));

      // One result per weapon, armor, tool, spell, equipment and feature.
      expect(manager.validateAllData()).toHaveLength(6);
    });

    it('returns one result per entry across all six validated collections', () => {
      const expected =
        manager.getWeapons().length +
        manager.getArmor().length +
        manager.getTools().length +
        manager.getSpells().length +
        manager.getEquipment().length +
        manager.getFeatures().length;

      expect(manager.validateAllData()).toHaveLength(expected);
    });

    it('reports the shipped default data set as valid', () => {
      expect(
        manager.validateAllData().filter((result) => !result.isValid),
      ).toEqual([]);
    });

    it('surfaces invalid entries that were added after import', () => {
      manager.importData(JSON.stringify(fullPayload));
      manager.updateTool(validTool.id, { category: '' });

      const invalid = manager
        .validateAllData()
        .filter((result) => !result.isValid);

      expect(invalid).toHaveLength(1);
      expect(invalid[0].errors).toContain('Category is required');
    });
  });
});
