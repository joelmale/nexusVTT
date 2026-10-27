import { loadSpells, type AppSpell } from './dataService';
import type { Edition } from '../types/dnd';

interface FeatSpellRule {
  key: string;
  label: string;
  level: number;
  eligible: (spell: AppSpell) => boolean;
}

export interface FeatSpellChoiceField {
  key: string;
  label: string;
  level: number;
  options: AppSpell[];
}

/** Feats whose spells are chosen by the player rather than fixed by the feat. */
const FEAT_SPELL_RULES: Record<string, FeatSpellRule[]> = {
  'fey-touched': [
    {
      key: 'spell',
      label: 'Divination or enchantment spell',
      level: 1,
      eligible: (spell) =>
        ['divination', 'enchantment'].includes(spell.school.toLowerCase()),
    },
  ],
  'spell-sniper': [
    {
      key: 'cantrip',
      label: 'Cantrip that requires an attack roll',
      level: 0,
      eligible: (spell) => /spell attack/i.test(spell.description),
    },
  ],
  'artificer-initiate': [
    {
      key: 'cantrip',
      label: 'Artificer cantrip',
      level: 0,
      eligible: (spell) => spell.classes.includes('artificer'),
    },
    {
      key: 'spell',
      label: 'Artificer 1st-level spell',
      level: 1,
      eligible: (spell) => spell.classes.includes('artificer'),
    },
  ],
};

export function featSpellChoiceFields(
  featSlug: string,
  edition: Edition,
): FeatSpellChoiceField[] {
  const rules = FEAT_SPELL_RULES[featSlug];
  if (!rules) return [];
  const catalog = loadSpells(edition);
  return rules.map(({ key, label, level, eligible }) => ({
    key,
    label,
    level,
    options: catalog.filter(
      (spell) => spell.level === level && eligible(spell),
    ),
  }));
}

/** The spell slug a recorded choice resolves to, or undefined if not legal. */
export function resolveFeatSpellChoice(
  edition: Edition,
  featSlug: string,
  key: string,
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  return featSpellChoiceFields(featSlug, edition)
    .find((field) => field.key === key)
    ?.options.find((spell) => spell.slug === value)?.slug;
}

/**
 * True when every field that has eligible options holds a legal choice.
 * A field with no eligible spells in the current catalog cannot be chosen, so
 * it does not block the feat (it simply grants nothing).
 */
export function featSpellChoicesComplete(
  featSlug: string,
  edition: Edition,
  choices: Record<string, unknown> | undefined,
): boolean {
  return featSpellChoiceFields(featSlug, edition).every(
    (field) =>
      field.options.length === 0 ||
      resolveFeatSpellChoice(
        edition,
        featSlug,
        field.key,
        choices?.[field.key],
      ) !== undefined,
  );
}
