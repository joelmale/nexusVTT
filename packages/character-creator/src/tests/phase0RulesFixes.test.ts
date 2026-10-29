import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';
import {
  getWizardSpellbookSize,
  pruneSpellSelectionForClass,
} from '../utils/spellSelectionRules';
import { getScoresBeforeLevelUpChoices } from '../utils/creationAbilities';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import {
  getRemainingFeatSlots,
  canSelectMoreFeats,
} from '../utils/featUtils';
import { getSubclassesByClass, loadClasses } from '../services/dataService';
import { pickRecommendedClassSkills } from '../services/recommendationService';
import { describePactMagic } from '../components/CharacterCreationWizard/widgets/AutomaticWidget';

const wizard = (REFERENCE_BUILDS.W24.creationData as CharacterCreationData);

describe('wizard spellbook size', () => {
  it('is 6 at level 1 and gains 2 per level', () => {
    expect(getWizardSpellbookSize(1)).toBe(6);
    expect(getWizardSpellbookSize(5)).toBe(14);
    expect(getWizardSpellbookSize(20)).toBe(44);
  });
});

describe('class change pruning', () => {
  it('drops wizard picks that are not on the warlock list', () => {
    const selection = {
      selectedCantrips: ['fire-bolt', 'mage-hand', 'eldritch-blast'],
      spellbook: ['magic-missile', 'hex'],
      dailyPrepared: ['magic-missile'],
    };
    const pruned = pruneSpellSelectionForClass(selection, 'warlock', '2024');
    expect(pruned.selectedCantrips).not.toContain('fire-bolt');
    expect(pruned.selectedCantrips).toContain('eldritch-blast');
    expect(pruned.spellbook).not.toContain('magic-missile');
    expect(pruned.dailyPrepared).toEqual([]);
  });

  it('returns the same object when nothing needs pruning', () => {
    const selection = { selectedCantrips: ['fire-bolt'], spellbook: ['shield'] };
    expect(pruneSpellSelectionForClass(selection, 'wizard', '2024')).toBe(
      selection,
    );
  });

  it('clears every pick for a class with no spell list', () => {
    const pruned = pruneSpellSelectionForClass(
      { selectedCantrips: ['fire-bolt'], preparedSpells: ['shield'] },
      'fighter',
      '2024',
    );
    expect(pruned.selectedCantrips).toEqual([]);
    expect(pruned.preparedSpells).toEqual([]);
  });
});

describe('background bonuses in level-up steps', () => {
  const level5: CharacterCreationData = { ...wizard, level: 5 };

  it('counts the background CON bonus in the scores the ASI step shows', () => {
    const scores = getScoresBeforeLevelUpChoices(level5);
    expect(scores.CON).toBe(level5.abilities.CON + 1);
    expect(scores.INT).toBe(level5.abilities.INT + 2);
  });

  it('leaves level-up ASI out unless asked, and matches the final character when included', () => {
    const withAsi: CharacterCreationData = {
      ...level5,
      cumulativeASI: [
        {
          level: 4,
          type: 'asi',
          asiAllocations: { STR: 0, DEX: 0, CON: 2, INT: 0, WIS: 0, CHA: 0 },
        },
      ],
    };
    expect(getScoresBeforeLevelUpChoices(withAsi).CON).toBe(
      level5.abilities.CON + 1,
    );
    expect(
      getScoresBeforeLevelUpChoices(withAsi, { includeLevelUpChoices: true })
        .CON,
    ).toBe(calculateCharacterStats(withAsi).abilities.CON.score);
  });

  it('falls back to base scores when the draft is incomplete', () => {
    const scores = getScoresBeforeLevelUpChoices({
      ...level5,
      speciesSlug: '',
    });
    expect(scores).toEqual(level5.abilities);
  });
});

describe('feat slots', () => {
  it('does not offer a second feat once the ASI step used the level-4 slot', () => {
    const level5 = { ...wizard, level: 5, speciesSlug: 'elf-2024' };
    expect(getRemainingFeatSlots({ ...level5, cumulativeASI: [] } as never)).toBe(1);
    const used = {
      ...level5,
      cumulativeASI: [{ level: 4, type: 'asi' as const }],
    } as unknown as CharacterCreationData;
    expect(getRemainingFeatSlots(used)).toBe(0);
    expect(canSelectMoreFeats([], used)).toBe(false);
  });
});

describe('subclass catalog', () => {
  it.each(['2014', '2024'] as const)(
    'lists each subclass once and keeps flavor text clean (%s)',
    (edition) => {
      for (const cls of loadClasses(edition)) {
        const subclasses = getSubclassesByClass(cls.slug, edition);
        const slugs = subclasses.map((entry) => entry.slug);
        expect(new Set(slugs).size, `${cls.slug} ${edition}`).toBe(slugs.length);
        for (const entry of subclasses)
          expect(entry.subclassFlavor ?? '').not.toMatch(/requires review/i);
      }
    },
  );
});

describe('pact magic copy', () => {
  it('follows the Warlock slot table', () => {
    expect(describePactMagic(1)).toContain('one 1st-level spell slot,');
    expect(describePactMagic(5)).toContain('two 3rd-level spell slots');
    expect(describePactMagic(11)).toContain('three 5th-level spell slots');
  });
});

describe('guided class skills', () => {
  const fighterSkills = [
    'Acrobatics',
    'Animal Handling',
    'Athletics',
    'History',
    'Insight',
    'Intimidation',
    'Perception',
    'Survival',
  ];

  it('prefers fighter-relevant skills over alphabetical order', () => {
    expect(
      pickRecommendedClassSkills('fighter', fighterSkills, new Set(), 2),
    ).toEqual(['Athletics', 'Perception']);
  });

  it('skips skills the background already grants', () => {
    expect(
      pickRecommendedClassSkills(
        'fighter',
        fighterSkills,
        new Set(['Athletics']),
        2,
      ),
    ).toEqual(['Perception', 'Intimidation']);
  });

  it('falls back to list order when preferences run out', () => {
    expect(
      pickRecommendedClassSkills('unknown', fighterSkills, new Set(), 2),
    ).toEqual(['Acrobatics', 'Animal Handling']);
  });
});
