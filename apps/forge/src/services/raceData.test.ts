import { describe, it, expect } from 'vitest';
import { loadSpecies } from '../services/dataService';

describe('Species Data Loading', () => {
  it('should load all species from JSON', () => {
    const species = loadSpecies();
    expect(species.length).toBeGreaterThanOrEqual(20); // Allow for consolidated canonical species plus expanded options
  });

  it('should have valid species data structure', () => {
    const species = loadSpecies();
    species.forEach(species => {
      expect(species.slug).toBeDefined();
      expect(typeof species.slug).toBe('string');
      expect(species.name).toBeDefined();
      expect(typeof species.name).toBe('string');
      expect(species.source).toBeDefined();
      expect(typeof species.source).toBe('string');
      expect(species.speed).toBeDefined();
      expect(typeof species.speed).toBe('number');
      expect(species.ability_bonuses).toBeDefined();
      expect(typeof species.ability_bonuses).toBe('object');
      expect(Array.isArray(species.species_traits)).toBe(true);
      expect(species.description).toBeDefined();
      expect(typeof species.description).toBe('string');
      expect(Array.isArray(species.typicalRoles)).toBe(true);
    });
  });

  it('should include all expected species', () => {
    const species = loadSpecies();
    const speciesSlugs = species.map(s => s.slug);

    // Core 2024
    expect(speciesSlugs).toContain('human-2024');
    expect(speciesSlugs).toContain('elf-2024');
    expect(speciesSlugs).toContain('dwarf-2024');
    expect(speciesSlugs).toContain('halfling-2024');
    expect(speciesSlugs).toContain('gnome-2024');
    expect(speciesSlugs).toContain('dragonborn-2024');
    expect(speciesSlugs).toContain('tiefling-2024');
    expect(speciesSlugs).toContain('aasimar-2024');
    expect(speciesSlugs).toContain('goliath-2024');
    expect(speciesSlugs).toContain('orc-2024');

    // Expanded / legacy
    expect(speciesSlugs).toContain('half-elf');
    expect(speciesSlugs).toContain('half-orc');
    expect(speciesSlugs).toContain('firbolg');
    expect(speciesSlugs).toContain('kenku');
    expect(speciesSlugs).toContain('tabaxi');
    expect(speciesSlugs).toContain('triton');
    expect(speciesSlugs).toContain('bugbear');
    expect(speciesSlugs).toContain('goblin');
    expect(speciesSlugs).toContain('hobgoblin');
    expect(speciesSlugs).toContain('kobold');
    expect(speciesSlugs).toContain('yuan-ti-pureblood');
    expect(speciesSlugs).toContain('fairy');
    expect(speciesSlugs).toContain('harengon');
    expect(speciesSlugs).toContain('loxodon');
    expect(speciesSlugs).toContain('owlin');
    expect(speciesSlugs).toContain('githyanki');
    expect(speciesSlugs).toContain('genasi');
  });

  it('should have correct ability bonuses for human', () => {
    const species = loadSpecies();
    const human = species.find(s => s.slug === 'human-2024');
    expect(human).toBeDefined();
    expect(human?.ability_bonuses).toEqual({});
  });

  it('should have correct data for elf', () => {
    const species = loadSpecies();
    const elf = species.find(s => s.slug === 'elf-2024');
    expect(elf).toBeDefined();
    expect(elf?.name).toBe('Elf');
    expect(elf?.core).toBe(true);
    expect(elf?.speed).toBeGreaterThanOrEqual(30);
    expect(elf?.ability_bonuses).toEqual({});
    expect(elf?.species_traits).toContain('Darkvision');
  });

  it('should have valid speed values', () => {
    const species = loadSpecies();
    species.forEach(species => {
      expect(species.speed).toBeGreaterThanOrEqual(20);
      expect(species.speed).toBeLessThanOrEqual(40);
    });
  });

  it('should have valid ability bonus values', () => {
    const species = loadSpecies();
    species.forEach(species => {
      if (species.ability_bonuses) {
        Object.values(species.ability_bonuses).forEach(bonus => {
          expect(bonus).toBeGreaterThanOrEqual(-2);
          expect(bonus).toBeLessThanOrEqual(3);
        });
      }
    });
  });
});
