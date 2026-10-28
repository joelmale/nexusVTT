import { AbilityName, CharacterCreationData } from '../../types/dnd';

export interface ReferenceBuildOracle {
  id:
    | 'F14'
    | 'F24'
    | 'R14'
    | 'R24'
    | 'W14'
    | 'W24'
    | 'WL14'
    | 'WL24'
    | 'B14'
    | 'B24'
    | 'M14'
    | 'M24';
  title: string;
  edition: '2014' | '2024';
  creationData: CharacterCreationData;
  expected: {
    abilities: Record<AbilityName, number>;
    hp: number;
    ac: number;
    initiative: number;
    speed: number;
    saves: {
      proficient: AbilityName[];
      bonuses: Partial<Record<AbilityName, number>>;
    };
    attacks: Array<{
      name: string;
      attackBonus: number;
      damage: string;
    }>;
    skills?: Partial<Record<string, { bonus: number; expertise?: boolean }>>;
    features: string[];
    spells?: {
      cantripsCount: number;
      knownOrBookCount: number;
      preparedCount: number;
      spellAttackBonus: number;
      spellSaveDC: number;
    };
    currency?: {
      gp: number;
      sp?: number;
      cp?: number;
      ep?: number;
      pp?: number;
    };
  };
}

/**
 * Proposed independent fixed-input oracles from Section 6.1 of the
 * shared character creation implementation plan.
 */
export const REFERENCE_BUILDS: Record<string, ReferenceBuildOracle> = {
  F14: {
    id: 'F14',
    title: 'Standard Human Fighter/Soldier (2014)',
    edition: '2014',
    creationData: {
      name: 'Human Fighter 2014',
      level: 1,
      edition: '2014',
      speciesSlug: 'human',
      variantSlug: 'standard',
      classSlug: 'fighter',
      background: 'soldier',
      abilities: { STR: 15, DEX: 13, CON: 14, INT: 8, WIS: 12, CHA: 10 },
      abilityScoreMethod: 'standard-array',
      selectedSkills: ['Acrobatics', 'Survival'],
      fightingStyle: 'defense',
      alignment: 'True Neutral',
      equipmentChoices: [
        {
          choiceId: 'armor',
          description: 'Armor choice',
          options: [[{ name: 'Chain Mail', quantity: 1, type: 'armor' }]],
          selected: 0,
        },
        {
          choiceId: 'weapons',
          description: 'Weapons choice',
          options: [
            [
              { name: 'Longsword', quantity: 1, type: 'weapon' },
              { name: 'Shield', quantity: 1, type: 'armor' },
            ],
          ],
          selected: 0,
        },
      ],
      selectedMusicalInstruments: [],
      spellSelection: {
        selectedCantrips: [],
        knownSpells: [],
      },
      hpCalculationMethod: 'max',
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
    },
    expected: {
      abilities: { STR: 16, DEX: 14, CON: 15, INT: 9, WIS: 13, CHA: 11 },
      hp: 12, // 10 base d10 + 2 CON mod
      ac: 19, // Chain Mail (16) + Shield (+2) + Defense style (+1)
      initiative: 2, // DEX mod (+2)
      speed: 30,
      saves: {
        proficient: ['STR', 'CON'],
        bonuses: { STR: 5, CON: 4 }, // STR: +3 mod + 2 prof = +5; CON: +2 mod + 2 prof = +4
      },
      attacks: [
        {
          name: 'Longsword',
          attackBonus: 5, // +3 STR + 2 prof
          damage: '1d8+3',
        },
      ],
      skills: {
        athletics: { bonus: 5 }, // +3 STR + 2 prof
        intimidation: { bonus: 2 }, // +0 CHA + 2 prof
        acrobatics: { bonus: 4 }, // +2 DEX + 2 prof
        survival: { bonus: 3 }, // +1 WIS + 2 prof
      },
      features: ['Fighting Style: Defense', 'Second Wind'],
      currency: { gp: 10 },
    },
  },

  F24: {
    id: 'F24',
    title: 'Human Fighter/Soldier (2024)',
    edition: '2024',
    creationData: {
      name: 'Human Fighter 2024',
      level: 1,
      edition: '2024',
      speciesSlug: 'human-2024',
      classSlug: 'fighter',
      background: 'soldier-2024',
      abilities: { STR: 15, DEX: 13, CON: 14, INT: 8, WIS: 12, CHA: 10 },
      backgroundAbilityChoices: {
        method: '2/1',
        bonuses: { STR: 2, CON: 1 },
      },
      originFeat: 'savage-attacker',
      humanOriginFeat: 'tough',
      weaponMastery: ['Greatsword', 'Flail', 'Javelin'],
      speciesSkillProficiency: 'Perception',
      fightingStyle: 'defense',
      alignment: 'True Neutral',
      abilityScoreMethod: 'standard-array',
      selectedSkills: ['Acrobatics', 'Survival'],
      selectedMusicalInstruments: [],
      spellSelection: {
        selectedCantrips: [],
        knownSpells: [],
      },
      hpCalculationMethod: 'max',
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
      equipmentChoices: [
        {
          choiceId: 'package_a',
          description: 'Starting package',
          options: [
            [
              { name: 'Chain Mail', quantity: 1, type: 'armor' },
              { name: 'Greatsword', quantity: 1, type: 'weapon' },
              { name: 'Flail', quantity: 1, type: 'weapon' },
              { name: 'Javelin', quantity: 8, type: 'weapon' },
              { name: "Dungeoneer's Pack", quantity: 1, type: 'gear' },
              { name: '4 gp', quantity: 1, type: 'gear' },
            ],
          ],
          selected: 0,
        },
      ],
    },
    expected: {
      abilities: { STR: 17, DEX: 13, CON: 15, INT: 8, WIS: 12, CHA: 10 },
      hp: 14, // 10 base d10 + 2 CON mod + 2 Tough feat
      ac: 17, // Chain Mail (16) + Defense style (+1) [No shield in Package A]
      initiative: 1,
      speed: 30,
      saves: {
        proficient: ['STR', 'CON'],
        bonuses: { STR: 5, CON: 4 },
      },
      attacks: [
        {
          name: 'Greatsword',
          attackBonus: 5, // +3 STR + 2 prof
          damage: '2d6+3',
        },
      ],
      skills: {
        athletics: { bonus: 5 },
        intimidation: { bonus: 2 },
      },
      features: [
        'Fighting Style: Defense',
        'Second Wind',
        'Weapon Mastery',
        'Tough',
        'Savage Attacker',
      ],
      currency: { gp: 18 }, // 4 gp (Class package A) + 14 gp (Soldier background)
    },
  },

  R14: {
    id: 'R14',
    title: 'Wood Elf Rogue/Criminal (2014)',
    edition: '2014',
    creationData: {
      name: 'Elf Rogue 2014',
      level: 1,
      edition: '2014',
      speciesSlug: 'elf',
      selectedLineage: 'wood-elf',
      classSlug: 'rogue',
      background: 'criminal',
      abilities: { STR: 8, DEX: 15, CON: 13, INT: 12, WIS: 14, CHA: 10 },
      abilityScoreMethod: 'standard-array',
      selectedSkills: [
        'Athletics',
        'Investigation',
        'SleightOfHand',
        'Acrobatics',
      ],
      expertiseSkills: ['stealth', 'sleight_of_hand'],
      alignment: 'True Neutral',
      equipmentChoices: [
        {
          choiceId: 'rogue-kit',
          description: '2014 Rogue starting equipment choices',
          selected: 0,
          options: [
            [
              { name: 'Leather Armor', quantity: 1, type: 'armor' },
              { name: 'Dagger', quantity: 2, type: 'weapon' },
              { name: 'Shortsword', quantity: 1, type: 'weapon' },
              { name: 'Shortbow', quantity: 1, type: 'weapon' },
              { name: 'Arrow', quantity: 20, type: 'gear' },
              { name: 'Quiver', quantity: 1, type: 'gear' },
              { name: "Thieves' Tools", quantity: 1, type: 'gear' },
              { name: "Burglar's Pack", quantity: 1, type: 'gear' },
            ],
          ],
        },
      ],
      selectedMusicalInstruments: [],
      spellSelection: {
        selectedCantrips: [],
        knownSpells: [],
      },
      hpCalculationMethod: 'max',
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
    },
    expected: {
      abilities: { STR: 8, DEX: 17, CON: 13, INT: 12, WIS: 15, CHA: 10 },
      hp: 9, // 8 base d8 + 1 CON mod
      ac: 14, // Leather Armor (11) + 3 DEX mod
      initiative: 3,
      speed: 35, // Wood elf 35 ft
      saves: {
        proficient: ['DEX', 'INT'],
        bonuses: { DEX: 5, INT: 3 },
      },
      attacks: [
        {
          name: 'Shortbow',
          attackBonus: 5, // +3 DEX + 2 prof
          damage: '1d6+3',
        },
      ],
      skills: {
        stealth: { bonus: 7, expertise: true }, // +3 DEX + (2 * 2 prof) = +7
        sleight_of_hand: { bonus: 7, expertise: true }, // +3 DEX + (2 * 2 prof) = +7
        perception: { bonus: 4 }, // +2 WIS + 2 prof (Elf Keen Senses)
      },
      features: [
        'Sneak Attack (1d6)',
        "Thieves' Cant",
        'Expertise',
        'Darkvision',
        'Fey Ancestry',
        'Mask of the Wild',
      ],
      currency: { gp: 15 },
    },
  },

  R24: {
    id: 'R24',
    title: 'Wood Elf Rogue/Criminal (2024)',
    edition: '2024',
    creationData: {
      name: 'Elf Rogue 2024',
      level: 1,
      edition: '2024',
      speciesSlug: 'elf-2024',
      speciesSkillProficiency: 'Insight',
      weaponMastery: ['Shortbow', 'Dagger'],
      selectedLineage: 'wood-elf',
      classSlug: 'rogue',
      background: 'criminal-2024',
      abilities: { STR: 8, DEX: 15, CON: 13, INT: 12, WIS: 14, CHA: 10 },
      backgroundAbilityChoices: {
        method: '2/1',
        bonuses: { DEX: 2, CON: 1 },
      },
      originFeat: 'alert',
      abilityScoreMethod: 'standard-array',
      selectedSkills: [
        'Acrobatics',
        'Deception',
        'Investigation',
        'Perception',
      ],
      expertiseSkills: ['stealth', 'sleight_of_hand'],
      alignment: 'True Neutral',
      equipmentChoices: [
        {
          choiceId: 'rogue-kit',
          description: 'SRD 5.2.1 p61 Rogue package A',
          selected: 0,
          options: [
            [
              { name: 'Leather Armor', quantity: 1, type: 'armor' },
              { name: 'Dagger', quantity: 2, type: 'weapon' },
              { name: 'Shortsword', quantity: 1, type: 'weapon' },
              { name: 'Shortbow', quantity: 1, type: 'weapon' },
              { name: 'Arrow', quantity: 20, type: 'gear' },
              { name: 'Quiver', quantity: 1, type: 'gear' },
              { name: "Thieves' Tools", quantity: 1, type: 'gear' },
              { name: "Burglar's Pack", quantity: 1, type: 'gear' },
              { name: '8 gp', quantity: 1, type: 'gear' },
            ],
          ],
        },
      ],
      selectedMusicalInstruments: [],
      spellSelection: {
        selectedCantrips: [],
        knownSpells: [],
      },
      hpCalculationMethod: 'max',
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
    },
    expected: {
      abilities: { STR: 8, DEX: 17, CON: 14, INT: 12, WIS: 14, CHA: 10 },
      hp: 10, // 8 base d8 + 2 CON mod
      ac: 14, // Leather Armor (11) + 3 DEX mod
      initiative: 5, // Alert feat adds PB (+2) to DEX mod (+3) = +5
      speed: 35,
      saves: {
        proficient: ['DEX', 'INT'],
        bonuses: { DEX: 5, INT: 3 },
      },
      attacks: [
        {
          name: 'Shortbow',
          attackBonus: 5,
          damage: '1d6+3',
        },
      ],
      skills: {
        stealth: { bonus: 7, expertise: true },
        sleight_of_hand: { bonus: 7, expertise: true },
      },
      features: [
        'Sneak Attack (1d6)',
        "Thieves' Cant",
        'Weapon Mastery',
        'Alert',
        'Darkvision',
        'Fey Ancestry',
      ],
      currency: { gp: 24 }, // SRD 5.2.1: Rogue package A (8) + Criminal package A (16).
    },
  },

  W14: {
    id: 'W14',
    title: 'High Elf Wizard/Sage (2014)',
    edition: '2014',
    creationData: {
      name: 'Elf Wizard 2014',
      level: 1,
      edition: '2014',
      speciesSlug: 'elf',
      selectedLineage: 'high-elf',
      classSlug: 'wizard',
      background: 'sage',
      abilities: { STR: 8, DEX: 14, CON: 13, INT: 15, WIS: 12, CHA: 10 },
      selectedSkills: ['Insight', 'Investigation'],
      alignment: 'True Neutral',
      abilityScoreMethod: 'standard-array',
      equipmentChoices: [],
      selectedMusicalInstruments: [],
      spellSelection: {
        selectedCantrips: [
          'fire-bolt',
          'mage-hand',
          'light',
          'prestidigitation',
        ],
        spellbook: [
          'magic-missile',
          'mage-armor',
          'shield',
          'sleep',
          'detect-magic',
          'feather-fall',
        ],
        preparedSpells: ['magic-missile', 'mage-armor', 'shield', 'sleep'],
      },
      hpCalculationMethod: 'max',
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
    },
    expected: {
      abilities: { STR: 8, DEX: 16, CON: 13, INT: 16, WIS: 12, CHA: 10 },
      hp: 7, // 6 base d6 + 1 CON mod
      ac: 13, // Unarmored 10 + 3 DEX
      initiative: 3,
      speed: 30,
      saves: {
        proficient: ['INT', 'WIS'],
        bonuses: { INT: 5, WIS: 3 },
      },
      attacks: [
        {
          name: 'Fire Bolt',
          attackBonus: 5, // +3 INT + 2 prof
          damage: '1d10',
        },
      ],
      spells: {
        cantripsCount: 4,
        knownOrBookCount: 6,
        preparedCount: 4,
        spellAttackBonus: 5,
        spellSaveDC: 13, // 8 + 2 prof + 3 INT
      },
      features: [
        'Spellcasting',
        'Arcane Recovery',
        'Darkvision',
        'Fey Ancestry',
        'Trance',
      ],
      currency: { gp: 10 },
    },
  },

  W24: {
    id: 'W24',
    title: 'High Elf Wizard/Sage (2024)',
    edition: '2024',
    creationData: {
      name: 'Elf Wizard 2024',
      level: 1,
      edition: '2024',
      speciesSlug: 'elf-2024',
      speciesSkillProficiency: 'Survival',
      selectedLineage: 'high-elf',
      classSlug: 'wizard',
      background: 'sage-2024',
      abilities: { STR: 8, DEX: 14, CON: 13, INT: 15, WIS: 12, CHA: 10 },
      backgroundAbilityChoices: {
        method: '2/1',
        bonuses: { INT: 2, CON: 1 },
      },
      originFeat: 'magic-initiate-wizard',
      selectedSkills: ['Insight', 'Investigation'],
      alignment: 'True Neutral',
      abilityScoreMethod: 'standard-array',
      equipmentChoices: [
        {
          choiceId: 'wizard-kit',
          description: 'SRD 5.2.1 p77 Wizard package A',
          selected: 0,
          options: [
            [
              { name: 'Dagger', quantity: 2, type: 'weapon' },
              { name: 'Quarterstaff', quantity: 1, type: 'weapon' },
              { name: 'Robe', quantity: 1, type: 'gear' },
              { name: 'Spellbook', quantity: 1, type: 'gear' },
              { name: "Scholar's Pack", quantity: 1, type: 'gear' },
              { name: '5 gp', quantity: 1, type: 'gear' },
            ],
          ],
        },
      ],
      selectedMusicalInstruments: [],
      spellSelection: {
        selectedCantrips: ['fire-bolt', 'mage-hand', 'ray-of-frost'],
        spellbook: [
          'magic-missile',
          'shield',
          'sleep',
          'detect-magic',
          'find-familiar',
          'thunderwave',
        ],
        preparedSpells: ['magic-missile', 'shield', 'sleep', 'detect-magic'],
      },
      hpCalculationMethod: 'max',
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
    },
    expected: {
      abilities: { STR: 8, DEX: 14, CON: 14, INT: 17, WIS: 12, CHA: 10 },
      hp: 8, // 6 base d6 + 2 CON mod
      ac: 12, // Unarmored 10 + 2 DEX
      initiative: 2,
      speed: 30,
      saves: {
        proficient: ['INT', 'WIS'],
        bonuses: { INT: 5, WIS: 3 },
      },
      attacks: [
        {
          name: 'Fire Bolt',
          attackBonus: 5, // +3 INT + 2 prof
          damage: '1d10',
        },
      ],
      spells: {
        cantripsCount: 3,
        knownOrBookCount: 6,
        preparedCount: 4,
        spellAttackBonus: 5,
        spellSaveDC: 13,
      },
      features: [
        'Spellcasting',
        'Arcane Recovery',
        'Ritual Casting',
        'Magic Initiate',
        'Darkvision',
        'Fey Ancestry',
      ],
      currency: { gp: 13 },
    },
  },
};

// Additional fixed-input references. Numeric expectations are calculated below
// from SRD 5.1 Warlock/Human and SRD 5.2.1 pp70–74,86, not evaluator output.
// Independent human sign-off remains open in the acceptance ledger.
REFERENCE_BUILDS.WL14 = {
  id: 'WL14',
  title: 'Standard Human Warlock/Soldier (2014)',
  edition: '2014',
  creationData: {
    ...REFERENCE_BUILDS.F14.creationData,
    name: 'Human Warlock 2014',
    classSlug: 'warlock',
    subclassSlug: 'fiend',
    abilities: { STR: 8, DEX: 13, CON: 14, INT: 12, WIS: 10, CHA: 15 },
    selectedSkills: ['Arcana', 'Deception'],
    fightingStyle: undefined,
    equipmentChoices: [
      {
        choiceId: 'warlock-kit',
        description: 'Warlock starting gear',
        selected: 0,
        options: [
          [
            { name: 'Leather Armor', quantity: 1, type: 'armor' },
            { name: 'Dagger', quantity: 3, type: 'weapon' },
            { name: 'Quarterstaff', quantity: 1, type: 'weapon' },
            { name: 'Crystal', quantity: 1, type: 'gear' },
            { name: "Scholar's Pack", quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    spellSelection: {
      selectedCantrips: ['eldritch-blast', 'minor-illusion'],
      knownSpells: ['charm-person', 'comprehend-languages'],
    },
  },
  expected: {
    abilities: { STR: 9, DEX: 14, CON: 15, INT: 13, WIS: 11, CHA: 16 },
    hp: 10,
    ac: 13,
    initiative: 2,
    speed: 30,
    saves: { proficient: ['WIS', 'CHA'], bonuses: { WIS: 2, CHA: 5 } },
    attacks: [
      { name: 'Dagger', attackBonus: 4, damage: '1d4+2' },
      { name: 'Eldritch Blast', attackBonus: 5, damage: '1d10' },
    ],
    skills: { arcana: { bonus: 3 }, deception: { bonus: 5 } },
    spells: {
      cantripsCount: 2,
      knownOrBookCount: 2,
      preparedCount: 0,
      spellAttackBonus: 5,
      spellSaveDC: 13,
    },
    features: ['Pact Magic'],
    currency: { gp: 10 },
  },
};

REFERENCE_BUILDS.WL24 = {
  id: 'WL24',
  title: 'Human Warlock/Soldier (2024)',
  edition: '2024',
  creationData: {
    ...REFERENCE_BUILDS.F24.creationData,
    name: 'Human Warlock 2024',
    classSlug: 'warlock',
    abilities: { STR: 8, DEX: 13, CON: 14, INT: 12, WIS: 10, CHA: 15 },
    backgroundAbilityChoices: { method: '2/1', bonuses: { DEX: 2, CON: 1 } },
    selectedSkills: ['Arcana', 'Deception'],
    fightingStyle: undefined,
    weaponMastery: undefined,
    eldritchInvocations: ['eldritch-mind'],
    equipmentChoices: [
      {
        choiceId: 'warlock-kit',
        description: 'Warlock starting gear',
        selected: 0,
        options: [
          [
            { name: 'Leather Armor', quantity: 1, type: 'armor' },
            { name: 'Sickle', quantity: 1, type: 'weapon' },
            { name: 'Dagger', quantity: 2, type: 'weapon' },
            { name: 'Orb', quantity: 1, type: 'gear' },
            { name: 'Book', quantity: 1, type: 'gear' },
            { name: "Scholar's Pack", quantity: 1, type: 'gear' },
            { name: '15 gp', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    spellSelection: {
      selectedCantrips: ['eldritch-blast', 'minor-illusion'],
      knownSpells: ['charm-person', 'hex'],
      preparedSpells: ['charm-person', 'hex'],
    },
  },
  expected: {
    abilities: { STR: 8, DEX: 15, CON: 15, INT: 12, WIS: 10, CHA: 15 },
    hp: 12,
    ac: 13,
    initiative: 2,
    speed: 30,
    saves: { proficient: ['WIS', 'CHA'], bonuses: { WIS: 2, CHA: 4 } },
    attacks: [
      { name: 'Dagger', attackBonus: 4, damage: '1d4+2' },
      { name: 'Eldritch Blast', attackBonus: 4, damage: '1d10' },
    ],
    skills: {
      arcana: { bonus: 3 },
      deception: { bonus: 4 },
      perception: { bonus: 2 },
    },
    spells: {
      cantripsCount: 2,
      knownOrBookCount: 2,
      preparedCount: 2,
      spellAttackBonus: 4,
      spellSaveDC: 12,
    },
    features: ['Pact Magic', 'Eldritch Invocation: Eldritch Mind'],
    currency: { gp: 29 },
  },
};

// Barbarian and Monk references (tranche T-04 batch A). Every expected value is
// calculated by hand from SRD 5.1 (Barbarian, Monk, Half-Orc, Human, Acolyte)
// and SRD 5.2.1 (Barbarian p28-29, Monk p49-50, Criminal/Acolyte p83, Orc,
// Dwarf), never from evaluator output. Independent human sign-off of these
// expectations remains open in the acceptance ledger.
const SHARED_DRAFT_TAIL = {
  selectedMusicalInstruments: [] as string[],
  spellSelection: {
    selectedCantrips: [] as string[],
    knownSpells: [] as string[],
  },
  hpCalculationMethod: 'max' as const,
  personality: '',
  ideals: '',
  bonds: '',
  flaws: '',
};

// SRD 5.1: Half-Orc (STR +2, CON +1, Menacing), Acolyte (Insight, Religion,
// 15 gp). Barbarian: d12, saves STR/CON, Unarmored Defense 10 + DEX + CON.
REFERENCE_BUILDS.B14 = {
  id: 'B14',
  title: 'Half-Orc Barbarian/Acolyte (2014)',
  edition: '2014',
  creationData: {
    name: 'Half-Orc Barbarian 2014',
    level: 1,
    edition: '2014',
    speciesSlug: 'half-orc',
    classSlug: 'barbarian',
    background: 'acolyte',
    abilities: { STR: 15, DEX: 13, CON: 14, INT: 8, WIS: 12, CHA: 10 },
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Athletics', 'Perception'],
    alignment: 'Chaotic Neutral',
    equipmentChoices: [
      {
        choiceId: 'weapon-a',
        description: 'SRD 5.1 Barbarian (a) a greataxe',
        selected: 0,
        options: [[{ name: 'Greataxe', quantity: 1, type: 'weapon' }]],
      },
      {
        choiceId: 'weapon-b',
        description: 'SRD 5.1 Barbarian (a) two handaxes',
        selected: 0,
        options: [[{ name: 'Handaxe', quantity: 2, type: 'weapon' }]],
      },
      {
        choiceId: 'fixed',
        description: "SRD 5.1 Barbarian: an explorer's pack and four javelins",
        selected: 0,
        options: [
          [
            { name: "Explorer's Pack", quantity: 1, type: 'gear' },
            { name: 'Javelin', quantity: 4, type: 'weapon' },
          ],
        ],
      },
    ],
    ...SHARED_DRAFT_TAIL,
  },
  expected: {
    // STR 15 + 2 = 17 (+3); CON 14 + 1 = 15 (+2); DEX 13 (+1); WIS 12 (+1)
    abilities: { STR: 17, DEX: 13, CON: 15, INT: 8, WIS: 12, CHA: 10 },
    hp: 14, // 12 + CON 2
    ac: 13, // Unarmored Defense: 10 + DEX 1 + CON 2
    initiative: 1,
    speed: 30,
    saves: {
      proficient: ['STR', 'CON'],
      bonuses: { STR: 5, CON: 4 }, // +3 +2; +2 +2
    },
    attacks: [{ name: 'Greataxe', attackBonus: 5, damage: '1d12+3' }],
    skills: {
      athletics: { bonus: 5 }, // STR +3 + 2
      perception: { bonus: 3 }, // WIS +1 + 2
      intimidation: { bonus: 2 }, // Menacing: CHA 0 + 2
      insight: { bonus: 3 }, // Acolyte: WIS +1 + 2
      religion: { bonus: 1 }, // Acolyte: INT -1 + 2
    },
    features: ['Rage', 'Unarmored Defense', 'Menacing', 'Relentless Endurance'],
    currency: { gp: 15 }, // Acolyte only; the Barbarian kit has no gold
  },
};

// SRD 5.2.1: Orc, Criminal (Alert; DEX/CON/INT; Sleight of Hand, Stealth;
// package A 16 gp), Barbarian package A (Greataxe, 4 Handaxes, Explorer's
// Pack, 15 gp). Alert adds Proficiency Bonus to initiative.
REFERENCE_BUILDS.B24 = {
  id: 'B24',
  title: 'Orc Barbarian/Criminal (2024)',
  edition: '2024',
  creationData: {
    name: 'Orc Barbarian 2024',
    level: 1,
    edition: '2024',
    speciesSlug: 'orc-2024',
    classSlug: 'barbarian',
    background: 'criminal-2024',
    abilities: { STR: 15, DEX: 12, CON: 14, INT: 8, WIS: 13, CHA: 10 },
    backgroundAbilityChoices: { method: '2/1', bonuses: { DEX: 2, CON: 1 } },
    originFeat: 'alert',
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Athletics', 'Perception'],
    weaponMastery: ['Greataxe', 'Handaxe'],
    alignment: 'Chaotic Neutral',
    equipmentChoices: [
      {
        choiceId: 'barbarian-kit',
        description: 'SRD 5.2.1 p28 Barbarian package A',
        selected: 0,
        options: [
          [
            { name: 'Greataxe', quantity: 1, type: 'weapon' },
            { name: 'Handaxe', quantity: 4, type: 'weapon' },
            { name: "Explorer's Pack", quantity: 1, type: 'gear' },
            { name: '15 gp', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    ...SHARED_DRAFT_TAIL,
  },
  expected: {
    // DEX 12 + 2 = 14 (+2); CON 14 + 1 = 15 (+2); STR 15 (+2); WIS 13 (+1)
    abilities: { STR: 15, DEX: 14, CON: 15, INT: 8, WIS: 13, CHA: 10 },
    hp: 14, // 12 + CON 2
    ac: 14, // Unarmored Defense: 10 + DEX 2 + CON 2
    initiative: 4, // DEX +2 + Alert (Proficiency Bonus +2)
    speed: 30,
    saves: {
      proficient: ['STR', 'CON'],
      bonuses: { STR: 4, CON: 4 },
    },
    attacks: [{ name: 'Greataxe', attackBonus: 4, damage: '1d12+2' }],
    skills: {
      athletics: { bonus: 4 }, // STR +2 + 2
      perception: { bonus: 3 }, // WIS +1 + 2
      sleight_of_hand: { bonus: 4 }, // Criminal: DEX +2 + 2
      stealth: { bonus: 4 },
    },
    features: ['Rage', 'Unarmored Defense', 'Weapon Mastery', 'Alert'],
    currency: { gp: 31 }, // Barbarian package A 15 + Criminal package A 16
  },
};

// SRD 5.1: Human (all scores +1), Acolyte (15 gp). Monk: d8, saves STR/DEX,
// Unarmored Defense 10 + DEX + WIS, Martial Arts d4.
REFERENCE_BUILDS.M14 = {
  id: 'M14',
  title: 'Human Monk/Acolyte (2014)',
  edition: '2014',
  creationData: {
    name: 'Human Monk 2014',
    level: 1,
    edition: '2014',
    speciesSlug: 'human',
    variantSlug: 'standard',
    classSlug: 'monk',
    background: 'acolyte',
    abilities: { STR: 12, DEX: 15, CON: 13, INT: 8, WIS: 14, CHA: 10 },
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Acrobatics', 'Stealth'],
    alignment: 'Lawful Neutral',
    equipmentChoices: [
      {
        choiceId: 'weapon',
        description: 'SRD 5.1 Monk (a) a shortsword',
        selected: 0,
        options: [[{ name: 'Shortsword', quantity: 1, type: 'weapon' }]],
      },
      {
        choiceId: 'pack',
        description: "SRD 5.1 Monk (b) an explorer's pack",
        selected: 0,
        options: [[{ name: "Explorer's Pack", quantity: 1, type: 'gear' }]],
      },
      {
        choiceId: 'darts',
        description: 'SRD 5.1 Monk: 10 darts',
        selected: 0,
        options: [[{ name: 'Dart', quantity: 10, type: 'weapon' }]],
      },
    ],
    ...SHARED_DRAFT_TAIL,
  },
  expected: {
    // Human +1 each: STR 13 (+1), DEX 16 (+3), CON 14 (+2), INT 9 (-1),
    // WIS 15 (+2), CHA 11 (0)
    abilities: { STR: 13, DEX: 16, CON: 14, INT: 9, WIS: 15, CHA: 11 },
    hp: 10, // 8 + CON 2
    ac: 15, // Unarmored Defense: 10 + DEX 3 + WIS 2
    initiative: 3,
    speed: 30,
    saves: {
      proficient: ['STR', 'DEX'],
      bonuses: { STR: 3, DEX: 5 }, // +1 +2; +3 +2
    },
    attacks: [{ name: 'Unarmed Strike', attackBonus: 5, damage: '1d4+3' }],
    skills: {
      acrobatics: { bonus: 5 }, // DEX +3 + 2
      stealth: { bonus: 5 },
      insight: { bonus: 4 }, // Acolyte: WIS +2 + 2
      religion: { bonus: 1 }, // Acolyte: INT -1 + 2
    },
    features: ['Unarmored Defense', 'Martial Arts'],
    currency: { gp: 15 }, // Acolyte only; the Monk kit has no gold
  },
};

// SRD 5.2.1: Dwarf (Dwarven Toughness +1 HP per level), Acolyte (Magic
// Initiate (Cleric); INT/WIS/CHA; Insight, Religion; package A 8 gp), Monk
// package A (Spear, 5 Daggers, tools, Explorer's Pack, 11 gp).
REFERENCE_BUILDS.M24 = {
  id: 'M24',
  title: 'Dwarf Monk/Acolyte (2024)',
  edition: '2024',
  creationData: {
    name: 'Dwarf Monk 2024',
    level: 1,
    edition: '2024',
    speciesSlug: 'dwarf-2024',
    classSlug: 'monk',
    background: 'acolyte-2024',
    abilities: { STR: 12, DEX: 15, CON: 13, INT: 8, WIS: 14, CHA: 10 },
    backgroundAbilityChoices: { method: '2/1', bonuses: { WIS: 2, CHA: 1 } },
    originFeat: 'magic-initiate-cleric',
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Acrobatics', 'Stealth'],
    alignment: 'Lawful Neutral',
    equipmentChoices: [
      {
        choiceId: 'monk-kit',
        description: 'SRD 5.2.1 p49 Monk package A',
        selected: 0,
        options: [
          [
            { name: 'Spear', quantity: 1, type: 'weapon' },
            { name: 'Dagger', quantity: 5, type: 'weapon' },
            { name: "Explorer's Pack", quantity: 1, type: 'gear' },
            { name: '11 gp', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    additionalCastingSources: [
      {
        id: 'feat:magic-initiate:cleric',
        sourceType: 'feat',
        sourceSlug: 'magic-initiate-cleric',
        ability: 'WIS',
        cantrips: ['guidance', 'sacred-flame'],
        knownSpells: [],
        preparedSpells: ['healing-word'],
        freeUses: 1,
        allowClassSlots: true,
      },
    ],
    ...SHARED_DRAFT_TAIL,
  },
  expected: {
    // WIS 14 + 2 = 16 (+3); CHA 10 + 1 = 11 (0); DEX 15 (+2); CON 13 (+1)
    abilities: { STR: 12, DEX: 15, CON: 13, INT: 8, WIS: 16, CHA: 11 },
    hp: 10, // 8 + CON 1 + Dwarven Toughness 1
    ac: 15, // Unarmored Defense: 10 + DEX 2 + WIS 3
    initiative: 2,
    speed: 30,
    saves: {
      proficient: ['STR', 'DEX'],
      bonuses: { STR: 3, DEX: 4 }, // +1 +2; +2 +2
    },
    attacks: [{ name: 'Unarmed Strike', attackBonus: 4, damage: '1d6+2' }],
    skills: {
      acrobatics: { bonus: 4 }, // DEX +2 + 2
      stealth: { bonus: 4 },
      insight: { bonus: 5 }, // Acolyte: WIS +3 + 2
      religion: { bonus: 1 }, // Acolyte: INT -1 + 2
    },
    spells: {
      cantripsCount: 2, // Magic Initiate (Cleric): Guidance, Sacred Flame
      knownOrBookCount: 0,
      preparedCount: 1, // Healing Word (free use once per Long Rest)
      spellAttackBonus: 5, // Magic Initiate ability WIS +3 + 2
      spellSaveDC: 13, // 8 + 3 + 2
    },
    features: ['Unarmored Defense', 'Martial Arts', 'Magic Initiate'],
    currency: { gp: 19 }, // Monk package A 11 + Acolyte package A 8
  },
};
