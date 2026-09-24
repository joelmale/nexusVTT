import { z } from 'zod';
import {
  AbilitySchema,
  ConditionSchema,
  DamageRollSchema,
  DamageTypeSchema,
  DiceExpressionSchema,
  EntityRefSchema,
  NameSchema,
  RulesTextSchema,
  averageForDice,
} from './common';

export const CreatureSizeSchema = z.enum([
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan',
]);

export const CreatureTypeSchema = z.enum([
  'aberration',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fey',
  'fiend',
  'giant',
  'humanoid',
  'monstrosity',
  'ooze',
  'plant',
  'undead',
]);

export const SkillSchema = z.enum([
  'acrobatics',
  'animal_handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight_of_hand',
  'stealth',
  'survival',
]);

/**
 * Challenge rating to experience points (identical in the 2014 and 2024
 * rules). CR 0 is worth 0 or 10 XP depending on whether the creature has
 * effective attacks, so both are accepted.
 */
export const CHALLENGE_RATING_XP: Readonly<Record<string, readonly number[]>> = {
  '0': [0, 10],
  '0.125': [25],
  '0.25': [50],
  '0.5': [100],
  '1': [200],
  '2': [450],
  '3': [700],
  '4': [1100],
  '5': [1800],
  '6': [2300],
  '7': [2900],
  '8': [3900],
  '9': [5000],
  '10': [5900],
  '11': [7200],
  '12': [8400],
  '13': [10000],
  '14': [11500],
  '15': [13000],
  '16': [15000],
  '17': [18000],
  '18': [20000],
  '19': [22000],
  '20': [25000],
  '21': [33000],
  '22': [41000],
  '23': [50000],
  '24': [62000],
  '25': [75000],
  '26': [90000],
  '27': [105000],
  '28': [120000],
  '29': [135000],
  '30': [155000],
};

export const ChallengeRatingSchema = z
  .number()
  .refine((value) => String(value) in CHALLENGE_RATING_XP, {
    message: 'must be a valid challenge rating (0, 1/8, 1/4, 1/2 or 1-30)',
  });

/** Proficiency bonus by challenge rating. */
export function proficiencyBonusForChallengeRating(cr: number): number {
  if (cr < 5) return 2;
  return Math.floor((cr - 1) / 4) + 2;
}

const FeetSchema = z.number().int().min(0);

export const DamageDefenseSchema = z
  .object({
    type: DamageTypeSchema,
    /** Qualifier such as "from nonmagical attacks". */
    qualifier: z.string().trim().min(1).optional(),
  })
  .strict();

export const MonsterUsageSchema = z
  .object({
    type: z.enum(['per_day', 'recharge', 'recharge_after_rest']),
    times: z.number().int().positive().optional(),
    /** Lowest d6 roll that recharges the ability (5 for "Recharge 5-6"). */
    rechargeOn: z.number().int().min(2).max(6).optional(),
    rest: z.enum(['short', 'long']).optional(),
  })
  .strict();

export const MonsterFeatureSchema = z
  .object({
    name: NameSchema,
    description: RulesTextSchema,
    attackBonus: z.number().int().optional(),
    saveDc: z.number().int().min(1).max(40).optional(),
    saveAbility: AbilitySchema.optional(),
    damage: z.array(DamageRollSchema).optional(),
    usage: MonsterUsageSchema.optional(),
  })
  .strict();
export type MonsterFeature = z.infer<typeof MonsterFeatureSchema>;

export const LegendaryActionSchema = z
  .object({
    name: NameSchema,
    description: RulesTextSchema,
    cost: z.number().int().min(1).max(3).default(1),
  })
  .strict();

export const MonsterSpellcastingSchema = z
  .object({
    name: NameSchema,
    ability: AbilitySchema,
    saveDc: z.number().int().min(1).max(40).optional(),
    attackBonus: z.number().int().optional(),
    description: RulesTextSchema,
    /** Spells by slug in the same ruleset; cross-referenced on validation. */
    spells: z
      .array(
        z
          .object({
            ref: EntityRefSchema,
            /** e.g. "at will", "3/day", "1st level (4 slots)". */
            frequency: z.string().trim().min(1).optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const monsterFields = {
  name: NameSchema,
  size: CreatureSizeSchema,
  type: CreatureTypeSchema,
  subtype: z.string().trim().min(1).optional(),
  /** Individual size of swarm members, when the creature is a swarm. */
  swarmOf: CreatureSizeSchema.optional(),
  alignment: z.string().trim().min(1),
  armorClass: z
    .array(
      z
        .object({
          value: z.number().int().min(0).max(40),
          /** e.g. "natural armor", "plate armor", "mage armor". */
          source: z.string().trim().min(1).optional(),
          /** e.g. "while prone". */
          condition: z.string().trim().min(1).optional(),
        })
        .strict(),
    )
    .min(1),
  hitPoints: z
    .object({
      average: z.number().int().min(1),
      formula: DiceExpressionSchema,
    })
    .strict(),
  speed: z
    .object({
      walk: FeetSchema,
      burrow: FeetSchema.optional(),
      climb: FeetSchema.optional(),
      fly: FeetSchema.optional(),
      swim: FeetSchema.optional(),
      hover: z.boolean().optional(),
    })
    .strict(),
  abilityScores: z
    .object({
      str: z.number().int().min(1).max(30),
      dex: z.number().int().min(1).max(30),
      con: z.number().int().min(1).max(30),
      int: z.number().int().min(1).max(30),
      wis: z.number().int().min(1).max(30),
      cha: z.number().int().min(1).max(30),
    })
    .strict(),
  savingThrows: z.record(AbilitySchema, z.number().int()).default({}),
  skills: z.record(SkillSchema, z.number().int()).default({}),
  damageVulnerabilities: z.array(DamageDefenseSchema).default([]),
  damageResistances: z.array(DamageDefenseSchema).default([]),
  damageImmunities: z.array(DamageDefenseSchema).default([]),
  conditionImmunities: z.array(ConditionSchema).default([]),
  senses: z
    .object({
      blindsight: FeetSchema.optional(),
      darkvision: FeetSchema.optional(),
      tremorsense: FeetSchema.optional(),
      truesight: FeetSchema.optional(),
      passivePerception: z.number().int().min(0),
    })
    .strict(),
  languages: z.array(z.string().trim().min(1)).default([]),
  challengeRating: ChallengeRatingSchema,
  xp: z.number().int().min(0),
  proficiencyBonus: z.number().int().min(2).max(9).optional(),
  traits: z.array(MonsterFeatureSchema).default([]),
  actions: z.array(MonsterFeatureSchema).default([]),
  bonusActions: z.array(MonsterFeatureSchema).default([]),
  reactions: z.array(MonsterFeatureSchema).default([]),
  legendaryActions: z
    .object({
      usesPerRound: z.number().int().min(1).default(3),
      description: z.string().trim().min(1).optional(),
      actions: z.array(LegendaryActionSchema).min(1),
    })
    .strict()
    .optional(),
  spellcasting: z.array(MonsterSpellcastingSchema).optional(),
};

export const Monster2014Schema = z
  .object({ ruleset: z.literal('2014'), ...monsterFields })
  .strict();

export const Monster2024Schema = z
  .object({
    ruleset: z.literal('2024'),
    ...monsterFields,
    /** 2024 stat blocks print an initiative modifier and score. */
    initiative: z
      .object({ modifier: z.number().int(), score: z.number().int() })
      .strict()
      .optional(),
    habitats: z.array(z.string().trim().min(1)).optional(),
    treasure: z.array(z.string().trim().min(1)).optional(),
    gear: z.array(EntityRefSchema).optional(),
  })
  .strict();

type MonsterShape = z.infer<typeof Monster2014Schema> | z.infer<typeof Monster2024Schema>;

function refineMonster(monster: MonsterShape, ctx: z.RefinementCtx): void {
  const allowedXp = CHALLENGE_RATING_XP[String(monster.challengeRating)];
  if (allowedXp && !allowedXp.includes(monster.xp)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['xp'],
      message: `CR ${monster.challengeRating} is worth ${allowedXp.join(' or ')} XP, not ${monster.xp}`,
    });
  }
  if (
    monster.proficiencyBonus !== undefined &&
    monster.proficiencyBonus !== proficiencyBonusForChallengeRating(monster.challengeRating)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['proficiencyBonus'],
      message: `CR ${monster.challengeRating} has proficiency bonus +${proficiencyBonusForChallengeRating(monster.challengeRating)}`,
    });
  }
  const expected = averageForDice(monster.hitPoints.formula);
  if (expected !== undefined && expected !== monster.hitPoints.average) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hitPoints', 'average'],
      message: `${monster.hitPoints.formula} averages ${expected}, not ${monster.hitPoints.average}`,
    });
  }
  if (monster.speed.hover && monster.speed.fly === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['speed', 'hover'],
      message: 'hover requires a fly speed',
    });
  }
  if (
    monster.swarmOf !== undefined &&
    CreatureSizeSchema.options.indexOf(monster.swarmOf) >
      CreatureSizeSchema.options.indexOf(monster.size)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['swarmOf'],
      message: 'swarm members cannot be larger than the swarm',
    });
  }
}

export const MonsterSchema = z
  .discriminatedUnion('ruleset', [Monster2014Schema, Monster2024Schema])
  .superRefine(refineMonster);

export type Monster = z.infer<typeof MonsterSchema>;
export type Monster2014 = z.infer<typeof Monster2014Schema>;
export type Monster2024 = z.infer<typeof Monster2024Schema>;
