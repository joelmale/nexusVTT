/**
 * Zod schemas for predicates
 */

import { z } from 'zod';
import { abilitySchema, editionSchema, proficiencyTypeSchema } from './common.schema';

/**
 * Base predicate schemas
 */
const levelAtLeastSchema = z.object({
  type: z.literal('levelAtLeast'),
  value: z.number().int().min(1).max(20),
});

const levelAtMostSchema = z.object({
  type: z.literal('levelAtMost'),
  value: z.number().int().min(1).max(20),
});

const hasTagSchema = z.object({
  type: z.literal('hasTag'),
  tag: z.string().min(1),
});

const editionPredicateSchema = z.object({
  type: z.literal('edition'),
  value: editionSchema,
});

const classIsSchema = z.object({
  type: z.literal('classIs'),
  slug: z.string().min(1),
});

const classLevelAtLeastSchema = z.object({
  type: z.literal('classLevelAtLeast'),
  classSlug: z.string().min(1),
  level: z.number().int().min(1).max(20),
});

const speciesIsSchema = z.object({
  type: z.literal('speciesIs'),
  slug: z.string().min(1),
});

const abilityAtLeastSchema = z.object({
  type: z.literal('abilityAtLeast'),
  ability: abilitySchema,
  value: z.number().int().min(1).max(30),
});

const hasFeatSchema = z.object({
  type: z.literal('hasFeat'),
  featSlug: z.string().min(1),
});

const hasFeatureSchema = z.object({
  type: z.literal('hasFeature'),
  featureSlug: z.string().min(1),
});

const hasProficiencySchema = z.object({
  type: z.literal('hasProficiency'),
  profType: proficiencyTypeSchema,
  value: z.string().min(1),
});

const equippedSchema = z.object({
  type: z.literal('equipped'),
  itemTag: z.string().min(1),
});

const hasConditionSchema = z.object({
  type: z.literal('hasCondition'),
  condition: z.string().min(1),
});

/**
 * Simple predicate schema (union of all base predicates)
 */
const simplePredicateSchema = z.union([
  levelAtLeastSchema,
  levelAtMostSchema,
  hasTagSchema,
  editionPredicateSchema,
  classIsSchema,
  classLevelAtLeastSchema,
  speciesIsSchema,
  abilityAtLeastSchema,
  hasFeatSchema,
  hasFeatureSchema,
  hasProficiencySchema,
  equippedSchema,
  hasConditionSchema,
]);

/**
 * Predicate schema (includes composite predicates)
 * Uses lazy() for recursive types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const predicateSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    simplePredicateSchema,
    z.object({
      type: z.literal('and'),
      predicates: z.array(predicateSchema),
    }),
    z.object({
      type: z.literal('or'),
      predicates: z.array(predicateSchema),
    }),
    z.object({
      type: z.literal('not'),
      predicate: predicateSchema,
    }),
  ])
);

/**
 * Array of predicates schema
 */
export const predicateArraySchema = z.array(predicateSchema).optional();
