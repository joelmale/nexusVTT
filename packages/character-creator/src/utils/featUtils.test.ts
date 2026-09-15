import { describe, expect, it } from 'vitest';
import { checkFeatPrerequisites, getAvailableFeatsForCharacter, getFeatAvailability } from './featUtils';
import { loadFeats, resolveSpeciesSlug } from '../services/dataService';
import { Feat } from '../types/dnd';

const buildAbilities = (score = 10) => ({
  STR: score,
  DEX: score,
  CON: score,
  INT: score,
  WIS: score,
  CHA: score
});

describe('featUtils - prerequisite enforcement', () => {
  const feats = loadFeats();
  const dwarfFortitude = feats.find(f => f.slug === 'dwarf-fortitude');
  const dragonHide = feats.find(f => f.slug === 'dragon-hide');
  const mockElfFeat: Feat = {
    slug: 'elf-only',
    name: 'Elf Only',
    source: 'TEST',
    year: 2014,
    category: 'general',
    prerequisite: 'Elf',
    benefits: ['Test benefit'],
    description: 'Requires Elf'
  };
  const mockOrcFeat: Feat = {
    slug: 'orc-only',
    name: 'Orc Only',
    source: 'TEST',
    year: 2014,
    category: 'general',
    prerequisite: 'Orc',
    benefits: ['Test benefit'],
    description: 'Requires Orc'
  };

  it('blocks species-specific feats for the wrong species', () => {
    const human = {
      level: 5,
      classSlug: 'wizard',
      abilities: buildAbilities(),
      speciesSlug: resolveSpeciesSlug('human')
    };

    expect(dwarfFortitude).toBeDefined();
    expect(dragonHide).toBeDefined();
    expect(checkFeatPrerequisites(dwarfFortitude!, human)).toBe(false);
    expect(checkFeatPrerequisites(dragonHide!, human)).toBe(false);
  });

  it('allows species-specific feats when species matches', () => {
    const dwarf = {
      level: 5,
      classSlug: 'wizard',
      abilities: buildAbilities(),
      speciesSlug: resolveSpeciesSlug('dwarf')
    };

    expect(checkFeatPrerequisites(dwarfFortitude!, dwarf)).toBe(true);
  });

  it('treats half-elf as satisfying elf prerequisites', () => {
    const halfElf = {
      level: 5,
      classSlug: 'wizard',
      abilities: buildAbilities(),
      speciesSlug: resolveSpeciesSlug('half-elf')
    };

    expect(checkFeatPrerequisites(mockElfFeat, halfElf)).toBe(true);
  });

  it('treats half-orc as satisfying orc prerequisites', () => {
    const halfOrc = {
      level: 5,
      classSlug: 'wizard',
      abilities: buildAbilities(),
      speciesSlug: resolveSpeciesSlug('half-orc')
    };

    expect(checkFeatPrerequisites(mockOrcFeat, halfOrc)).toBe(true);
  });

  it('filters unavailable feats out of ASI selection', () => {
    const humanFeats = getAvailableFeatsForCharacter(
      feats,
      {
        level: 5,
        classSlug: 'wizard',
        abilities: buildAbilities(),
        speciesSlug: resolveSpeciesSlug('human')
      },
      'asi'
    );

    const featSlugs = humanFeats.map(f => f.slug);
    expect(featSlugs).not.toContain('dwarf-fortitude');
    expect(featSlugs).not.toContain('dragon-hide');
  });

  it('returns a reason when a feat is unavailable', () => {
    const human = {
      level: 5,
      classSlug: 'wizard',
      abilities: buildAbilities(),
      speciesSlug: resolveSpeciesSlug('human')
    };

    const availability = getFeatAvailability(dwarfFortitude!, human);
    expect(availability.isAvailable).toBe(false);
    expect(availability.reason?.toLowerCase()).toContain('dwarf');
  });
});
