/**
 * Contract fixtures for both rulesets. Valid fixtures must parse; each invalid
 * fixture must fail with an issue at `expectedPath`. Consumers (Codex tests,
 * admin forms, catalog adapters) may import these from
 * `@nexus/rules-contracts/dist/fixtures`.
 */
import type { RulesEntityType, Ruleset } from '../common.js';

export interface ValidRulesFixture {
  name: string;
  entityType: RulesEntityType;
  ruleset: Ruleset;
  slug: string;
  data: Record<string, unknown>;
}

export interface InvalidRulesFixture {
  name: string;
  entityType: RulesEntityType;
  ruleset: Ruleset;
  data: unknown;
  /** Dotted path of an issue the contract must report. */
  expectedPath: string;
}

export const fireball2014 = {
  ruleset: '2014',
  name: 'Fireball',
  level: 3,
  school: 'evocation',
  castingTime: { unit: 'action', amount: 1 },
  range: { kind: 'distance', distance: { value: 150, unit: 'feet' }, area: { shape: 'sphere', size: 20 } },
  components: { verbal: true, somatic: true, material: true, materialText: 'A tiny ball of bat guano and sulfur.' },
  duration: { kind: 'instantaneous' },
  concentration: false,
  ritual: false,
  classes: ['sorcerer', 'wizard'],
  description:
    'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.',
  higherLevel:
    'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
};

export const revivify2014 = {
  ruleset: '2014',
  name: 'Revivify',
  level: 3,
  school: 'conjuration',
  castingTime: { unit: 'action', amount: 1 },
  range: { kind: 'touch' },
  components: {
    verbal: true,
    somatic: true,
    material: true,
    materialText: 'Diamonds worth 300 gp, which the spell consumes.',
    materialCostGp: 300,
    materialConsumed: true,
  },
  duration: { kind: 'instantaneous' },
  concentration: false,
  ritual: false,
  classes: ['cleric', 'paladin'],
  description: 'You touch a creature that has died within the last minute. That creature returns to life with 1 hit point.',
};

export const shield2024 = {
  ruleset: '2024',
  name: 'Shield',
  level: 1,
  school: 'abjuration',
  castingTime: {
    unit: 'reaction',
    amount: 1,
    trigger: 'which you take when you are hit by an attack roll or targeted by the Magic Missile spell',
  },
  range: { kind: 'self' },
  components: { verbal: true, somatic: true, material: false },
  duration: { kind: 'timed', amount: 1, unit: 'round' },
  concentration: false,
  ritual: false,
  classes: ['sorcerer', 'wizard'],
  description: 'An imperceptible barrier of magical force protects you. Until the start of your next turn, you have a +5 bonus to AC.',
};

export const detectMagic2024 = {
  ruleset: '2024',
  name: 'Detect Magic',
  level: 1,
  school: 'divination',
  castingTime: { unit: 'action', amount: 1 },
  range: { kind: 'self' },
  components: { verbal: true, somatic: true, material: false },
  duration: { kind: 'timed', amount: 10, unit: 'minute' },
  concentration: true,
  ritual: true,
  classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'],
  description: 'For the duration, you sense the presence of magical effects within 30 feet of yourself.',
};

export const longsword2014 = {
  ruleset: '2014',
  name: 'Longsword',
  category: 'weapon',
  rarity: 'mundane',
  attunement: { required: false },
  cost: { amount: 15, unit: 'gp' },
  weight: 3,
  weapon: {
    category: 'martial',
    kind: 'melee',
    damage: { dice: '1d8', type: 'slashing' },
    versatileDamage: { dice: '1d10', type: 'slashing' },
    properties: ['versatile'],
  },
};

export const wandOfFireballs2014 = {
  ruleset: '2014',
  name: 'Wand of Fireballs',
  category: 'wand',
  rarity: 'rare',
  attunement: { required: true, requirement: 'by a spellcaster' },
  charges: { max: 7, recharge: 'dawn', rechargeDice: '1d6+1' },
  activation: { type: 'action' },
  spells: [{ ref: 'fireball', chargeCost: 1, castLevel: 3 }],
  text: 'This wand has 7 charges. While holding it, you can use an action to expend 1 or more of its charges to cast the fireball spell.',
};

export const longsword2024 = {
  ruleset: '2024',
  name: 'Longsword',
  category: 'weapon',
  rarity: 'mundane',
  attunement: { required: false },
  cost: { amount: 15, unit: 'gp' },
  weight: 3,
  weapon: {
    category: 'martial',
    kind: 'melee',
    damage: { dice: '1d8', type: 'slashing' },
    versatileDamage: { dice: '1d10', type: 'slashing' },
    properties: ['versatile'],
    mastery: 'sap',
  },
};

export const chainMail2024 = {
  ruleset: '2024',
  name: 'Chain Mail',
  category: 'armor',
  rarity: 'mundane',
  attunement: { required: false },
  cost: { amount: 75, unit: 'gp' },
  weight: 55,
  armor: {
    category: 'heavy',
    baseAc: 16,
    dexBonus: false,
    strengthRequirement: 13,
    stealthDisadvantage: true,
    donTime: '10 minutes',
    doffTime: '5 minutes',
  },
};

export const goblin2014 = {
  ruleset: '2014',
  name: 'Goblin',
  size: 'small',
  type: 'humanoid',
  subtype: 'goblinoid',
  alignment: 'neutral evil',
  armorClass: [{ value: 15, source: 'leather armor, shield' }],
  hitPoints: { average: 7, formula: '2d6' },
  speed: { walk: 30 },
  abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  skills: { stealth: 6 },
  senses: { darkvision: 60, passivePerception: 9 },
  languages: ['Common', 'Goblin'],
  challengeRating: 0.25,
  xp: 50,
  proficiencyBonus: 2,
  traits: [
    {
      name: 'Nimble Escape',
      description: 'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.',
    },
  ],
  actions: [
    {
      name: 'Scimitar',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.',
      attackBonus: 4,
      damage: [{ dice: '1d6+2', type: 'slashing' }],
    },
  ],
};

export const lich2014 = {
  ruleset: '2014',
  name: 'Lich',
  size: 'medium',
  type: 'undead',
  alignment: 'any evil alignment',
  armorClass: [{ value: 17, source: 'natural armor' }],
  hitPoints: { average: 135, formula: '18d8+54' },
  speed: { walk: 30 },
  abilityScores: { str: 11, dex: 16, con: 16, int: 20, wis: 14, cha: 16 },
  savingThrows: { con: 10, int: 12, wis: 9 },
  skills: { arcana: 18, history: 12, insight: 9, perception: 9 },
  damageResistances: [{ type: 'cold' }, { type: 'lightning' }, { type: 'necrotic' }],
  damageImmunities: [
    { type: 'poison' },
    { type: 'bludgeoning', qualifier: 'from nonmagical attacks' },
    { type: 'piercing', qualifier: 'from nonmagical attacks' },
    { type: 'slashing', qualifier: 'from nonmagical attacks' },
  ],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
  senses: { truesight: 120, passivePerception: 19 },
  languages: ['Common plus up to five other languages'],
  challengeRating: 21,
  xp: 33000,
  traits: [
    {
      name: 'Legendary Resistance',
      description: 'If the lich fails a saving throw, it can choose to succeed instead.',
      usage: { type: 'per_day', times: 3 },
    },
  ],
  actions: [
    {
      name: 'Paralyzing Touch',
      description: 'Melee Spell Attack: +12 to hit, reach 5 ft., one creature. Hit: 10 (3d6) cold damage.',
      attackBonus: 12,
      saveDc: 18,
      saveAbility: 'con',
      damage: [{ dice: '3d6', type: 'cold' }],
    },
  ],
  legendaryActions: {
    usesPerRound: 3,
    actions: [
      { name: 'Cantrip', description: 'The lich casts a cantrip.', cost: 1 },
      { name: 'Disrupt Life (Costs 3 Actions)', description: 'Each non-undead creature within 20 feet must make a DC 18 Constitution saving throw.', cost: 3 },
    ],
  },
  spellcasting: [
    {
      name: 'Spellcasting',
      ability: 'int',
      saveDc: 20,
      attackBonus: 12,
      description: 'The lich is an 18th-level spellcaster.',
      spells: [{ ref: 'fireball', frequency: '3rd level (3 slots)' }],
    },
  ],
};

export const goblinWarrior2024 = {
  ruleset: '2024',
  name: 'Goblin Warrior',
  size: 'small',
  type: 'fey',
  subtype: 'goblinoid',
  alignment: 'chaotic neutral',
  armorClass: [{ value: 15 }],
  hitPoints: { average: 10, formula: '3d6' },
  speed: { walk: 30 },
  initiative: { modifier: 2, score: 12 },
  abilityScores: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 },
  skills: { stealth: 6 },
  senses: { darkvision: 60, passivePerception: 9 },
  languages: ['Common', 'Goblin'],
  challengeRating: 0.25,
  xp: 50,
  proficiencyBonus: 2,
  habitats: ['Forest', 'Grassland', 'Hill', 'Underdark'],
  treasure: ['Any'],
  actions: [
    {
      name: 'Scimitar',
      description: 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.',
      attackBonus: 4,
      damage: [{ dice: '1d6+2', type: 'slashing' }],
    },
  ],
  bonusActions: [
    { name: 'Nimble Escape', description: 'The goblin takes the Disengage or Hide action.' },
  ],
};

export const swarmOfRats2024 = {
  ruleset: '2024',
  name: 'Swarm of Rats',
  size: 'medium',
  type: 'beast',
  swarmOf: 'tiny',
  alignment: 'unaligned',
  armorClass: [{ value: 10 }],
  hitPoints: { average: 14, formula: '4d8-4' },
  speed: { walk: 30 },
  abilityScores: { str: 9, dex: 11, con: 9, int: 2, wis: 10, cha: 3 },
  damageResistances: [{ type: 'bludgeoning' }, { type: 'piercing' }, { type: 'slashing' }],
  conditionImmunities: ['charmed', 'frightened', 'grappled', 'paralyzed', 'petrified', 'prone', 'restrained', 'stunned'],
  senses: { darkvision: 30, passivePerception: 10 },
  challengeRating: 0.25,
  xp: 50,
  actions: [
    {
      name: 'Bites',
      description: 'Melee Attack Roll: +2, reach 5 ft. Hit: 5 (2d4) Piercing damage.',
      attackBonus: 2,
      damage: [{ dice: '2d4', type: 'piercing' }],
    },
  ],
};

export const validRulesFixtures: ValidRulesFixture[] = [
  { name: 'fireball 2014', entityType: 'spell', ruleset: '2014', slug: 'fireball', data: fireball2014 },
  { name: 'revivify 2014 (consumed costly material)', entityType: 'spell', ruleset: '2014', slug: 'revivify', data: revivify2014 },
  { name: 'shield 2024 (reaction trigger)', entityType: 'spell', ruleset: '2024', slug: 'shield', data: shield2024 },
  { name: 'detect magic 2024 (ritual, concentration)', entityType: 'spell', ruleset: '2024', slug: 'detect-magic', data: detectMagic2024 },
  { name: 'longsword 2014', entityType: 'item', ruleset: '2014', slug: 'longsword', data: longsword2014 },
  { name: 'wand of fireballs 2014 (charges, spells)', entityType: 'item', ruleset: '2014', slug: 'wand-of-fireballs', data: wandOfFireballs2014 },
  { name: 'longsword 2024 (mastery)', entityType: 'item', ruleset: '2024', slug: 'longsword', data: longsword2024 },
  { name: 'chain mail 2024', entityType: 'item', ruleset: '2024', slug: 'chain-mail', data: chainMail2024 },
  { name: 'goblin 2014', entityType: 'monster', ruleset: '2014', slug: 'goblin', data: goblin2014 },
  { name: 'lich 2014 (legendary, spellcasting)', entityType: 'monster', ruleset: '2014', slug: 'lich', data: lich2014 },
  { name: 'goblin warrior 2024 (initiative, bonus actions)', entityType: 'monster', ruleset: '2024', slug: 'goblin-warrior', data: goblinWarrior2024 },
  { name: 'swarm of rats 2024', entityType: 'monster', ruleset: '2024', slug: 'swarm-of-rats', data: swarmOfRats2024 },
];

const withChanges = (base: Record<string, unknown>, changes: Record<string, unknown>) => ({
  ...base,
  ...changes,
});

export const invalidRulesFixtures: InvalidRulesFixture[] = [
  { name: 'spell level above 9', entityType: 'spell', ruleset: '2014', data: withChanges(fireball2014, { level: 10 }), expectedPath: 'level' },
  { name: 'spell unknown school', entityType: 'spell', ruleset: '2014', data: withChanges(fireball2014, { school: 'pyromancy' }), expectedPath: 'school' },
  {
    name: 'material component without text',
    entityType: 'spell',
    ruleset: '2014',
    data: withChanges(fireball2014, { components: { verbal: true, somatic: true, material: true } }),
    expectedPath: 'components.materialText',
  },
  {
    name: 'material cost without a material component',
    entityType: 'spell',
    ruleset: '2024',
    data: withChanges(shield2024, { components: { verbal: true, somatic: true, material: false, materialCostGp: 50 } }),
    expectedPath: 'components',
  },
  {
    name: 'trigger on an action spell',
    entityType: 'spell',
    ruleset: '2024',
    data: withChanges(detectMagic2024, { castingTime: { unit: 'action', amount: 1, trigger: 'when hit' } }),
    expectedPath: 'castingTime.trigger',
  },
  { name: 'ritual cantrip', entityType: 'spell', ruleset: '2024', data: withChanges(detectMagic2024, { level: 0 }), expectedPath: 'ritual' },
  {
    name: 'concentration with instantaneous duration',
    entityType: 'spell',
    ruleset: '2024',
    data: withChanges(detectMagic2024, { duration: { kind: 'instantaneous' } }),
    expectedPath: 'concentration',
  },
  { name: 'spell missing ruleset', entityType: 'spell', ruleset: '2014', data: withChanges(fireball2014, { ruleset: undefined }), expectedPath: 'ruleset' },
  { name: 'spell unknown field', entityType: 'spell', ruleset: '2014', data: withChanges(fireball2014, { damage: '8d6' }), expectedPath: '' },
  {
    name: '2014 weapon with 2024 mastery',
    entityType: 'item',
    ruleset: '2014',
    data: withChanges(longsword2014, { weapon: { ...longsword2024.weapon } }),
    expectedPath: 'weapon',
  },
  { name: 'weapon without statistics', entityType: 'item', ruleset: '2024', data: withChanges(longsword2024, { weapon: undefined }), expectedPath: 'weapon' },
  {
    name: 'mundane item requiring attunement',
    entityType: 'item',
    ruleset: '2024',
    data: withChanges(chainMail2024, { attunement: { required: true } }),
    expectedPath: 'attunement.required',
  },
  {
    name: 'versatile weapon without versatile damage',
    entityType: 'item',
    ruleset: '2014',
    data: withChanges(longsword2014, { weapon: { ...longsword2014.weapon, versatileDamage: undefined } }),
    expectedPath: 'weapon.versatileDamage',
  },
  { name: 'unknown rarity', entityType: 'item', ruleset: '2014', data: withChanges(wandOfFireballs2014, { rarity: 'mythic' }), expectedPath: 'rarity' },
  { name: 'CR/XP mismatch', entityType: 'monster', ruleset: '2014', data: withChanges(goblin2014, { xp: 100 }), expectedPath: 'xp' },
  { name: 'invalid challenge rating', entityType: 'monster', ruleset: '2014', data: withChanges(goblin2014, { challengeRating: 0.75 }), expectedPath: 'challengeRating' },
  {
    name: 'HP average does not match formula',
    entityType: 'monster',
    ruleset: '2014',
    data: withChanges(goblin2014, { hitPoints: { average: 9, formula: '2d6' } }),
    expectedPath: 'hitPoints.average',
  },
  {
    name: 'ability score above 30',
    entityType: 'monster',
    ruleset: '2024',
    data: withChanges(goblinWarrior2024, { abilityScores: { ...goblinWarrior2024.abilityScores, str: 31 } }),
    expectedPath: 'abilityScores.str',
  },
  { name: '2014 monster with 2024 initiative', entityType: 'monster', ruleset: '2014', data: withChanges(goblin2014, { initiative: { modifier: 2, score: 12 } }), expectedPath: '' },
  { name: 'wrong proficiency bonus', entityType: 'monster', ruleset: '2014', data: withChanges(lich2014, { proficiencyBonus: 2 }), expectedPath: 'proficiencyBonus' },
  { name: 'unknown condition immunity', entityType: 'monster', ruleset: '2024', data: withChanges(swarmOfRats2024, { conditionImmunities: ['bored'] }), expectedPath: 'conditionImmunities.0' },
  { name: 'unknown skill', entityType: 'monster', ruleset: '2014', data: withChanges(goblin2014, { skills: { juggling: 2 } }), expectedPath: 'skills.juggling' },
  { name: 'swarm member larger than swarm', entityType: 'monster', ruleset: '2024', data: withChanges(swarmOfRats2024, { swarmOf: 'large' }), expectedPath: 'swarmOf' },
];
