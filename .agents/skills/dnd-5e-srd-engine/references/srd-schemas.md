# D&D 5e SRD Schema Contracts

This document contains canonical TypeScript interfaces representing 5e SRD entities.

---

## 1. CharacterCreationResult (Shared Creator Contract)

```typescript
export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface CharacterCreationResult {
  name: string;
  species: string; // "race" in 2014, "species" in 2024
  classId: string;
  subclassId?: string;
  level: number;
  background: string;
  alignment: string;
  abilityScores: AbilityScores;
  proficiencies: {
    savingThrows: (keyof AbilityScores)[];
    skills: string[];
    armor: string[];
    weapons: string[];
    tools: string[];
    languages: string[];
  };
  hitPoints: {
    max: number;
    current: number;
    hitDice: string;
  };
  equipment: {
    id: string;
    name: string;
    quantity: number;
  }[];
  spellsKnown?: string[];
  cantripsKnown?: string[];
  originFeat?: string; // 2024 SRD
  rulesetRevision: '2014' | '2024';
}
```

---

## 2. Monster / Creature Stat Block

```typescript
export interface MonsterAction {
  name: string;
  desc: string;
  attackBonus?: number;
  damageDice?: string;
  damageBonus?: number;
}

export interface MonsterStatBlock {
  name: string;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  type: string;
  subtype?: string;
  alignment: string;
  armorClass: {
    value: number;
    type?: string; // e.g., "natural armor", "chain shirt"
  };
  hitPoints: {
    average: number;
    formula: string; // e.g., "8d8 + 24"
  };
  speed: Record<'walk' | 'fly' | 'swim' | 'climb' | 'burrow', number | undefined>;
  abilityScores: AbilityScores;
  savingThrows?: Partial<Record<keyof AbilityScores, number>>;
  skills?: Record<string, number>;
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses: {
    darkvision?: number;
    blindsight?: number;
    tremorsense?: number;
    truesight?: number;
    passivePerception: number;
  };
  languages: string;
  challengeRating: string; // e.g., "1/4", "5", "20"
  experiencePoints: number;
  specialTraits?: { name: string; desc: string }[];
  actions: MonsterAction[];
  bonusActions?: MonsterAction[];
  reactions?: MonsterAction[];
  legendaryActions?: {
    count: number;
    actions: { name: string; desc: string; cost?: number }[];
  };
}
```

---

## 3. Spell Entity

```typescript
export interface SpellEntity {
  id: string;
  name: string;
  level: number; // 0 for Cantrips
  school: 'Abjuration' | 'Conjuration' | 'Divination' | 'Enchantment' | 'Evocation' | 'Illusion' | 'Necromancy' | 'Transmutation';
  castingTime: string; // e.g., "1 action", "1 bonus action", "10 minutes"
  range: string; // e.g., "Self", "60 feet", "Touch"
  components: {
    verbal: boolean;
    somatic: boolean;
    material?: {
      description: string;
      costGpValue?: number;
      consumed: boolean;
    };
  };
  duration: string; // e.g., "Instantaneous", "1 hour"
  concentration: boolean;
  ritual: boolean;
  classes: string[];
  description: string;
  higherLevelsDescription?: string;
}
```
