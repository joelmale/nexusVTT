import { z } from 'zod/v4'; // zod 3.25 ships the v4 API (with toJSONSchema) under zod/v4

// One schema per entity type. The same schemas define the gold-set entity
// labels (apps/codex/eval/goldset), so extraction and scoring agree.

const NamedText = z.object({ name: z.string(), description: z.string() });

export const MonsterSchema = z.object({
  name: z.string().min(1),
  size: z.string(),
  type: z.string(),
  alignment: z.string(),
  armorClass: z.number().int(),
  armorType: z.string().optional(),
  hitPoints: z.number().int(),
  hitDice: z.string().optional(),
  speed: z.string(),
  abilities: z.object({
    str: z.number().int(),
    dex: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    wis: z.number().int(),
    cha: z.number().int(),
  }),
  savingThrows: z.string().optional(),
  skills: z.string().optional(),
  damageResistances: z.string().optional(),
  damageImmunities: z.string().optional(),
  conditionImmunities: z.string().optional(),
  senses: z.string().optional(),
  languages: z.string().optional(),
  challengeRating: z.string(),
  traits: z.array(NamedText),
  actions: z.array(NamedText),
  legendaryActions: z.array(NamedText).optional(),
});

export const SpellSchema = z.object({
  name: z.string().min(1),
  level: z.number().int(), // 0 = cantrip
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  components: z.string(), // e.g. "V, S, M (a pinch of sulfur)"
  duration: z.string(),
  concentration: z.boolean().optional(),
  ritual: z.boolean().optional(),
  classes: z.array(z.string()).optional(),
  description: z.string(),
  higherLevels: z.string().optional(),
});

export const ItemSchema = z.object({
  name: z.string().min(1),
  type: z.string(), // e.g. "Wondrous item", "Weapon (longsword)"
  rarity: z.string(),
  requiresAttunement: z.boolean(),
  attunementDetail: z.string().optional(), // e.g. "by a wizard"
  description: z.string(),
});

export type Monster = z.infer<typeof MonsterSchema>;
export type Spell = z.infer<typeof SpellSchema>;
export type Item = z.infer<typeof ItemSchema>;

export type EntityType = 'monster' | 'spell' | 'item';
export type ExtractedEntity = Monster | Spell | Item;

// Every call returns an array, so one region holding two stat blocks yields two entities.
export const ENTITY_LISTS = {
  monster: z.object({ entities: z.array(MonsterSchema) }),
  spell: z.object({ entities: z.array(SpellSchema) }),
  item: z.object({ entities: z.array(ItemSchema) }),
} as const;

export const ENTITY_SCHEMAS = {
  monster: MonsterSchema,
  spell: SpellSchema,
  item: ItemSchema,
} as const;
