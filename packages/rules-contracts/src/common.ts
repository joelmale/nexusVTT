import { z } from 'zod';

/**
 * Shared primitives for D&D 5e rules entities.
 *
 * Every entity carries an explicit `ruleset` so 2014 (SRD 5.1) and 2024
 * (SRD 5.2) content can never be mixed silently (control-plane invariant 8).
 */

export const RULES_SCHEMA_VERSION = 1 as const;

export const RulesetSchema = z.enum(['2014', '2024']);
export type Ruleset = z.infer<typeof RulesetSchema>;

/**
 * Entity types with a verified contract. Classes, species, backgrounds and
 * features are deliberately out of scope until their consumers exist; see
 * apps/docs/codex/rules-registry.md.
 */
export const RulesEntityTypeSchema = z.enum(['spell', 'item', 'monster']);
export type RulesEntityType = z.infer<typeof RulesEntityTypeSchema>;

export const RulesRevisionStatusSchema = z.enum([
  'draft',
  'validated',
  'published',
  'superseded',
]);
export type RulesRevisionStatus = z.infer<typeof RulesRevisionStatusSchema>;

/** Stable, human-readable identifier: lowercase kebab-case. */
export const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case');

export const NameSchema = z.string().trim().min(1).max(200);
export const RulesTextSchema = z.string().trim().min(1).max(20_000);

export const AbilitySchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);
export type Ability = z.infer<typeof AbilitySchema>;

export const DamageTypeSchema = z.enum([
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
]);
export type DamageType = z.infer<typeof DamageTypeSchema>;

export const ConditionSchema = z.enum([
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
]);
export type Condition = z.infer<typeof ConditionSchema>;

const DICE_PATTERN = /^(?:(\d+)d(\d+)|(\d+))(?:\s*([+-])\s*(\d+))?$/;

/** A dice expression such as `2d6`, `18d8 + 54`, `1d4-1` or a flat `1`. */
export const DiceExpressionSchema = z
  .string()
  .trim()
  .regex(DICE_PATTERN, 'must be a dice expression such as 2d6+3');

/**
 * Average of a dice expression, rounded down as the 5e rules do for monster
 * hit points and damage. Returns `undefined` for an unparseable expression.
 */
export function averageForDice(expression: string): number | undefined {
  const match = DICE_PATTERN.exec(expression.trim());
  if (!match) return undefined;
  const [, count, sides, flat, sign, modifier] = match;
  const base =
    count !== undefined && sides !== undefined
      ? (Number(count) * (Number(sides) + 1)) / 2
      : Number(flat);
  const offset = modifier === undefined ? 0 : Number(modifier) * (sign === '-' ? -1 : 1);
  return Math.floor(base + offset);
}

export const DamageRollSchema = z
  .object({
    dice: DiceExpressionSchema,
    type: DamageTypeSchema,
  })
  .strict();
export type DamageRoll = z.infer<typeof DamageRollSchema>;

export const CurrencySchema = z.enum(['cp', 'sp', 'ep', 'gp', 'pp']);

export const CostSchema = z
  .object({
    amount: z.number().nonnegative(),
    unit: CurrencySchema,
  })
  .strict();

/** A reference to another rules entity of the same ruleset, by slug. */
export const EntityRefSchema = SlugSchema;

/** Source licence of the content, e.g. `CC-BY-4.0`, `OGL-1.0a`, `homebrew`. */
export const SourceLicenseSchema = z.string().trim().min(1).max(100);

export const KNOWN_SOURCE_LICENSES = [
  'CC-BY-4.0',
  'OGL-1.0a',
  'homebrew',
  'proprietary',
] as const;
