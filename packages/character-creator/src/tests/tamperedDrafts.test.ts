import { describe, expect, it } from 'vitest';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { evaluateDraft } from '../services/draftEvaluator';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';

type Mutation = {
  name: string;
  apply: (d: CharacterCreationData) => CharacterCreationData | undefined;
};
const clone = (d: CharacterCreationData) => structuredClone(d);
const mutations: Mutation[] = [
  {
    name: 'duplicate-skill',
    apply: (d) => {
      if (!d.selectedSkills?.length) return;
      const c = clone(d);
      c.selectedSkills = [...c.selectedSkills!, c.selectedSkills![0]];
      return c;
    },
  },
  {
    name: 'missing-skill',
    apply: (d) => {
      if (!d.selectedSkills?.length) return;
      const c = clone(d);
      c.selectedSkills = c.selectedSkills!.slice(0, -1);
      return c;
    },
  },
  {
    name: 'unknown-skill',
    apply: (d) => {
      if (!d.selectedSkills?.length) return;
      const c = clone(d);
      c.selectedSkills = [
        ...c.selectedSkills!.slice(0, -1),
        'Basketweaving' as never,
      ];
      return c;
    },
  },
  {
    name: 'unknown-cantrip',
    apply: (d) => {
      if (!d.spellSelection?.selectedCantrips?.length) return;
      const c = clone(d);
      c.spellSelection.selectedCantrips = [
        ...c.spellSelection.selectedCantrips.slice(0, -1),
        'not-a-spell',
      ];
      return c;
    },
  },
  {
    name: 'duplicate-cantrip',
    apply: (d) => {
      if (!d.spellSelection?.selectedCantrips?.length) return;
      const c = clone(d);
      c.spellSelection.selectedCantrips = [
        ...c.spellSelection.selectedCantrips,
        c.spellSelection.selectedCantrips[0],
      ];
      return c;
    },
  },
  {
    name: 'missing-cantrip',
    apply: (d) => {
      if (!d.spellSelection?.selectedCantrips?.length) return;
      const c = clone(d);
      c.spellSelection.selectedCantrips =
        c.spellSelection.selectedCantrips.slice(0, -1);
      return c;
    },
  },
  {
    name: 'too-high-level-spell',
    apply: (d) => {
      const list =
        d.spellSelection?.preparedSpells ?? d.spellSelection?.knownSpells;
      if (!list?.length) return;
      const c = clone(d);
      const key = c.spellSelection.preparedSpells
        ? 'preparedSpells'
        : 'knownSpells';
      (c.spellSelection as never as Record<string, string[]>)[key] = [
        ...list.slice(0, -1),
        'wish',
      ];
      return c;
    },
  },
  {
    name: 'extra-spell',
    apply: (d) => {
      const list =
        d.spellSelection?.preparedSpells ?? d.spellSelection?.knownSpells;
      if (!list?.length) return;
      const c = clone(d);
      const key = c.spellSelection.preparedSpells
        ? 'preparedSpells'
        : 'knownSpells';
      (c.spellSelection as never as Record<string, string[]>)[key] = [
        ...list,
        'sleep',
      ];
      return c;
    },
  },
  {
    name: 'background-bonus-not-allowed',
    apply: (d) => {
      if (!d.backgroundAbilityChoices) return;
      const c = clone(d);
      c.backgroundAbilityChoices = {
        method: '2/1',
        bonuses: { STR: 1, DEX: 1 },
      } as never;
      // Pick an ability set that cannot be right for any SRD background.
      return c;
    },
  },
  {
    name: 'background-bonus-too-large',
    apply: (d) => {
      if (!d.backgroundAbilityChoices) return;
      const c = clone(d);
      const first = Object.keys(d.backgroundAbilityChoices.bonuses)[0];
      c.backgroundAbilityChoices = {
        method: '2/1',
        bonuses: { [first]: 3 },
      } as never;
      return c;
    },
  },
  {
    name: 'wrong-edition-species',
    apply: (d) => {
      const c = clone(d);
      c.speciesSlug = d.edition === '2024' ? 'half-orc' : 'orc-2024';
      return c;
    },
  },
  {
    name: 'unknown-species',
    apply: (d) => {
      const c = clone(d);
      c.speciesSlug = 'not-a-species';
      return c;
    },
  },
  {
    name: 'unknown-background',
    apply: (d) => {
      const c = clone(d);
      c.background = 'not-a-background';
      return c;
    },
  },
  {
    name: 'unknown-class',
    apply: (d) => {
      const c = clone(d);
      c.classSlug = 'not-a-class';
      return c;
    },
  },
  {
    name: 'level-zero',
    apply: (d) => {
      const c = clone(d);
      c.level = 0;
      return c;
    },
  },
  {
    name: 'level-twenty-one',
    apply: (d) => {
      const c = clone(d);
      c.level = 21;
      return c;
    },
  },
  {
    name: 'edition-mismatch',
    apply: (d) => {
      const c = clone(d);
      c.edition = d.edition === '2024' ? '2014' : '2024';
      return c;
    },
  },
  {
    name: 'ability-score-out-of-range',
    apply: (d) => {
      const c = clone(d);
      c.abilities = { ...c.abilities, STR: 99 };
      return c;
    },
  },
  {
    name: 'bad-equipment-selection',
    apply: (d) => {
      if (!d.equipmentChoices?.length) return;
      const c = clone(d);
      c.equipmentChoices[0] = { ...c.equipmentChoices[0], selected: 99 };
      return c;
    },
  },
  {
    name: 'class-changed-keep-answers',
    apply: (d) => {
      const c = clone(d);
      c.classSlug = d.classSlug === 'fighter' ? 'wizard' : 'fighter';
      return c;
    },
  },
];

/**
 * Tranche T-05: tampered or imported drafts must fail canonical validation at
 * the evaluator boundary even though the wizard UI normally prevents them. Each
 * mutation applies to every reference build it makes sense for.
 */
const errorsFor = (data: CharacterCreationData) => {
  try {
    return evaluateDraft(creationDataToDraft(data)).issues.filter(
      (issue) => issue.severity === 'error',
    );
  } catch {
    return [{ id: 'THROWS' }];
  }
};

describe('canonical evaluation rejects tampered drafts', () => {
  it.each(Object.keys(REFERENCE_BUILDS))('%s is valid untouched', (id) => {
    expect(errorsFor(REFERENCE_BUILDS[id].creationData)).toEqual([]);
  });

  describe.each(mutations)('$name', (mutation) => {
    it.each(Object.keys(REFERENCE_BUILDS))('is rejected for %s', (id) => {
      const mutated = mutation.apply(REFERENCE_BUILDS[id].creationData);
      if (!mutated) return; // not applicable to this build
      expect(errorsFor(mutated).length).toBeGreaterThan(0);
    });
  });

  it('applies each mutation to a meaningful number of builds', () => {
    // Guards against a mutation silently becoming a no-op.
    const applied = (name: string) =>
      Object.values(REFERENCE_BUILDS).filter((oracle) =>
        mutations
          .find((entry) => entry.name === name)!
          .apply(oracle.creationData),
      ).length;
    expect(applied('duplicate-skill')).toBe(24);
    expect(applied('unknown-class')).toBe(24);
    expect(applied('level-zero')).toBe(24);
    expect(applied('bad-equipment-selection')).toBe(23);
    expect(applied('unknown-cantrip')).toBe(12);
    expect(applied('background-bonus-too-large')).toBe(12);
  });

  it('reports the specific reason for the structural failures', () => {
    const base = REFERENCE_BUILDS.F24.creationData;
    expect(errorsFor({ ...base, level: 0 }).map((issue) => issue.id)).toContain(
      'INVALID_LEVEL',
    );
    expect(
      errorsFor({ ...base, level: 2.5 }).map((issue) => issue.id),
    ).toContain('INVALID_LEVEL');
    const bad = structuredClone(base);
    bad.equipmentChoices[0] = { ...bad.equipmentChoices[0], selected: 99 };
    expect(errorsFor(bad).map((issue) => issue.id)).toContain(
      'INVALID_EQUIPMENT_CHOICE',
    );
  });

  it('requires the 2014 High Elf wizard cantrip as well as allowing it', () => {
    const base = structuredClone(REFERENCE_BUILDS.W14.creationData);
    base.spellSelection.selectedCantrips =
      base.spellSelection.selectedCantrips.slice(0, -1);
    expect(errorsFor(base).map((issue) => issue.id)).toContain(
      'INSUFFICIENT_CANTRIPS_SELECTED',
    );
  });

  it('keeps the player’s other answers when a draft is rejected', () => {
    const base = REFERENCE_BUILDS.R24.creationData;
    const mutated = {
      ...base,
      selectedSkills: [...base.selectedSkills!, 'Arcana' as never],
    };
    const evaluation = evaluateDraft(creationDataToDraft(mutated));
    expect(evaluation.isValid).toBe(false);
    expect(evaluation.draft.creationData?.expertiseSkills).toEqual(
      base.expertiseSkills,
    );
    expect(evaluation.draft.creationData?.originFeat).toBe(base.originFeat);
    expect(evaluation.draft.creationData?.weaponMastery).toEqual(
      base.weaponMastery,
    );
  });
});
