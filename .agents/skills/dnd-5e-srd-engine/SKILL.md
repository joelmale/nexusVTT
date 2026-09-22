---
name: dnd-5e-srd-engine
description: >-
  Domain-specific rules engine and schema reference for D&D 5e SRD entities (2014 & 2024 revisions).
  Provides canonical schemas, math formulas (CR to XP, proficiency bonus, ability modifiers, spell slot matrices,
  multiclass progression), and validation logic for stat blocks, spells, items, and character creator outputs.
---

# D&D 5e SRD Engine

Authoritative reference for D&D 5th Edition System Reference Document (SRD) mechanics, schemas, and mathematical calculations across Forge, Codex, and VTT applications.

## When to Use

Activate this skill when:
- Parsing, importing, or validating D&D 5e SRD entities (monsters, spells, magic items, classes, races/species).
- Working on character creation wizards, progression calculators, or level-up logic.
- Implementing combat math, challenge rating (CR) calculators, passive scores, or multiclass spell slot matrices.
- Ensuring compliance between 2014 and 2024 5e SRD rulesets.

---

## Core Guidelines & Architectural Rules

1. **Shared Character Creator Ownership**:
   - The D&D 5e character creation wizard is owned by `@nexus/character-creator` (`packages/character-creator`).
   - Hosts (Forge / VTT) must consume the typed `CharacterCreationResult` contract. Do not duplicate wizard logic in host applications.
2. **CSS Boundary Constraint**:
   - The creator UI is strictly scoped to `.nexus-character-creator`. Do not leak blanket global styles into this subtree.
3. **2014 vs. 2024 SRD Awareness**:
   - **2014**: Race provides Ability Score Increases (ASI). Background provides flavor and 2 skills.
   - **2024**: Species provides biological traits (Darkvision, speed). Background provides ASI (+2/+1 or +1/+1/+1), Origin Feat, and tool/skill proficiencies.
   - Support both formats seamlessly by validating optional fields.

---

## Mathematical Formulas & Core Mechanics

For detailed progression tables and matrices, see [formulas.md](./references/formulas.md).

### 1. Ability Score Modifier
$$\text{Modifier} = \lfloor \frac{\text{Score} - 10}{2} \rfloor$$

```typescript
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
```

### 2. Proficiency Bonus by Level
$$\text{Proficiency Bonus} = \lceil 1 + \frac{\text{Level}}{4} \rceil$$

```typescript
export function getProficiencyBonus(level: number): number {
  return Math.ceil(1 + level / 4);
}
```

### 3. Passive Scores
$$\text{Passive Score} = 10 + \text{Ability Modifier} + (\text{Proficiency Bonus if proficient}) + (\text{5 if Advantage, -5 if Disadvantage})$$

---

## Entity Schemas & Validation

For full TypeScript interfaces, see [srd-schemas.md](./references/srd-schemas.md).

- **Monster / Stat Block**: AC (with armor type), HP (with hit dice formula), speeds, ability scores, saving throws, skills, damage resistances/immunities, condition immunities, senses, languages, CR, traits, actions, bonus actions, reactions, legendary actions.
- **Spell**: Level (0-9), school, casting time, range/area, components (V, S, M with gold cost / consumption), duration, concentration, ritual, description, at higher levels.
- **Item**: Type (weapon, armor, potion, scroll, wondrous), rarity (common to artifact), attunement requirements, properties (finesse, versatile, light, heavy).
