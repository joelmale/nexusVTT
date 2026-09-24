import { z } from 'zod';
import { NameSchema, RulesTextSchema, SlugSchema } from './common';

export const SpellSchoolSchema = z.enum([
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
]);
export type SpellSchool = z.infer<typeof SpellSchoolSchema>;

export const SpellCastingTimeSchema = z
  .object({
    unit: z.enum(['action', 'bonus_action', 'reaction', 'minute', 'hour', 'special']),
    amount: z.number().int().positive().default(1),
    /**
     * Trigger ("which you take when ...") for reaction spells and for 2024
     * bonus-action spells such as the smites.
     */
    trigger: z.string().trim().min(1).optional(),
    /** Free text for `special` casting times. */
    text: z.string().trim().min(1).optional(),
  })
  .strict();

export const DistanceSchema = z
  .object({
    value: z.number().positive(),
    unit: z.enum(['feet', 'miles']),
  })
  .strict();

export const AreaOfEffectSchema = z
  .object({
    shape: z.enum(['cone', 'cube', 'cylinder', 'emanation', 'line', 'sphere']),
    size: z.number().positive(),
  })
  .strict();

export const SpellRangeSchema = z
  .object({
    kind: z.enum(['self', 'touch', 'distance', 'sight', 'unlimited', 'special']),
    distance: DistanceSchema.optional(),
    area: AreaOfEffectSchema.optional(),
  })
  .strict();

export const SpellComponentsSchema = z
  .object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.boolean(),
    /** Required when `material` is true. */
    materialText: z.string().trim().min(1).optional(),
    /** Minimum value of a costly material component, in gold pieces. */
    materialCostGp: z.number().nonnegative().optional(),
    /** Whether the spell consumes the material component. */
    materialConsumed: z.boolean().optional(),
  })
  .strict();

export const SpellDurationSchema = z
  .object({
    kind: z.enum([
      'instantaneous',
      'timed',
      'until_dispelled',
      'until_dispelled_or_triggered',
      'special',
    ]),
    amount: z.number().int().positive().optional(),
    unit: z.enum(['round', 'minute', 'hour', 'day']).optional(),
  })
  .strict();

const spellFields = {
  name: NameSchema,
  level: z.number().int().min(0).max(9),
  school: SpellSchoolSchema,
  castingTime: SpellCastingTimeSchema,
  range: SpellRangeSchema,
  components: SpellComponentsSchema,
  duration: SpellDurationSchema,
  concentration: z.boolean(),
  ritual: z.boolean(),
  /** Class slugs whose spell list includes this spell. */
  classes: z.array(SlugSchema),
  description: RulesTextSchema,
  /** "At Higher Levels" / "Using a Higher-Level Spell Slot" / cantrip upgrade. */
  higherLevel: RulesTextSchema.optional(),
};

export const Spell2014Schema = z
  .object({ ruleset: z.literal('2014'), ...spellFields })
  .strict();
export const Spell2024Schema = z
  .object({ ruleset: z.literal('2024'), ...spellFields })
  .strict();

type SpellShape = z.infer<typeof Spell2014Schema> | z.infer<typeof Spell2024Schema>;

function refineSpell(spell: SpellShape, ctx: z.RefinementCtx): void {
  const { components, castingTime, range, duration } = spell;

  if (components.material && !components.materialText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['components', 'materialText'],
      message: 'material components require materialText',
    });
  }
  if (
    !components.material &&
    (components.materialText !== undefined ||
      components.materialCostGp !== undefined ||
      components.materialConsumed !== undefined)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['components'],
      message: 'material details are only allowed when material is true',
    });
  }
  if (!components.verbal && !components.somatic && !components.material) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['components'],
      message: 'a spell needs at least one component',
    });
  }
  if (castingTime.trigger && castingTime.unit !== 'reaction' && castingTime.unit !== 'bonus_action') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['castingTime', 'trigger'],
      message: 'only reaction and bonus-action spells have a trigger',
    });
  }
  if (castingTime.unit === 'special' && !castingTime.text) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['castingTime', 'text'],
      message: 'special casting times require text',
    });
  }
  if ((range.kind === 'distance') !== (range.distance !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['range', 'distance'],
      message: 'distance is required for, and only allowed with, kind "distance"',
    });
  }
  const timed = duration.kind === 'timed';
  if (timed !== (duration.amount !== undefined && duration.unit !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['duration'],
      message: 'amount and unit are required for, and only allowed with, kind "timed"',
    });
  }
  if (spell.concentration && duration.kind !== 'timed' && duration.kind !== 'special') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['concentration'],
      message: 'concentration spells must have a timed or special duration',
    });
  }
  if (spell.ritual && spell.level === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ritual'],
      message: 'cantrips cannot be rituals',
    });
  }
  if (new Set(spell.classes).size !== spell.classes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['classes'],
      message: 'classes must be unique',
    });
  }
}

export const SpellSchema = z
  .discriminatedUnion('ruleset', [Spell2014Schema, Spell2024Schema])
  .superRefine(refineSpell);

export type Spell = z.infer<typeof SpellSchema>;
export type Spell2014 = z.infer<typeof Spell2014Schema>;
export type Spell2024 = z.infer<typeof Spell2024Schema>;
