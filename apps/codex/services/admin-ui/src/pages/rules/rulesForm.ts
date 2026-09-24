/**
 * Form model for rules entities. Field options come straight from the Zod
 * enums in `@nexus/rules-contracts`, and validation runs the same
 * `parseRulesEntityData` Codex runs on validate, so the form can never drift
 * from the contract. Complex nested fields (attack lists, weapon/armor blocks)
 * are edited as JSON.
 */
import {
  AbilitySchema,
  ConditionSchema,
  CreatureSizeSchema,
  CreatureTypeSchema,
  CurrencySchema,
  ItemCategorySchema,
  ItemRaritySchema,
  SpellCastingTimeSchema,
  SpellDurationSchema,
  SpellRangeSchema,
  SpellSchoolSchema,
  parseRulesEntityData,
  type Ability,
  type JsonPatchOperation,
  type RulesEntityType,
  type RulesValidationIssue,
  type Ruleset,
} from '@nexus/rules-contracts'

export type Path = Array<string | number>
export type RulesData = Record<string, unknown>

export type FieldKind =
  /** Single-line text; empty removes the key when optional. */
  | 'text'
  | 'textarea'
  /** Number; empty removes the key. */
  | 'number'
  /** Required true/false. */
  | 'boolean'
  /** Optional flag: unchecked removes the key. */
  | 'flag'
  | 'select'
  /** Comma-separated list of strings. */
  | 'list'
  /** Free JSON for nested structures. */
  | 'json'

export interface FieldSpec {
  path: Path
  label: string
  kind: FieldKind
  options?: readonly string[]
  optional?: boolean
  hint?: string
  /** Only shown for these rulesets. */
  rulesets?: readonly Ruleset[]
}

export interface FieldGroup {
  title: string
  fields: FieldSpec[]
}

const ABILITIES = AbilitySchema.options

const SPELL_GROUPS: FieldGroup[] = [
  {
    title: 'Basics',
    fields: [
      { path: ['name'], label: 'Name', kind: 'text' },
      { path: ['level'], label: 'Level (0 = cantrip)', kind: 'number' },
      { path: ['school'], label: 'School', kind: 'select', options: SpellSchoolSchema.options },
      { path: ['classes'], label: 'Classes', kind: 'list', hint: 'Class slugs, comma separated' },
      { path: ['concentration'], label: 'Concentration', kind: 'boolean' },
      { path: ['ritual'], label: 'Ritual', kind: 'boolean' },
    ],
  },
  {
    title: 'Casting',
    fields: [
      { path: ['castingTime', 'unit'], label: 'Casting time', kind: 'select', options: SpellCastingTimeSchema.shape.unit.options },
      { path: ['castingTime', 'amount'], label: 'Amount', kind: 'number' },
      { path: ['castingTime', 'trigger'], label: 'Trigger (reaction/bonus action)', kind: 'text', optional: true },
      { path: ['castingTime', 'text'], label: 'Special casting time text', kind: 'text', optional: true },
      { path: ['range', 'kind'], label: 'Range', kind: 'select', options: SpellRangeSchema.shape.kind.options },
      { path: ['range', 'distance', 'value'], label: 'Distance', kind: 'number', optional: true },
      { path: ['range', 'distance', 'unit'], label: 'Distance unit', kind: 'select', options: ['feet', 'miles'], optional: true },
      { path: ['range', 'area'], label: 'Area of effect', kind: 'json', optional: true, hint: '{ "shape": "sphere", "size": 20 }' },
      { path: ['duration', 'kind'], label: 'Duration', kind: 'select', options: SpellDurationSchema.shape.kind.options },
      { path: ['duration', 'amount'], label: 'Duration amount', kind: 'number', optional: true },
      {
        path: ['duration', 'unit'],
        label: 'Duration unit',
        kind: 'select',
        options: ['round', 'minute', 'hour', 'day'],
        optional: true,
      },
    ],
  },
  {
    title: 'Components',
    fields: [
      { path: ['components', 'verbal'], label: 'Verbal (V)', kind: 'boolean' },
      { path: ['components', 'somatic'], label: 'Somatic (S)', kind: 'boolean' },
      { path: ['components', 'material'], label: 'Material (M)', kind: 'boolean' },
      { path: ['components', 'materialText'], label: 'Material description', kind: 'text', optional: true },
      { path: ['components', 'materialCostGp'], label: 'Material cost (gp)', kind: 'number', optional: true },
      { path: ['components', 'materialConsumed'], label: 'Material is consumed', kind: 'flag', optional: true },
    ],
  },
  {
    title: 'Text',
    fields: [
      { path: ['description'], label: 'Description', kind: 'textarea' },
      { path: ['higherLevel'], label: 'At higher levels', kind: 'textarea', optional: true },
    ],
  },
]

const ITEM_GROUPS: FieldGroup[] = [
  {
    title: 'Basics',
    fields: [
      { path: ['name'], label: 'Name', kind: 'text' },
      { path: ['category'], label: 'Category', kind: 'select', options: ItemCategorySchema.options },
      { path: ['rarity'], label: 'Rarity', kind: 'select', options: ItemRaritySchema.options },
      { path: ['attunement', 'required'], label: 'Requires attunement', kind: 'boolean' },
      { path: ['attunement', 'requirement'], label: 'Attunement requirement', kind: 'text', optional: true, hint: 'e.g. by a wizard' },
      { path: ['cost', 'amount'], label: 'Cost', kind: 'number', optional: true },
      { path: ['cost', 'unit'], label: 'Cost unit', kind: 'select', options: CurrencySchema.options, optional: true },
      { path: ['weight'], label: 'Weight (lb)', kind: 'number', optional: true },
    ],
  },
  {
    title: 'Statistics',
    fields: [
      {
        path: ['weapon'],
        label: 'Weapon',
        kind: 'json',
        optional: true,
        hint: '{ "category": "martial", "kind": "melee", "damage": { "dice": "1d8", "type": "slashing" }, "properties": [] }',
      },
      {
        path: ['armor'],
        label: 'Armor or shield',
        kind: 'json',
        optional: true,
        hint: '{ "category": "medium", "baseAc": 14, "dexBonus": true, "maxDexBonus": 2, "stealthDisadvantage": false }',
      },
      { path: ['charges'], label: 'Charges', kind: 'json', optional: true, hint: '{ "max": 7, "recharge": "dawn", "rechargeDice": "1d6+1" }' },
      { path: ['activation'], label: 'Activation', kind: 'json', optional: true, hint: '{ "type": "action" }' },
      { path: ['spells'], label: 'Spells', kind: 'json', optional: true, hint: '[{ "ref": "fireball", "chargeCost": 3 }]' },
    ],
  },
  {
    title: 'Text',
    fields: [{ path: ['text'], label: 'Rules text', kind: 'textarea', optional: true }],
  },
]

const MONSTER_GROUPS: FieldGroup[] = [
  {
    title: 'Basics',
    fields: [
      { path: ['name'], label: 'Name', kind: 'text' },
      { path: ['size'], label: 'Size', kind: 'select', options: CreatureSizeSchema.options },
      { path: ['type'], label: 'Type', kind: 'select', options: CreatureTypeSchema.options },
      { path: ['subtype'], label: 'Subtype', kind: 'text', optional: true },
      { path: ['swarmOf'], label: 'Swarm of (member size)', kind: 'select', options: CreatureSizeSchema.options, optional: true },
      { path: ['alignment'], label: 'Alignment', kind: 'text' },
      { path: ['challengeRating'], label: 'Challenge rating', kind: 'number', hint: '0.125, 0.25, 0.5 or 0-30' },
      { path: ['xp'], label: 'XP', kind: 'number' },
      { path: ['proficiencyBonus'], label: 'Proficiency bonus', kind: 'number', optional: true },
    ],
  },
  {
    title: 'Defenses and movement',
    fields: [
      { path: ['armorClass'], label: 'Armor class', kind: 'json', hint: '[{ "value": 15, "source": "natural armor" }]' },
      { path: ['hitPoints', 'average'], label: 'Hit points (average)', kind: 'number' },
      { path: ['hitPoints', 'formula'], label: 'Hit dice formula', kind: 'text', hint: 'e.g. 4d8+4' },
      { path: ['speed', 'walk'], label: 'Walk (ft)', kind: 'number' },
      { path: ['speed', 'fly'], label: 'Fly (ft)', kind: 'number', optional: true },
      { path: ['speed', 'swim'], label: 'Swim (ft)', kind: 'number', optional: true },
      { path: ['speed', 'climb'], label: 'Climb (ft)', kind: 'number', optional: true },
      { path: ['speed', 'burrow'], label: 'Burrow (ft)', kind: 'number', optional: true },
      { path: ['speed', 'hover'], label: 'Hover', kind: 'flag', optional: true },
      { path: ['damageVulnerabilities'], label: 'Damage vulnerabilities', kind: 'json', optional: true, hint: '[{ "type": "fire" }]' },
      { path: ['damageResistances'], label: 'Damage resistances', kind: 'json', optional: true },
      { path: ['damageImmunities'], label: 'Damage immunities', kind: 'json', optional: true },
      {
        path: ['conditionImmunities'],
        label: 'Condition immunities',
        kind: 'list',
        optional: true,
        hint: ConditionSchema.options.join(', '),
      },
      { path: ['initiative'], label: 'Initiative', kind: 'json', optional: true, rulesets: ['2024'], hint: '{ "modifier": 2, "score": 12 }' },
    ],
  },
  {
    title: 'Abilities',
    fields: [
      ...ABILITIES.map((ability: Ability): FieldSpec => ({ path: ['abilityScores', ability], label: ability.toUpperCase(), kind: 'number' })),
      { path: ['savingThrows'], label: 'Saving throws', kind: 'json', optional: true, hint: '{ "dex": 5, "wis": 3 }' },
      { path: ['skills'], label: 'Skills', kind: 'json', optional: true, hint: '{ "perception": 4, "stealth": 6 }' },
    ],
  },
  {
    title: 'Senses and languages',
    fields: [
      { path: ['senses', 'darkvision'], label: 'Darkvision (ft)', kind: 'number', optional: true },
      { path: ['senses', 'blindsight'], label: 'Blindsight (ft)', kind: 'number', optional: true },
      { path: ['senses', 'tremorsense'], label: 'Tremorsense (ft)', kind: 'number', optional: true },
      { path: ['senses', 'truesight'], label: 'Truesight (ft)', kind: 'number', optional: true },
      { path: ['senses', 'passivePerception'], label: 'Passive Perception', kind: 'number' },
      { path: ['languages'], label: 'Languages', kind: 'list', optional: true },
      { path: ['habitats'], label: 'Habitats', kind: 'list', optional: true, rulesets: ['2024'] },
      { path: ['treasure'], label: 'Treasure', kind: 'list', optional: true, rulesets: ['2024'] },
      { path: ['gear'], label: 'Gear (item slugs)', kind: 'list', optional: true, rulesets: ['2024'] },
    ],
  },
  {
    title: 'Features and actions',
    fields: [
      { path: ['traits'], label: 'Traits', kind: 'json', optional: true, hint: '[{ "name": "Keen Smell", "description": "..." }]' },
      {
        path: ['actions'],
        label: 'Actions',
        kind: 'json',
        optional: true,
        hint: '[{ "name": "Bite", "description": "...", "attackBonus": 4, "damage": [{ "dice": "1d6+2", "type": "piercing" }] }]',
      },
      { path: ['bonusActions'], label: 'Bonus actions', kind: 'json', optional: true },
      { path: ['reactions'], label: 'Reactions', kind: 'json', optional: true },
      {
        path: ['legendaryActions'],
        label: 'Legendary actions',
        kind: 'json',
        optional: true,
        hint: '{ "usesPerRound": 3, "actions": [{ "name": "Detect", "description": "..." }] }',
      },
      {
        path: ['spellcasting'],
        label: 'Spellcasting',
        kind: 'json',
        optional: true,
        hint: '[{ "name": "Spellcasting", "ability": "int", "description": "...", "spells": [{ "ref": "fireball", "frequency": "1/day" }] }]',
      },
    ],
  },
]

export const RULES_FIELD_GROUPS: Record<RulesEntityType, FieldGroup[]> = {
  spell: SPELL_GROUPS,
  item: ITEM_GROUPS,
  monster: MONSTER_GROUPS,
}

export function fieldGroupsFor(type: RulesEntityType, ruleset: Ruleset): FieldGroup[] {
  return RULES_FIELD_GROUPS[type].map((group) => ({
    ...group,
    fields: group.fields.filter((field) => !field.rulesets || field.rulesets.includes(ruleset)),
  }))
}

export function pathKey(path: Path): string {
  return path.map(String).join('.')
}

export function getPath(data: unknown, path: Path): unknown {
  let current: unknown = data
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string | number, unknown>)[segment]
  }
  return current
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Immutable set. `undefined` removes the key, and an object left empty by
 * the removal is removed too, so clearing "distance" drops `range.distance`.
 */
export function setPath(data: RulesData, path: Path, value: unknown): RulesData {
  if (path.length === 0) return isPlainObject(value) ? value : data
  const [head, ...rest] = path
  const key = String(head)
  const next: RulesData = { ...data }
  if (rest.length === 0) {
    if (value === undefined) delete next[key]
    else next[key] = value
    return next
  }
  const child = isPlainObject(next[key]) ? (next[key] as RulesData) : {}
  const updated = setPath(child, rest, value)
  if (Object.keys(updated).length === 0 && value === undefined) delete next[key]
  else next[key] = updated
  return next
}

/** Issues at `path` or nested under it. */
export function issuesAt<T extends RulesValidationIssue>(issues: readonly T[], path: Path): T[] {
  const key = pathKey(path)
  return issues.filter((issue) => {
    const issueKey = pathKey(issue.path)
    return issueKey === key || issueKey.startsWith(`${key}.`)
  })
}

/** Client-side contract check with the shared Zod schemas. */
export function validateLocally(type: RulesEntityType, ruleset: Ruleset, data: unknown): RulesValidationIssue[] {
  const result = parseRulesEntityData(type, ruleset, data)
  return result.success ? [] : result.issues
}

/** Starting data for a new entity: shaped for the form, completed by the author. */
export function defaultRulesData(type: RulesEntityType, ruleset: Ruleset, name: string): RulesData {
  switch (type) {
    case 'spell':
      return {
        ruleset,
        name,
        level: 0,
        school: 'evocation',
        castingTime: { unit: 'action', amount: 1 },
        range: { kind: 'self' },
        components: { verbal: true, somatic: false, material: false },
        duration: { kind: 'instantaneous' },
        concentration: false,
        ritual: false,
        classes: [],
        description: '',
      }
    case 'item':
      return {
        ruleset,
        name,
        category: 'adventuring_gear',
        rarity: 'mundane',
        attunement: { required: false },
        text: '',
      }
    case 'monster':
      return {
        ruleset,
        name,
        size: 'medium',
        type: 'humanoid',
        alignment: 'unaligned',
        armorClass: [{ value: 10 }],
        hitPoints: { average: 4, formula: '1d8' },
        speed: { walk: 30 },
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        senses: { passivePerception: 10 },
        languages: [],
        challengeRating: 0,
        xp: 10,
        traits: [],
        actions: [],
      }
    default: {
      const _exhaustive: never = type
      throw new Error(`Unsupported rules entity type: ${_exhaustive as string}`)
    }
  }
}

/** Stable slug suggestion from a display name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function pointerSegments(pointer: string): string[] {
  if (pointer === '') return []
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
}

/**
 * Apply RFC 6902 add/replace/remove operations (as produced by `diffJson`)
 * to a copy of `target`. Used to rebase a user's own edits onto a newer
 * server revision, so fields they did not touch keep the server's values.
 * Operations whose parent no longer exists create it.
 */
export function applyJsonPatch(target: RulesData, operations: readonly JsonPatchOperation[]): RulesData {
  const root: RulesData = structuredClone(target)
  for (const operation of operations) {
    const segments = pointerSegments(operation.path)
    if (segments.length === 0) continue
    let parent: unknown = root
    for (const segment of segments.slice(0, -1)) {
      const container = parent as Record<string, unknown>
      if (container[segment] === null || typeof container[segment] !== 'object') container[segment] = {}
      parent = container[segment]
    }
    const last = segments[segments.length - 1]
    if (Array.isArray(parent)) {
      const index = last === '-' ? parent.length : Number(last)
      if (operation.op === 'remove') parent.splice(index, 1)
      else if (operation.op === 'add') parent.splice(index, 0, structuredClone(operation.value))
      else parent[index] = structuredClone(operation.value)
    } else {
      const container = parent as Record<string, unknown>
      if (operation.op === 'remove') delete container[last]
      else container[last] = structuredClone(operation.value)
    }
  }
  return root
}
