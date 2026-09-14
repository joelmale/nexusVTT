# Adding Monsters to the Monster Library

This guide explains how to add new monsters to the D&D NexusForge monster library. The system supports multiple methods for adding monsters, from simple custom monster creation to adding official monsters to the SRD database.

## Table of Contents

1. [Quick Custom Monster Creation](#quick-custom-monster-creation)
2. [Adding Monsters to SRD Database](#adding-monsters-to-srd-database)
3. [Monster Data Structure](#monster-data-structure)
4. [Monster Types and Categories](#monster-types-and-categories)
5. [Validation and Testing](#validation-and-testing)
6. [Best Practices](#best-practices)

## Quick Custom Monster Creation

The easiest way to add monsters is through the built-in custom monster creator in the Monster Library.

### Method 1: Using the Monster Library UI

1. **Navigate to Monster Library**
   - Open the application and go to the Monster Library section

2. **Click "Create Monster"**
   - Click the "Create Monster" button in the top-right corner

3. **Fill in Monster Details**
   - **Basic Info**: Name, size, type, alignment
   - **Stats**: Armor Class, Hit Points, Hit Dice
   - **Ability Scores**: STR, DEX, CON, INT, WIS, CHA
   - **Speed**: Walking speed and optional fly/swim/burrow/climb speeds
   - **Challenge Rating**: CR and XP value
   - **Defenses**: Damage vulnerabilities, resistances, immunities
   - **Senses**: Passive Perception and special senses
   - **Languages**: Languages the monster can speak
   - **Special Abilities**: Custom abilities with descriptions
   - **Actions**: Attack actions and damage
   - **Legendary Actions**: For powerful monsters
   - **Reactions**: Special reactions

4. **Save the Monster**
   - Click "Create Monster" to save
   - The monster will appear in your custom monsters list

### Method 2: Bulk Import (Advanced)

For adding multiple monsters at once, you can create a JSON file and import it programmatically.

```typescript
import { useMonsterContext } from '../hooks';

const bulkImportMonsters = async (monsters: UserMonster[]) => {
  const { createCustomMonster } = useMonsterContext();

  for (const monster of monsters) {
    await createCustomMonster(monster);
  }
};
```

## Adding Monsters to SRD Database

For official monsters or homebrew monsters that should be part of the core database, add them to the SRD JSON files.

### Method 1: Adding to Existing SRD Files

1. **Locate SRD Files**
   ```
   src/data/srd/2014/5e-SRD-Monsters.json
   ```

2. **Add Monster Entry**
   Add your monster to the JSON array following the SRD format:

```json
{
  "index": "my-custom-monster",
  "name": "My Custom Monster",
  "size": "Large",
  "type": "monstrosity",
  "alignment": "neutral evil",
  "armor_class": [{"type": "natural", "value": 15}],
  "hit_points": 85,
  "hit_dice": "10d10",
  "hit_points_roll": "10d10+30",
  "speed": {"walk": "40 ft."},
  "strength": 18,
  "dexterity": 12,
  "constitution": 16,
  "intelligence": 8,
  "wisdom": 14,
  "charisma": 10,
  "proficiencies": [
    {
      "value": 4,
      "proficiency": {
        "index": "saving-throw-wis",
        "name": "Saving Throw: WIS",
        "url": "/api/2014/proficiencies/saving-throw-wis"
      }
    }
  ],
  "damage_vulnerabilities": [],
  "damage_resistances": [],
  "damage_immunities": [],
  "condition_immunities": [],
  "senses": {"passive_perception": 12},
  "languages": "Common",
  "challenge_rating": 3,
  "proficiency_bonus": 2,
  "xp": 700,
  "special_abilities": [
    {
      "name": "Special Ability",
      "desc": "This monster has a special ability that does something cool."
    }
  ],
  "actions": [
    {
      "name": "Bite",
      "desc": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) piercing damage."
    }
  ]
}
```

3. **Update Monster Count**
   - Update the comment in `dataService.ts` that mentions the monster count
   - The system will automatically include your new monster

### Method 2: Creating New SRD Files

For large additions or different editions:

1. **Create New SRD File**
   ```
   src/data/srd/2014/5e-SRD-Monsters-Custom.json
   ```

2. **Import in dataService.ts**
   ```typescript
   import customMonsters from '../data/srd/2014/5e-SRD-Monsters-Custom.json';

   export const loadMonsters = (): Monster[] => {
     const srdMonsters = srdMonsters2014.map(monster => ({
       ...monster,
       senses: Object.fromEntries(
         Object.entries(monster.senses || {}).filter(([_, value]) => value !== undefined)
       ) as Record<string, string | number>
     })) as Monster[];

     const customMonstersProcessed = customMonsters.map(monster => ({
       ...monster,
       senses: Object.fromEntries(
         Object.entries(monster.senses || {}).filter(([_, value]) => value !== undefined)
       ) as Record<string, string | number>
     })) as Monster[];

     return [...srdMonsters, ...customMonstersProcessed];
   };
   ```

## Monster Data Structure

### Required Fields

```typescript
interface Monster {
  index: string;           // Unique identifier (lowercase, hyphenated)
  name: string;            // Display name
  size: MonsterSize;       // 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'
  type: MonsterType;       // See Monster Types section below
  alignment: string;       // e.g., "lawful good", "neutral evil", "unaligned"
  armor_class: MonsterArmorClass[];
  hit_points: number;
  hit_dice: string;        // e.g., "12d8", "18d10+36"
  hit_points_roll: string; // e.g., "12d8+24", "18d10+36"
  speed: MonsterSpeed;
  strength: number;        // 1-30
  dexterity: number;       // 1-30
  constitution: number;    // 1-30
  intelligence: number;    // 1-30
  wisdom: number;          // 1-30
  charisma: number;        // 1-30
  proficiencies: MonsterProficiency[];
  damage_vulnerabilities: string[];
  damage_resistances: string[];
  damage_immunities: string[];
  condition_immunities: MonsterConditionImmunity[];
  senses: Record<string, string | number>;
  languages: string;
  challenge_rating: number;
  proficiency_bonus: number;
  xp: number;
}
```

### Optional Fields

```typescript
interface Monster {
  subtype?: string;                    // Subtype of monster type
  special_abilities?: MonsterSpecialAbility[];
  actions?: MonsterAction[];
  legendary_actions?: MonsterLegendaryAction[];
  reactions?: MonsterReaction[];
  url?: string;                        // API URL reference
  image?: string;                      // Image URL
  desc?: string[];                     // Additional description paragraphs
}
```

### Armor Class Structure

```typescript
armor_class: [
  {
    "type": "natural",     // "natural", "dex", "armor", "spell", "magic"
    "value": 15
  }
]
```

### Speed Structure

```typescript
speed: {
  "walk": "30 ft.",
  "fly": "60 ft.",
  "swim": "40 ft.",
  "burrow": "20 ft.",
  "climb": "30 ft.",
  "hover": true
}
```

### Actions Structure

```typescript
actions: [
  {
    "name": "Bite",
    "desc": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) piercing damage.",
    "attack_bonus": 6,
    "damage": [
      {
        "damage_type": {
          "index": "piercing",
          "name": "Piercing",
          "url": "/api/2014/damage-types/piercing"
        },
        "damage_dice": "2d8+5"
      }
    ]
  }
]
```

## Monster Types and Categories

### Monster Types

The system recognizes these monster types:

- **aberration**: Mind flayers, beholders, aboleths
- **beast**: Animals and magical beasts
- **celestial**: Angels, devas, planetars
- **construct**: Golems, animated objects
- **dragon**: Dragons and dragon-like creatures
- **elemental**: Elementals and elemental creatures
- **fey**: Elves, sprites, unicorns
- **fiend**: Demons, devils, yugoloths
- **giant**: Giants and giant-kin
- **humanoid**: Human-like creatures
- **monstrosity**: Owlbears, displacer beasts
- **ooze**: Black puddings, gelatinous cubes
- **plant**: Shambling mounds, treants
- **undead**: Zombies, vampires, ghosts

### Size Categories

- **Tiny**: Under 2 feet tall
- **Small**: 2-4 feet tall
- **Medium**: 4-8 feet tall
- **Large**: 8-16 feet tall
- **Huge**: 16-32 feet tall
- **Gargantuan**: Over 32 feet tall

### Challenge Rating Guidelines

| CR | XP | Typical Monster Examples |
|----|----|--------------------------|
| 0 | 10 | Common animals, insects |
| 1/8 | 25 | Kobolds, goblins |
| 1/4 | 50 | Orcs, giant rats |
| 1/2 | 100 | Bugbears, hobgoblins |
| 1 | 200 | Owlbears, ettins |
| 2 | 450 | Manticores, ogres |
| 3 | 700 | Basilisks, displacer beasts |
| 4 | 1,100 | Hill giants, wyverns |
| 5 | 1,800 | Trolls, young dragons |
| 6 | 2,300 | Chimera, cyclops |
| 7 | 2,900 | Adult black dragon |
| 8 | 3,900 | Ancient gold dragon |

## Validation and Testing

### Automated Validation

The system includes validation for monster data:

```typescript
// Check required fields
const requiredFields = ['index', 'name', 'size', 'type', 'alignment', 'armor_class', 'hit_points', 'hit_dice', 'speed', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'challenge_rating'];

const missingFields = requiredFields.filter(field => !monster[field]);
if (missingFields.length > 0) {
  console.error(`Monster ${monster.name} missing required fields:`, missingFields);
}
```

### Manual Testing Steps

1. **Add Monster**: Create or add your monster using one of the methods above
2. **Check Library**: Verify the monster appears in the Monster Library
3. **Test Filtering**: Ensure the monster can be filtered by type, CR, etc.
4. **Encounter Creation**: Try adding the monster to an encounter
5. **Stat Block**: Check that the stat block displays correctly
6. **Combat Calculator**: Verify the monster works in combat calculations

### Common Issues

- **Missing index**: Each monster needs a unique `index` field
- **Invalid ability scores**: Must be integers 1-30
- **Malformed actions**: Action descriptions must follow D&D format
- **Incorrect CR calculation**: Ensure XP matches CR table
- **Type mismatches**: Use exact strings from the type list

## Best Practices

### Naming Conventions

- **index**: Use lowercase, hyphen-separated (e.g., `young-black-dragon`)
- **name**: Use title case (e.g., `Young Black Dragon`)
- **URLs**: Follow the pattern `/api/2014/monsters/{index}`

### Data Quality

- **Complete descriptions**: Include detailed action descriptions
- **Accurate stats**: Double-check ability modifiers and saves
- **Proper formatting**: Use consistent damage dice notation
- **Balance consideration**: Ensure CR matches monster difficulty

### Performance Considerations

- **Image optimization**: Use appropriately sized images
- **Lazy loading**: Large monster lists are loaded on demand
- **Caching**: Custom monsters are cached in IndexedDB

### Organization

- **Group by source**: Keep official monsters separate from homebrew
- **Version control**: Track changes to monster data
- **Documentation**: Document any special rules or homebrew elements

### Homebrew Guidelines

- **Balance**: Ensure homebrew monsters are appropriately balanced
- **Clarity**: Write clear, unambiguous ability descriptions
- **Compatibility**: Follow D&D 5e rules conventions
- **Testing**: Playtest homebrew monsters before adding to library

## Examples

### Simple Custom Monster

```json
{
  "index": "flame-sprite",
  "name": "Flame Sprite",
  "size": "Tiny",
  "type": "elemental",
  "alignment": "neutral",
  "armor_class": [{"type": "dex", "value": 15}],
  "hit_points": 2,
  "hit_dice": "1d4",
  "hit_points_roll": "1d4",
  "speed": {"walk": "10 ft.", "fly": "60 ft."},
  "strength": 3,
  "dexterity": 20,
  "constitution": 10,
  "intelligence": 14,
  "wisdom": 13,
  "charisma": 11,
  "damage_vulnerabilities": ["cold"],
  "damage_resistances": ["fire", "nonmagical"],
  "damage_immunities": [],
  "condition_immunities": [],
  "senses": {"passive_perception": 11},
  "languages": "Common, Primordial",
  "challenge_rating": 0.25,
  "proficiency_bonus": 2,
  "xp": 50,
  "special_abilities": [
    {
      "name": "Illumination",
      "desc": "The sprite sheds bright light in a 10-foot radius and dim light for an additional 10 feet."
    }
  ],
  "actions": [
    {
      "name": "Fire Bolt",
      "desc": "Ranged Spell Attack: +4 to hit, range 120 ft., one target. Hit: 1d10 fire damage."
    }
  ]
}
```

### Complex Monster with Legendary Actions

```json
{
  "index": "ancient-red-dragon",
  "name": "Ancient Red Dragon",
  "size": "Gargantuan",
  "type": "dragon",
  "alignment": "chaotic evil",
  "armor_class": [{"type": "natural", "value": 22}],
  "hit_points": 546,
  "hit_dice": "28d20",
  "hit_points_roll": "28d20+252",
  "speed": {"walk": "40 ft.", "climb": "40 ft.", "fly": "80 ft."},
  "strength": 30,
  "dexterity": 10,
  "constitution": 29,
  "intelligence": 18,
  "wisdom": 15,
  "charisma": 23,
  "saving_throws": {"dex": 7, "con": 16, "wis": 9, "cha": 13},
  "damage_immunities": ["fire"],
  "senses": {"blindsight": "60 ft.", "darkvision": "120 ft.", "passive_perception": 22},
  "languages": "Common, Draconic",
  "challenge_rating": 24,
  "proficiency_bonus": 7,
  "xp": 62000,
  "legendary_actions": [
    {
      "name": "Cast a Spell",
      "desc": "The dragon casts a spell from its list of prepared spells, using a spellcasting ability of Intelligence (spell save DC 20, +12 to hit with spell attacks)."
    }
  ]
}
```

This documentation provides comprehensive guidance for adding monsters through both the UI and direct JSON file modifications, ensuring data quality and system compatibility.