import { describe, expect, it } from 'vitest';
import { getAllSpecies } from '../services/dataService';
import { getSpeciesTraitText } from '../data/speciesTraitText';

// Every trait a player can click on the Species step must explain what it
// does and how to use it. A generic "provides special abilities" line told
// players nothing, so a missing entry fails here instead.
describe('species trait text', () => {
  for (const edition of ['2014', '2024'] as const) {
    it(`covers every ${edition} species trait`, () => {
      const missing: string[] = [];
      for (const species of getAllSpecies(edition)) {
        const traits = [...(species.species_traits ?? []), ...(species.traits ?? [])];
        for (const trait of traits) {
          const text = getSpeciesTraitText(trait, edition, species.traits);
          if (!text?.rules.trim() || !text.tip.trim()) {
            missing.push(`${species.name}: ${trait}`);
          }
        }
      }
      expect(missing).toEqual([]);
    });
  }

  it('uses the edition the character is built in', () => {
    expect(getSpeciesTraitText('Stonecunning', '2014')?.rules).toMatch(/History/);
    expect(getSpeciesTraitText('Stonecunning', '2024')?.rules).toMatch(/tremorsense/);
    expect(getSpeciesTraitText('Versatile', '2024')?.rules).toMatch(/Origin feat/);
  });

  it('matches parenthetical and alias names to the base trait', () => {
    expect(getSpeciesTraitText('Luck (Reroll natural 1s on d20 tests)', '2024')).toEqual(
      getSpeciesTraitText('Lucky', '2024'),
    );
    expect(getSpeciesTraitText('Nimbleness (Move through spaces of larger creatures)', '2024'))
      .not.toBeNull();
  });

  it('fills in the darkvision range the species actually has', () => {
    expect(getSpeciesTraitText('Darkvision', '2024', ['Darkvision (120 ft)'])?.rules).toMatch(
      /^Out to 120 feet/,
    );
    expect(getSpeciesTraitText('Darkvision', '2014')?.rules).toMatch(/^Out to 60 feet/);
  });
});
