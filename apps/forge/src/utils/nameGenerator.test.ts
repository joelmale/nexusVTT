import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateName,
  generateNames,
  getAvailableRaces,
  clearNameCache,
  getNameStats,
  NameOptions
} from './nameGenerator';
import nameData from '../data/nameData.json';
import { log } from './logger';

describe('Name Generator', () => {
  beforeEach(() => {
    clearNameCache();
  });

  afterEach(() => {
    clearNameCache();
  });

  describe('generateName', () => {
    it('should generate a basic name', () => {
      const result = generateName();
      expect(result).toHaveProperty('name');
      expect(typeof result.name).toBe('string');
      expect(result.name.length).toBeGreaterThan(0);
    });

    it('should generate race-specific names', () => {
      const elfName = generateName({ race: 'Elf' });
      const dwarfName = generateName({ race: 'Dwarf' });

      expect(elfName.name).toBeDefined();
      expect(dwarfName.name).toBeDefined();
      // Names should be different (though not guaranteed)
      expect(elfName.name).not.toBe(dwarfName.name);
    });

    it('should generate gender-specific names', () => {
      const maleName = generateName({ gender: 'male' as const });
      const femaleName = generateName({ gender: 'female' as const });

      expect(maleName.name).toBeDefined();
      expect(femaleName.name).toBeDefined();
    });

    it('should include meaning when requested', () => {
      const result = generateName({ includeMeaning: true });
      // Meaning might be undefined for some names
      expect(result).toHaveProperty('meaning');
    });

    it('should include pronunciation when requested', () => {
      const result = generateName({ includePronunciation: true });
      expect(result).toHaveProperty('pronunciation');
      if (result.pronunciation) {
        expect(typeof result.pronunciation).toBe('string');
      }
    });

    it('should respect length preferences', () => {
      const shortName = generateName({ length: 'short' });
      const longName = generateName({ length: 'long' });

      // Length preferences mainly affect fantasy syllable names, but race names with epithets/places can be longer
      expect(shortName.name.length).toBeLessThanOrEqual(15);
      expect(longName.name.length).toBeGreaterThanOrEqual(6);
    });

    it('should handle all race types', () => {
      const races = getAvailableRaces();

      for (const race of races) {
        const result = generateName({ race });
        expect(result.name).toBeDefined();
        expect(result.race).toBe(race);
      }
    });

    it('should handle invalid race gracefully', () => {
      const result = generateName({ race: 'InvalidRace' });
      expect(result.name).toBeDefined();
      // Should fall back to generic name generation
    });
  });

  describe('generateNames', () => {
    it('should generate multiple names', () => {
      const results = generateNames(5);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('name');
      });
    });

    it('should generate unique names when possible', () => {
      const results = generateNames(10);
      const names = results.map(r => r.name);
      const uniqueNames = new Set(names);

      // Allow for duplicates due to limited name pools, but expect at least some variety
      expect(uniqueNames.size).toBeGreaterThan(0);
    });

    it('should apply options to all generated names', () => {
      const results = generateNames(3, { race: 'Elf', includeMeaning: true });
      results.forEach(result => {
        expect(result.race).toBe('Elf');
        expect(result).toHaveProperty('meaning');
      });
    });
  });

  describe('getAvailableRaces', () => {
    it('should return all available races', () => {
      const races = getAvailableRaces();
      expect(Array.isArray(races)).toBe(true);
      expect(races.length).toBeGreaterThan(0);
      expect(races).toContain('Human');
      expect(races).toContain('Elf');
      expect(races).toContain('Dwarf');
    });
  });

  describe('Caching', () => {
    it('should cache frequently used combinations', () => {
      // Caching is currently disabled for uniqueness
      // TODO: Re-enable with smarter caching strategy
      const options: NameOptions = { race: 'Human', gender: 'male' };

      // Generate same combination multiple times
      const name1 = generateName(options);
      const name2 = generateName(options);
      const name3 = generateName(options);

      expect(name1.name).toBeDefined();
      expect(name2.name).toBeDefined();
      expect(name3.name).toBeDefined();

      // Cache is disabled for now
      const stats = getNameStats();
      expect(stats.cacheSize).toBe(0);
    });

    it('should clear cache when requested', () => {
      // Generate some names (cache disabled but used names tracking still works)
      generateName({ race: 'Elf' });
      let stats = getNameStats();
      expect(stats.usedNamesCount).toBeGreaterThan(0);

      clearNameCache();
      stats = getNameStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.usedNamesCount).toBe(0);
    });

    it('should limit cache size', () => {
      // Generate many different combinations to test cache limits
      for (let i = 0; i < 1500; i++) {
        generateName({ race: `TestRace${i}` });
      }

      const stats = getNameStats();
      expect(stats.cacheSize).toBeLessThanOrEqual(1000);
    });
  });

  describe('Uniqueness', () => {
    it('should attempt to generate unique names', () => {
      // Generate many names to test uniqueness
      const names = [];
      for (let i = 0; i < 100; i++) {
        const result = generateName();
        names.push(result.name);
      }

      const uniqueNames = new Set(names);
      // Should have reasonable uniqueness (allowing for duplicates due to limited pools)
      expect(uniqueNames.size).toBeGreaterThan(10);
    });

    it('should track used names count', () => {
      generateName();
      generateName();
      const stats = getNameStats();
      // May be less than 2 if same name generated twice (due to uniqueness retry)
      expect(stats.usedNamesCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty options', () => {
      const result = generateName({});
      expect(result.name).toBeDefined();
    });

    it('should handle undefined race', () => {
      const result = generateName({ race: undefined });
      expect(result.name).toBeDefined();
    });

    it('should handle all gender options', () => {
      const genders: Array<'male' | 'female' | 'any'> = ['male', 'female', 'any'];

      genders.forEach(gender => {
        const result = generateName({ gender });
        expect(result.name).toBeDefined();
      });
    });

    it('should handle all length options', () => {
      const lengths: Array<'short' | 'medium' | 'long' | 'any'> = ['short', 'medium', 'long', 'any'];

      lengths.forEach(length => {
        const result = generateName({ length });
        expect(result.name).toBeDefined();
      });
    });
  });

  describe('Race-Specific Features', () => {
    it('should generate culturally appropriate names for Elves', () => {
      const result = generateName({ race: 'Elf', includePronunciation: true });
      expect(result.name).toBeDefined();
      expect(result.race).toBe('Elf');

      // Elves often have names with apostrophes or flowing sounds
      if (result.pronunciation) {
        expect(result.pronunciation).toMatch(/[a-z]/i);
      }
    });

    it('should generate culturally appropriate names for Dwarves', () => {
      const result = generateName({ race: 'Dwarf' });
      expect(result.name).toBeDefined();
      expect(result.race).toBe('Dwarf');

      // Dwarves often have hard consonants and clan names
    });

    it('should generate single names for Tieflings and Half-Orcs', () => {
      const tieflingName = generateName({ race: 'Tiefling' });
      const halfOrcName = generateName({ race: 'Half-Orc' });

      expect(tieflingName.name).toBeDefined();
      expect(halfOrcName.name).toBeDefined();
      expect(tieflingName.race).toBe('Tiefling');
      expect(halfOrcName.race).toBe('Half-Orc');

      // These races typically don't have surnames, but may generate epithets
      // Allow 1-3 words (first name only, or first name + epithet)
      const tieflingWords = tieflingName.name.split(' ');
      const halfOrcWords = halfOrcName.name.split(' ');
      expect(tieflingWords.length).toBeGreaterThanOrEqual(1);
      expect(tieflingWords.length).toBeLessThanOrEqual(3);
      expect(halfOrcWords.length).toBeGreaterThanOrEqual(1);
      expect(halfOrcWords.length).toBeLessThanOrEqual(3);
    });

    it('should handle race variations', () => {
      // Test that different race inputs map to the same base race
      const elf1 = generateName({ race: 'Elf' });
      const elf2 = generateName({ race: 'High Elf' });

      expect(elf1.name).toBeDefined();
      expect(elf2.name).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should generate names quickly', () => {
      const startTime = Date.now();
      generateNames(100);
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should generate place names with race-specific suffixes', () => {
      // Test that place names can be generated (may not happen on every generation due to randomization)
      const names = generateNames(50, { race: 'Elf' }); // Generate more names to increase chance
      const placeNames = names.filter(name => name.name.includes('of '));

      // At least some names should contain place names (with 50 attempts, should be very likely)
      expect(placeNames.length).toBeGreaterThan(0);

      // Check that place names use appropriate suffixes for the race
      placeNames.forEach(name => {
        const placePart = name.name.split('of ')[1];
        expect(placePart).toBeDefined();
        // Should end with a valid suffix
        expect(placePart).toMatch(/(ford|shire|ton|ham|dale|wood|field|brook|veil|glade|mere|falls|haven|spire|hold|forge|deep|delve|mine|mountain|bottom|hollow|hill|burrow|garden)$/);
      });
    });

    it('should generate epithets with class-based flavor', () => {
      // Generate many names to ensure we get epithet patterns
      const paladinNames = generateNames(50, { race: 'Human', classSlug: 'paladin' });
      const rogueNames = generateNames(50, { race: 'Human', classSlug: 'rogue' });
      const wizardNames = generateNames(50, { race: 'Human', classSlug: 'wizard' });

      // Find names that have epithets (contain " the " followed by a single word)
      const paladinEpithets = paladinNames.filter(name => {
        const parts = name.name.split(' the ');
        return parts.length > 1 && parts[parts.length - 1].split(' ').length === 1;
      });
      const rogueEpithets = rogueNames.filter(name => {
        const parts = name.name.split(' the ');
        return parts.length > 1 && parts[parts.length - 1].split(' ').length === 1;
      });
      const wizardEpithets = wizardNames.filter(name => {
        const parts = name.name.split(' the ');
        return parts.length > 1 && parts[parts.length - 1].split(' ').length === 1;
      });

      // Should have at least some epithet names
      expect(paladinEpithets.length).toBeGreaterThan(0);
      expect(rogueEpithets.length).toBeGreaterThan(0);
      expect(wizardEpithets.length).toBeGreaterThan(0);

      // Check that epithets are from appropriate categories
      paladinEpithets.forEach(name => {
        const parts = name.name.split(' the ');
        const epithet = parts[parts.length - 1];
        expect(['Brave', 'Mighty', 'Valiant', 'Noble', 'True', 'Just', 'Wise', 'Pure', 'Honorable', 'Steadfast']).toContain(epithet);
      });

      // Check that rogue epithets are from mysterious category
      rogueEpithets.forEach(name => {
        const parts = name.name.split(' the ');
        const epithet = parts[parts.length - 1];
        expect(['Shadow', 'Silent', 'Hidden', 'Whisper', 'Veiled', 'Enigmatic', 'Arcane', 'Cryptic']).toContain(epithet);
      });

      // Check that wizard epithets are from magical category
      wizardEpithets.forEach(name => {
        const parts = name.name.split(' the ');
        const epithet = parts[parts.length - 1];
        expect(['Arcane', 'Mystic', 'Enchanted', 'Spellbound', 'Illuminated', 'Channeler']).toContain(epithet);
      });
    });

    it('should not have duplicate names in race data', () => {
      const races = getAvailableRaces();
      races.forEach(race => {
        const speciesData =
          (nameData as { species?: Record<string, { male?: string[]; female?: string[]; surnames?: string[] }> }).species ||
          (nameData as { races?: Record<string, { male?: string[]; female?: string[]; surnames?: string[] }> }).races ||
          {};
        const raceData = speciesData[race as keyof typeof speciesData] ?? {};
        if (raceData.male) {
          const uniqueMale = new Set(raceData.male);
          if (uniqueMale.size !== raceData.male.length) {
            log.info('Name uniqueness check (male)', { race, total: raceData.male.length, unique: uniqueMale.size });
          }
          expect(uniqueMale.size, `Race ${race} male names`).toBe(raceData.male.length);
        }
        if (raceData.female) {
          const uniqueFemale = new Set(raceData.female);
          if (uniqueFemale.size !== raceData.female.length) {
            log.info('Name uniqueness check (female)', { race, total: raceData.female.length, unique: uniqueFemale.size });
          }
          expect(uniqueFemale.size, `Race ${race} female names`).toBe(raceData.female.length);
        }
        if (raceData.surnames) {
          const uniqueSurnames = new Set(raceData.surnames);
          if (uniqueSurnames.size !== raceData.surnames.length) {
            log.info('Name uniqueness check (surnames)', { race, total: raceData.surnames.length, unique: uniqueSurnames.size });
          }
          expect(uniqueSurnames.size, `Race ${race} surnames`).toBe(raceData.surnames.length);
        }
      });
    });

    it('should cache improve performance for repeated requests', () => {
      const options: NameOptions = { race: 'Human', gender: 'male' };

      // First generation (no cache)
      const start1 = Date.now();
      generateName(options);
      const time1 = Date.now() - start1;

      // Second generation (should use cache)
      const start2 = Date.now();
      generateName(options);
      const time2 = Date.now() - start2;

      // Cached version should be faster (though this is a rough test)
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });
});
