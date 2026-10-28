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
    | 'M24'
    | 'BD14'
    | 'BD24'
    | 'SC14'
    | 'SC24'
    | 'CL14'
    | 'CL24'
    | 'DR14'
    | 'DR24'
    | 'PL14'
    | 'PL24'
    | 'RG14'
    | 'RG24';
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

// Bard and Sorcerer references (tranche T-04 batch B). Expected values are
// calculated by hand from SRD 5.1 (Bard, Sorcerer, Hill Dwarf, Rock Gnome,
// Acolyte) and SRD 5.2.1 (Bard p31-32, Sorcerer p64-65, Halfling, Gnome,
// Soldier, Sage), never from evaluator output. Independent human review of
// these expectations remains open in the acceptance ledger.

// SRD 5.1: Hill Dwarf (CON +2, WIS +1, speed 25, +1 HP per level), Acolyte
// (Insight, Religion, 15 gp). Bard: d8, saves DEX/CHA, 2 cantrips and 4 known
// spells, two 1st-level slots, leather armor and a dagger.
REFERENCE_BUILDS.BD14 = {
  id: 'BD14',
  title: 'Hill Dwarf Bard/Acolyte (2014)',
  edition: '2014',
  creationData: {
    name: 'Dwarf Bard 2014',
    level: 1,
    edition: '2014',
    speciesSlug: 'dwarf',
    selectedLineage: 'hill-dwarf',
    classSlug: 'bard',
    background: 'acolyte',
    abilities: { STR: 8, DEX: 14, CON: 13, INT: 10, WIS: 12, CHA: 15 },
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Performance', 'Persuasion', 'Deception'],
    alignment: 'Neutral Good',
    equipmentChoices: [
      {
        choiceId: 'weapon',
        description: 'SRD 5.1 Bard (a) a rapier',
        selected: 0,
        options: [[{ name: 'Rapier', quantity: 1, type: 'weapon' }]],
      },
      {
        choiceId: 'pack',
        description: "SRD 5.1 Bard (b) an entertainer's pack",
        selected: 0,
        options: [[{ name: "Entertainer's Pack", quantity: 1, type: 'gear' }]],
      },
      {
        choiceId: 'fixed',
        description: 'SRD 5.1 Bard: a lute, leather armor and a dagger',
        selected: 0,
        options: [
          [
            { name: 'Lute', quantity: 1, type: 'gear' },
            { name: 'Leather Armor', quantity: 1, type: 'armor' },
            { name: 'Dagger', quantity: 1, type: 'weapon' },
          ],
        ],
      },
    ],
    selectedMusicalInstruments: ['Lute', 'Flute', 'Viol'],
    spellSelection: {
      selectedCantrips: ['vicious-mockery', 'minor-illusion'],
      knownSpells: [
        'cure-wounds',
        'faerie-fire',
        'healing-word',
        'thunderwave',
      ],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // CON 13 + 2 = 15 (+2); WIS 12 + 1 = 13 (+1); DEX 14 (+2); CHA 15 (+2)
    abilities: { STR: 8, DEX: 14, CON: 15, INT: 10, WIS: 13, CHA: 15 },
    hp: 11, // 8 + CON 2 + Hill Dwarf Toughness 1
    ac: 13, // Leather armor 11 + DEX 2
    initiative: 2,
    speed: 25,
    saves: {
      proficient: ['DEX', 'CHA'],
      bonuses: { DEX: 4, CHA: 4 },
    },
    attacks: [{ name: 'Rapier', attackBonus: 4, damage: '1d8+2' }],
    skills: {
      performance: { bonus: 4 }, // CHA +2 + 2
      persuasion: { bonus: 4 },
      deception: { bonus: 4 },
      insight: { bonus: 3 }, // Acolyte: WIS +1 + 2
      religion: { bonus: 2 }, // Acolyte: INT 0 + 2
    },
    spells: {
      cantripsCount: 2,
      knownOrBookCount: 4,
      preparedCount: 4,
      spellAttackBonus: 4, // CHA +2 + 2
      spellSaveDC: 12, // 8 + 2 + 2
    },
    features: ['Spellcasting', 'Bardic Inspiration (d6)', 'Dwarven Resilience'],
    currency: { gp: 15 }, // Acolyte only; the Bard kit has no gold
  },
};

// SRD 5.2.1: Halfling, Soldier (Savage Attacker; STR/DEX/CON; Athletics,
// Intimidation; package A 14 gp), Bard package A (Leather Armor, 2 Daggers,
// instrument, Entertainer's Pack, 19 gp).
REFERENCE_BUILDS.BD24 = {
  id: 'BD24',
  title: 'Halfling Bard/Soldier (2024)',
  edition: '2024',
  creationData: {
    name: 'Halfling Bard 2024',
    level: 1,
    edition: '2024',
    speciesSlug: 'halfling-2024',
    classSlug: 'bard',
    background: 'soldier-2024',
    abilities: { STR: 8, DEX: 14, CON: 13, INT: 10, WIS: 12, CHA: 15 },
    backgroundAbilityChoices: { method: '2/1', bonuses: { DEX: 2, CON: 1 } },
    originFeat: 'savage-attacker',
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Performance', 'Persuasion', 'Insight'],
    alignment: 'Chaotic Good',
    equipmentChoices: [
      {
        choiceId: 'bard-kit',
        description: 'SRD 5.2.1 p31 Bard package A',
        selected: 0,
        options: [
          [
            { name: 'Leather Armor', quantity: 1, type: 'armor' },
            { name: 'Dagger', quantity: 2, type: 'weapon' },
            { name: 'Lute', quantity: 1, type: 'gear' },
            { name: "Entertainer's Pack", quantity: 1, type: 'gear' },
            { name: '19 gp', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    selectedMusicalInstruments: ['Lute', 'Flute', 'Viol'],
    spellSelection: {
      selectedCantrips: ['vicious-mockery', 'minor-illusion'],
      knownSpells: [],
      preparedSpells: [
        'healing-word',
        'dissonant-whispers',
        'faerie-fire',
        'heroism',
      ],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // DEX 14 + 2 = 16 (+3); CON 13 + 1 = 14 (+2); CHA 15 (+2); STR 8 (-1)
    abilities: { STR: 8, DEX: 16, CON: 14, INT: 10, WIS: 12, CHA: 15 },
    hp: 10, // 8 + CON 2
    ac: 14, // Leather armor 11 + DEX 3
    initiative: 3,
    speed: 30,
    saves: {
      proficient: ['DEX', 'CHA'],
      bonuses: { DEX: 5, CHA: 4 },
    },
    attacks: [{ name: 'Dagger', attackBonus: 5, damage: '1d4+3' }],
    skills: {
      performance: { bonus: 4 },
      persuasion: { bonus: 4 },
      insight: { bonus: 3 }, // WIS +1 + 2
      athletics: { bonus: 1 }, // Soldier: STR -1 + 2
      intimidation: { bonus: 4 }, // Soldier: CHA +2 + 2
    },
    spells: {
      cantripsCount: 2,
      knownOrBookCount: 0,
      preparedCount: 4,
      spellAttackBonus: 4,
      spellSaveDC: 12,
    },
    features: ['Spellcasting', 'Bardic Inspiration', 'Savage Attacker', 'Luck'],
    currency: { gp: 33 }, // Bard package A 19 + Soldier package A 14
  },
};

// SRD 5.1: Rock Gnome (INT +2, CON +1, speed 25), Acolyte (15 gp), Draconic
// Bloodline (+1 HP per level, unarmored AC 13 + DEX). Sorcerer: d6, saves
// CON/CHA, 4 cantrips and 2 known spells, two 1st-level slots.
REFERENCE_BUILDS.SC14 = {
  id: 'SC14',
  title: 'Rock Gnome Draconic Sorcerer/Acolyte (2014)',
  edition: '2014',
  creationData: {
    name: 'Gnome Sorcerer 2014',
    level: 1,
    edition: '2014',
    speciesSlug: 'gnome',
    selectedLineage: 'rock-gnome',
    classSlug: 'sorcerer',
    subclassSlug: 'draconic',
    background: 'acolyte',
    abilities: { STR: 8, DEX: 13, CON: 14, INT: 10, WIS: 12, CHA: 15 },
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Arcana', 'Persuasion'],
    alignment: 'Chaotic Neutral',
    equipmentChoices: [
      {
        choiceId: 'weapon',
        description: 'SRD 5.1 Sorcerer (a) a light crossbow and 20 bolts',
        selected: 0,
        options: [
          [
            { name: 'Crossbow, Light', quantity: 1, type: 'weapon' },
            { name: 'Crossbow Bolt', quantity: 20, type: 'gear' },
          ],
        ],
      },
      {
        choiceId: 'focus',
        description: 'SRD 5.1 Sorcerer (a) a component pouch',
        selected: 0,
        options: [[{ name: 'Component Pouch', quantity: 1, type: 'gear' }]],
      },
      {
        choiceId: 'pack',
        description: "SRD 5.1 Sorcerer (a) a dungeoneer's pack",
        selected: 0,
        options: [[{ name: "Dungeoneer's Pack", quantity: 1, type: 'gear' }]],
      },
      {
        choiceId: 'fixed',
        description: 'SRD 5.1 Sorcerer: two daggers',
        selected: 0,
        options: [[{ name: 'Dagger', quantity: 2, type: 'weapon' }]],
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: {
      selectedCantrips: ['fire-bolt', 'light', 'mage-hand', 'prestidigitation'],
      knownSpells: ['shield', 'magic-missile'],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // INT 10 + 2 = 12 (+1); CON 14 + 1 = 15 (+2); CHA 15 (+2); DEX 13 (+1)
    abilities: { STR: 8, DEX: 13, CON: 15, INT: 12, WIS: 12, CHA: 15 },
    hp: 9, // 6 + CON 2 + Draconic Resilience 1
    ac: 14, // Draconic Resilience: 13 + DEX 1
    initiative: 1,
    speed: 25,
    saves: {
      proficient: ['CON', 'CHA'],
      bonuses: { CON: 4, CHA: 4 },
    },
    attacks: [{ name: 'Light Crossbow', attackBonus: 3, damage: '1d8+1' }],
    skills: {
      arcana: { bonus: 3 }, // INT +1 + 2
      persuasion: { bonus: 4 }, // CHA +2 + 2
      insight: { bonus: 3 }, // Acolyte: WIS +1 + 2
      religion: { bonus: 3 }, // Acolyte: INT +1 + 2
    },
    spells: {
      cantripsCount: 4,
      knownOrBookCount: 2,
      preparedCount: 2,
      spellAttackBonus: 4,
      spellSaveDC: 12,
    },
    features: ['Spellcasting', 'Draconic Resilience', 'Gnome Cunning'],
    currency: { gp: 15 }, // Acolyte only; the Sorcerer kit has no gold
  },
};

// SRD 5.2.1: Gnome (Forest Gnome lineage: Minor Illusion and Speak with
// Animals, CHA casting), Sage (Magic Initiate (Wizard); CON/INT/WIS;
// Arcana, History; package A 8 gp), Sorcerer package A (Spear, 2 Daggers,
// Arcane Focus, Dungeoneer's Pack, 28 gp). Innate Sorcery: 2 uses.
REFERENCE_BUILDS.SC24 = {
  id: 'SC24',
  title: 'Forest Gnome Sorcerer/Sage (2024)',
  edition: '2024',
  creationData: {
    name: 'Gnome Sorcerer 2024',
    level: 1,
    edition: '2024',
    speciesSlug: 'gnome-2024',
    selectedLineage: 'forest-gnome',
    classSlug: 'sorcerer',
    background: 'sage-2024',
    abilities: { STR: 8, DEX: 13, CON: 14, INT: 10, WIS: 12, CHA: 15 },
    backgroundAbilityChoices: { method: '2/1', bonuses: { CON: 2, INT: 1 } },
    originFeat: 'magic-initiate-wizard',
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Deception', 'Persuasion'],
    alignment: 'Chaotic Good',
    equipmentChoices: [
      {
        choiceId: 'sorcerer-kit',
        description: 'SRD 5.2.1 p64 Sorcerer package A',
        selected: 0,
        options: [
          [
            { name: 'Spear', quantity: 1, type: 'weapon' },
            { name: 'Dagger', quantity: 2, type: 'weapon' },
            { name: 'Crystal', quantity: 1, type: 'gear' },
            { name: "Dungeoneer's Pack", quantity: 1, type: 'gear' },
            { name: '28 gp', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    additionalCastingSources: [
      {
        id: 'species:gnome:forest',
        sourceType: 'species',
        sourceSlug: 'forest-gnome',
        ability: 'CHA',
        cantrips: ['minor-illusion'],
        knownSpells: [],
        preparedSpells: ['speak-with-animals'],
        freeUses: 2,
        allowClassSlots: true,
      },
      {
        id: 'feat:magic-initiate:wizard',
        sourceType: 'feat',
        sourceSlug: 'magic-initiate-wizard',
        ability: 'CHA',
        cantrips: ['mage-hand', 'ray-of-frost'],
        knownSpells: [],
        preparedSpells: ['shield'],
        freeUses: 1,
        allowClassSlots: true,
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: {
      selectedCantrips: [
        'light',
        'prestidigitation',
        'shocking-grasp',
        'sorcerous-burst',
      ],
      knownSpells: [],
      preparedSpells: ['burning-hands', 'detect-magic'],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // CON 14 + 2 = 16 (+3); INT 10 + 1 = 11 (0); CHA 15 (+2); DEX 13 (+1)
    abilities: { STR: 8, DEX: 13, CON: 16, INT: 11, WIS: 12, CHA: 15 },
    hp: 9, // 6 + CON 3
    ac: 11, // Unarmored 10 + DEX 1
    initiative: 1,
    speed: 30,
    saves: {
      proficient: ['CON', 'CHA'],
      bonuses: { CON: 5, CHA: 4 },
    },
    attacks: [{ name: 'Spear', attackBonus: 1, damage: '1d6-1' }],
    skills: {
      deception: { bonus: 4 }, // CHA +2 + 2
      persuasion: { bonus: 4 },
      arcana: { bonus: 2 }, // Sage: INT 0 + 2
      history: { bonus: 2 },
    },
    spells: {
      cantripsCount: 4, // class cantrips; feat and lineage cantrips are separate
      knownOrBookCount: 0,
      preparedCount: 2,
      spellAttackBonus: 4,
      spellSaveDC: 12,
    },
    features: [
      'Spellcasting',
      'Innate Sorcery',
      'Magic Initiate',
      'Gnomish Lineage',
    ],
    currency: { gp: 36 }, // Sorcerer package A 28 + Sage package A 8
  },
};

// Cleric and Druid references (tranche T-04 batch C). Expected values are
// calculated by hand from SRD 5.1 (Cleric, Druid, Human, Wood Elf, Acolyte)
// and SRD 5.2.1 (Cleric p41-43, Druid p53-54, Human, Elf, Sage, Acolyte),
// never from evaluator output. Independent human review of these expectations
// remains open in the acceptance ledger.

// SRD 5.1: Human (+1 all), Acolyte (Insight, Religion, 15 gp), Cleric (d8,
// saves WIS/CHA, Life Domain heavy armor). Prepared spells = WIS modifier + 1.
REFERENCE_BUILDS.CL14 = {
  id: 'CL14',
  title: 'Human Life Cleric/Acolyte (2014)',
  edition: '2014',
  creationData: {
    name: 'Human Cleric 2014',
    level: 1,
    edition: '2014',
    speciesSlug: 'human',
    variantSlug: 'standard',
    classSlug: 'cleric',
    subclassSlug: 'life',
    background: 'acolyte',
    abilities: { STR: 13, DEX: 10, CON: 14, INT: 8, WIS: 15, CHA: 12 },
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['History', 'Medicine'],
    alignment: 'Lawful Good',
    equipmentChoices: [
      {
        choiceId: 'weapon',
        description: 'SRD 5.1 Cleric (a) a mace',
        selected: 0,
        options: [[{ name: 'Mace', quantity: 1, type: 'weapon' }]],
      },
      {
        choiceId: 'armor',
        description: 'SRD 5.1 Cleric (c) chain mail (Life Domain heavy armor)',
        selected: 0,
        options: [[{ name: 'Chain Mail', quantity: 1, type: 'armor' }]],
      },
      {
        choiceId: 'ranged',
        description: 'SRD 5.1 Cleric (a) a light crossbow and 20 bolts',
        selected: 0,
        options: [
          [
            { name: 'Crossbow, Light', quantity: 1, type: 'weapon' },
            { name: 'Crossbow Bolt', quantity: 20, type: 'gear' },
          ],
        ],
      },
      {
        choiceId: 'pack',
        description: "SRD 5.1 Cleric (a) a priest's pack",
        selected: 0,
        options: [[{ name: "Priest's Pack", quantity: 1, type: 'gear' }]],
      },
      {
        choiceId: 'fixed',
        description: 'SRD 5.1 Cleric: a shield and a holy symbol',
        selected: 0,
        options: [
          [
            { name: 'Shield', quantity: 1, type: 'armor' },
            { name: 'Holy Symbol', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: {
      selectedCantrips: ['guidance', 'light', 'sacred-flame'],
      knownSpells: [],
      preparedSpells: [
        'healing-word',
        'guiding-bolt',
        'shield-of-faith',
        'sanctuary',
      ],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // Human +1: WIS 16 (+3), CON 15 (+2), STR 14 (+2), CHA 13 (+1),
    // DEX 11 (0), INT 9 (-1)
    abilities: { STR: 14, DEX: 11, CON: 15, INT: 9, WIS: 16, CHA: 13 },
    hp: 10, // 8 + CON 2
    ac: 18, // Chain mail 16 (no DEX) + shield 2
    initiative: 0,
    speed: 30,
    saves: {
      proficient: ['WIS', 'CHA'],
      bonuses: { WIS: 5, CHA: 3 },
    },
    attacks: [{ name: 'Mace', attackBonus: 4, damage: '1d6+2' }],
    skills: {
      history: { bonus: 1 }, // INT -1 + 2
      medicine: { bonus: 5 }, // WIS +3 + 2
      insight: { bonus: 5 }, // Acolyte: WIS +3 + 2
      religion: { bonus: 1 }, // Acolyte: INT -1 + 2
    },
    spells: {
      cantripsCount: 3,
      knownOrBookCount: 0,
      preparedCount: 4, // WIS +3 + level 1; Life domain spells do not count
      spellAttackBonus: 5,
      spellSaveDC: 13,
    },
    features: ['Spellcasting', 'Divine Domain: Life', 'Disciple of Life'],
    currency: { gp: 15 }, // Acolyte only; the Cleric kit has no gold
  },
};

// SRD 5.2.1: Human (Skillful Perception, Versatile Tough), Sage (Magic
// Initiate (Wizard); CON/INT/WIS; Arcana, History; package A 8 gp), Cleric
// package A (Chain Shirt, Shield, Mace, Holy Symbol, Priest's Pack, 7 gp).
// Thaumaturge: one extra cantrip and a Wisdom-based bonus to Arcana/Religion.
REFERENCE_BUILDS.CL24 = {
  id: 'CL24',
  title: 'Human Thaumaturge Cleric/Sage (2024)',
  edition: '2024',
  creationData: {
    name: 'Human Cleric 2024',
    level: 1,
    edition: '2024',
    speciesSlug: 'human-2024',
    speciesSkillProficiency: 'Perception',
    humanOriginFeat: 'tough',
    classSlug: 'cleric',
    divineOrder: 'thaumaturge',
    background: 'sage-2024',
    abilities: { STR: 13, DEX: 10, CON: 14, INT: 8, WIS: 15, CHA: 12 },
    backgroundAbilityChoices: { method: '2/1', bonuses: { WIS: 2, CON: 1 } },
    originFeat: 'magic-initiate-wizard',
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Medicine', 'Persuasion'],
    alignment: 'Neutral Good',
    equipmentChoices: [
      {
        choiceId: 'cleric-kit',
        description: 'SRD 5.2.1 p41 Cleric package A',
        selected: 0,
        options: [
          [
            { name: 'Chain Shirt', quantity: 1, type: 'armor' },
            { name: 'Shield', quantity: 1, type: 'armor' },
            { name: 'Mace', quantity: 1, type: 'weapon' },
            { name: 'Holy Symbol', quantity: 1, type: 'gear' },
            { name: "Priest's Pack", quantity: 1, type: 'gear' },
            { name: '7 gp', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    additionalCastingSources: [
      {
        id: 'feat:magic-initiate:wizard',
        sourceType: 'feat',
        sourceSlug: 'magic-initiate-wizard',
        ability: 'INT',
        cantrips: ['mage-hand', 'fire-bolt'],
        knownSpells: [],
        preparedSpells: ['shield'],
        freeUses: 1,
        allowClassSlots: true,
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: {
      selectedCantrips: ['guidance', 'light', 'sacred-flame', 'thaumaturgy'],
      knownSpells: [],
      preparedSpells: ['bless', 'cure-wounds', 'guiding-bolt', 'healing-word'],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // WIS 15 + 2 = 17 (+3); CON 14 + 1 = 15 (+2); STR 13 (+1); CHA 12 (+1)
    abilities: { STR: 13, DEX: 10, CON: 15, INT: 8, WIS: 17, CHA: 12 },
    hp: 12, // 8 + CON 2 + Tough 2
    ac: 15, // Chain shirt 13 (DEX 0) + shield 2
    initiative: 0,
    speed: 30,
    saves: {
      proficient: ['WIS', 'CHA'],
      bonuses: { WIS: 5, CHA: 3 },
    },
    attacks: [{ name: 'Mace', attackBonus: 3, damage: '1d6+1' }],
    skills: {
      medicine: { bonus: 5 }, // WIS +3 + 2
      persuasion: { bonus: 3 }, // CHA +1 + 2
      perception: { bonus: 5 }, // Human Skillful: WIS +3 + 2
      arcana: { bonus: 4 }, // Sage: INT -1 + 2, plus Thaumaturge WIS +3
      history: { bonus: 1 }, // Sage: INT -1 + 2
      religion: { bonus: 2 }, // Thaumaturge only: INT -1 + WIS +3
    },
    spells: {
      cantripsCount: 4, // three class cantrips plus the Thaumaturge cantrip
      knownOrBookCount: 0,
      preparedCount: 4,
      spellAttackBonus: 5, // WIS +3 + 2
      spellSaveDC: 13,
    },
    features: ['Spellcasting', 'Divine Order: Thaumaturge', 'Magic Initiate'],
    currency: { gp: 15 }, // Cleric package A 7 + Sage package A 8
  },
};

// SRD 5.1: Wood Elf (DEX +2, WIS +1, speed 35, Keen Senses), Acolyte (15
// gp), Druid (d8, saves INT/WIS, Druidic). Prepared spells = WIS modifier + 1.
REFERENCE_BUILDS.DR14 = {
  id: 'DR14',
  title: 'Wood Elf Druid/Acolyte (2014)',
  edition: '2014',
  creationData: {
    name: 'Elf Druid 2014',
    level: 1,
    edition: '2014',
    speciesSlug: 'elf',
    selectedLineage: 'wood-elf',
    classSlug: 'druid',
    background: 'acolyte',
    abilities: { STR: 8, DEX: 13, CON: 14, INT: 12, WIS: 15, CHA: 10 },
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Nature', 'Survival'],
    alignment: 'Neutral',
    equipmentChoices: [
      {
        choiceId: 'shield',
        description: 'SRD 5.1 Druid (a) a wooden shield',
        selected: 0,
        options: [[{ name: 'Shield', quantity: 1, type: 'armor' }]],
      },
      {
        choiceId: 'weapon',
        description: 'SRD 5.1 Druid (a) a scimitar',
        selected: 0,
        options: [[{ name: 'Scimitar', quantity: 1, type: 'weapon' }]],
      },
      {
        choiceId: 'fixed',
        description:
          "SRD 5.1 Druid: leather armor, an explorer's pack and a druidic focus",
        selected: 0,
        options: [
          [
            { name: 'Leather Armor', quantity: 1, type: 'armor' },
            { name: "Explorer's Pack", quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: {
      selectedCantrips: ['druidcraft', 'shillelagh'],
      knownSpells: [],
      preparedSpells: [
        'cure-wounds',
        'entangle',
        'faerie-fire',
        'healing-word',
      ],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // DEX 13 + 2 = 15 (+2); WIS 15 + 1 = 16 (+3); CON 14 (+2); INT 12 (+1)
    abilities: { STR: 8, DEX: 15, CON: 14, INT: 12, WIS: 16, CHA: 10 },
    hp: 10, // 8 + CON 2
    ac: 15, // Leather armor 11 + DEX 2 + shield 2
    initiative: 2,
    speed: 35,
    saves: {
      proficient: ['INT', 'WIS'],
      bonuses: { INT: 3, WIS: 5 },
    },
    attacks: [{ name: 'Scimitar', attackBonus: 4, damage: '1d6+2' }],
    skills: {
      nature: { bonus: 3 }, // INT +1 + 2
      survival: { bonus: 5 }, // WIS +3 + 2
      perception: { bonus: 5 }, // Elf Keen Senses: WIS +3 + 2
      insight: { bonus: 5 }, // Acolyte: WIS +3 + 2
      religion: { bonus: 3 }, // Acolyte: INT +1 + 2
    },
    spells: {
      cantripsCount: 2,
      knownOrBookCount: 0,
      preparedCount: 4, // WIS +3 + level 1
      spellAttackBonus: 5,
      spellSaveDC: 13,
    },
    features: ['Spellcasting', 'Druidic', 'Fleet of Foot', 'Mask of the Wild'],
    currency: { gp: 15 }, // Acolyte only; the Druid kit has no gold
  },
};

// SRD 5.2.1: Elf (Drow lineage: Dancing Lights, WIS casting), Acolyte (Magic
// Initiate (Cleric); INT/WIS/CHA; Insight, Religion; package A 8 gp), Druid
// package A (Leather Armor, Shield, Sickle, Druidic Focus, Explorer's Pack,
// Herbalism Kit, 9 gp). Magician: one extra cantrip plus a Wisdom bonus to
// Arcana/Nature.
REFERENCE_BUILDS.DR24 = {
  id: 'DR24',
  title: 'Drow Magician Druid/Acolyte (2024)',
  edition: '2024',
  creationData: {
    name: 'Elf Druid 2024',
    level: 1,
    edition: '2024',
    speciesSlug: 'elf-2024',
    selectedLineage: 'drow',
    speciesSkillProficiency: 'Survival',
    classSlug: 'druid',
    primalOrder: 'magician',
    background: 'acolyte-2024',
    abilities: { STR: 8, DEX: 13, CON: 14, INT: 12, WIS: 15, CHA: 10 },
    backgroundAbilityChoices: { method: '2/1', bonuses: { WIS: 2, INT: 1 } },
    originFeat: 'magic-initiate-cleric',
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Nature', 'Perception'],
    alignment: 'Neutral',
    equipmentChoices: [
      {
        choiceId: 'druid-kit',
        description: 'SRD 5.2.1 p53 Druid package A',
        selected: 0,
        options: [
          [
            { name: 'Leather Armor', quantity: 1, type: 'armor' },
            { name: 'Shield', quantity: 1, type: 'armor' },
            { name: 'Sickle', quantity: 1, type: 'weapon' },
            { name: 'Quarterstaff', quantity: 1, type: 'weapon' },
            { name: "Explorer's Pack", quantity: 1, type: 'gear' },
            { name: 'Herbalism Kit', quantity: 1, type: 'gear' },
            { name: '9 gp', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    additionalCastingSources: [
      {
        id: 'species:elf:drow',
        sourceType: 'species',
        sourceSlug: 'drow',
        ability: 'WIS',
        cantrips: ['dancing-lights'],
        knownSpells: [],
        preparedSpells: [],
        freeUses: 1,
        allowClassSlots: true,
      },
      {
        id: 'feat:magic-initiate:cleric',
        sourceType: 'feat',
        sourceSlug: 'magic-initiate-cleric',
        ability: 'WIS',
        cantrips: ['guidance', 'sacred-flame'],
        knownSpells: [],
        preparedSpells: ['cure-wounds'],
        freeUses: 1,
        allowClassSlots: true,
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: {
      selectedCantrips: ['druidcraft', 'shillelagh', 'produce-flame'],
      knownSpells: [],
      preparedSpells: [
        'cure-wounds',
        'entangle',
        'faerie-fire',
        'healing-word',
      ],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // WIS 15 + 2 = 17 (+3); INT 12 + 1 = 13 (+1); CON 14 (+2); DEX 13 (+1)
    abilities: { STR: 8, DEX: 13, CON: 14, INT: 13, WIS: 17, CHA: 10 },
    hp: 10, // 8 + CON 2
    ac: 14, // Leather armor 11 + DEX 1 + shield 2
    initiative: 1,
    speed: 30,
    saves: {
      proficient: ['INT', 'WIS'],
      bonuses: { INT: 3, WIS: 5 },
    },
    attacks: [{ name: 'Sickle', attackBonus: 1, damage: '1d4-1' }],
    skills: {
      nature: { bonus: 6 }, // INT +1 + 2, plus Magician WIS +3
      perception: { bonus: 5 }, // WIS +3 + 2
      survival: { bonus: 5 }, // Elf Keen Senses: WIS +3 + 2
      insight: { bonus: 5 }, // Acolyte: WIS +3 + 2
      religion: { bonus: 3 }, // Acolyte: INT +1 + 2
      arcana: { bonus: 4 }, // Magician only: INT +1 + WIS +3
    },
    spells: {
      cantripsCount: 3, // two class cantrips plus the Magician cantrip
      knownOrBookCount: 0,
      preparedCount: 4,
      spellAttackBonus: 5,
      spellSaveDC: 13,
    },
    features: ['Spellcasting', 'Druidic', 'Primal Order: Magician', 'Drow'],
    currency: { gp: 17 }, // Druid package A 9 + Acolyte package A 8
  },
};

// Paladin and Ranger references (tranche T-04 batch D). Expected values are
// calculated by hand from SRD 5.1 (Paladin, Ranger, Half-Orc, Human, Acolyte)
// and SRD 5.2.1 (Paladin p48, Ranger p57, Human, Elf, Soldier, Criminal),
// never from evaluator output. Spellcasting begins at level 1 in SRD 5.2.1 and
// at level 2 in SRD 5.1. Independent human review of these expectations
// remains open in the acceptance ledger.

// SRD 5.1: Half-Orc (STR +2, CON +1, Menacing), Acolyte (Insight, Religion,
// 15 gp), Paladin (d10, saves WIS/CHA, all armor, Divine Sense, Lay on Hands).
REFERENCE_BUILDS.PL14 = {
  id: 'PL14',
  title: 'Half-Orc Paladin/Acolyte (2014)',
  edition: '2014',
  creationData: {
    name: 'Half-Orc Paladin 2014',
    level: 1,
    edition: '2014',
    speciesSlug: 'half-orc',
    classSlug: 'paladin',
    background: 'acolyte',
    abilities: { STR: 15, DEX: 10, CON: 13, INT: 8, WIS: 12, CHA: 14 },
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Athletics', 'Persuasion'],
    alignment: 'Lawful Good',
    equipmentChoices: [
      {
        choiceId: 'weapons',
        description: 'SRD 5.1 Paladin (a) a martial weapon and a shield',
        selected: 0,
        options: [
          [
            { name: 'Longsword', quantity: 1, type: 'weapon' },
            { name: 'Shield', quantity: 1, type: 'armor' },
          ],
        ],
      },
      {
        choiceId: 'ranged',
        description: 'SRD 5.1 Paladin (a) five javelins',
        selected: 0,
        options: [[{ name: 'Javelin', quantity: 5, type: 'weapon' }]],
      },
      {
        choiceId: 'pack',
        description: "SRD 5.1 Paladin (a) a priest's pack",
        selected: 0,
        options: [[{ name: "Priest's Pack", quantity: 1, type: 'gear' }]],
      },
      {
        choiceId: 'fixed',
        description: 'SRD 5.1 Paladin: chain mail and a holy symbol',
        selected: 0,
        options: [
          [
            { name: 'Chain Mail', quantity: 1, type: 'armor' },
            { name: 'Holy Symbol', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: { selectedCantrips: [], knownSpells: [] },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // Half-Orc: STR 15 + 2 = 17 (+3); CON 13 + 1 = 14 (+2); CHA 14 (+2)
    abilities: { STR: 17, DEX: 10, CON: 14, INT: 8, WIS: 12, CHA: 14 },
    hp: 12, // 10 + CON 2
    ac: 18, // Chain mail 16 + shield 2
    initiative: 0,
    speed: 30,
    saves: {
      proficient: ['WIS', 'CHA'],
      bonuses: { WIS: 3, CHA: 4 },
    },
    attacks: [{ name: 'Longsword', attackBonus: 5, damage: '1d8+3' }],
    skills: {
      athletics: { bonus: 5 }, // STR +3 + 2
      persuasion: { bonus: 4 }, // CHA +2 + 2
      intimidation: { bonus: 4 }, // Menacing: CHA +2 + 2
      insight: { bonus: 3 }, // Acolyte: WIS +1 + 2
      religion: { bonus: 1 }, // Acolyte: INT -1 + 2
    },
    features: [
      'Divine Sense',
      'Lay on Hands',
      'Menacing',
      'Relentless Endurance',
    ],
    currency: { gp: 15 }, // Acolyte only; the Paladin kit has no gold
  },
};

// SRD 5.2.1: Human (Skillful Perception, Versatile Tough), Soldier (Savage
// Attacker; STR/DEX/CON; Athletics, Intimidation; package A 14 gp), Paladin
// package A (Chain Mail, Shield, Longsword, 6 Javelins, Holy Symbol, Priest's
// Pack, 9 gp). Level 1 adds Lay On Hands, Spellcasting and Weapon Mastery.
REFERENCE_BUILDS.PL24 = {
  id: 'PL24',
  title: 'Human Paladin/Soldier (2024)',
  edition: '2024',
  creationData: {
    name: 'Human Paladin 2024',
    level: 1,
    edition: '2024',
    speciesSlug: 'human-2024',
    speciesSkillProficiency: 'Perception',
    humanOriginFeat: 'tough',
    classSlug: 'paladin',
    background: 'soldier-2024',
    abilities: { STR: 15, DEX: 10, CON: 13, INT: 8, WIS: 12, CHA: 14 },
    backgroundAbilityChoices: { method: '2/1', bonuses: { STR: 2, CON: 1 } },
    originFeat: 'savage-attacker',
    weaponMastery: ['Longsword', 'Javelin'],
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Persuasion', 'Religion'],
    alignment: 'Lawful Good',
    equipmentChoices: [
      {
        choiceId: 'paladin-kit',
        description: 'SRD 5.2.1 p48 Paladin package A',
        selected: 0,
        options: [
          [
            { name: 'Chain Mail', quantity: 1, type: 'armor' },
            { name: 'Shield', quantity: 1, type: 'armor' },
            { name: 'Longsword', quantity: 1, type: 'weapon' },
            { name: 'Javelin', quantity: 6, type: 'weapon' },
            { name: 'Holy Symbol', quantity: 1, type: 'gear' },
            { name: "Priest's Pack", quantity: 1, type: 'gear' },
            { name: '9 gp', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: {
      selectedCantrips: [],
      knownSpells: [],
      preparedSpells: ['bless', 'cure-wounds'],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // STR 15 + 2 = 17 (+3); CON 13 + 1 = 14 (+2); CHA 14 (+2); WIS 12 (+1)
    abilities: { STR: 17, DEX: 10, CON: 14, INT: 8, WIS: 12, CHA: 14 },
    hp: 14, // 10 + CON 2 + Tough 2
    ac: 18, // Chain mail 16 + shield 2
    initiative: 0,
    speed: 30,
    saves: {
      proficient: ['WIS', 'CHA'],
      bonuses: { WIS: 3, CHA: 4 },
    },
    attacks: [{ name: 'Longsword', attackBonus: 5, damage: '1d8+3' }],
    skills: {
      persuasion: { bonus: 4 }, // CHA +2 + 2
      religion: { bonus: 1 }, // INT -1 + 2
      athletics: { bonus: 5 }, // Soldier: STR +3 + 2
      intimidation: { bonus: 4 }, // Soldier: CHA +2 + 2
      perception: { bonus: 3 }, // Human Skillful: WIS +1 + 2
    },
    spells: {
      cantripsCount: 0,
      knownOrBookCount: 0,
      preparedCount: 2,
      spellAttackBonus: 4, // CHA +2 + 2
      spellSaveDC: 12,
    },
    features: [
      'Lay On Hands',
      'Spellcasting',
      'Weapon Mastery',
      'Savage Attacker',
    ],
    currency: { gp: 23 }, // Paladin package A 9 + Soldier package A 14
  },
};

// SRD 5.1: Human (+1 all), Acolyte (15 gp), Ranger (d10, saves STR/DEX, three
// skills, leather armor, Favored Enemy and Natural Explorer). No spellcasting
// until level 2.
REFERENCE_BUILDS.RG14 = {
  id: 'RG14',
  title: 'Human Ranger/Acolyte (2014)',
  edition: '2014',
  creationData: {
    name: 'Human Ranger 2014',
    level: 1,
    edition: '2014',
    speciesSlug: 'human',
    variantSlug: 'standard',
    classSlug: 'ranger',
    background: 'acolyte',
    abilities: { STR: 12, DEX: 15, CON: 13, INT: 10, WIS: 14, CHA: 8 },
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Perception', 'Stealth', 'Survival'],
    alignment: 'Neutral Good',
    equipmentChoices: [
      {
        choiceId: 'armor',
        description: 'SRD 5.1 Ranger (b) leather armor',
        selected: 0,
        options: [[{ name: 'Leather Armor', quantity: 1, type: 'armor' }]],
      },
      {
        choiceId: 'weapons',
        description: 'SRD 5.1 Ranger (a) two shortswords',
        selected: 0,
        options: [[{ name: 'Shortsword', quantity: 2, type: 'weapon' }]],
      },
      {
        choiceId: 'pack',
        description: "SRD 5.1 Ranger (b) an explorer's pack",
        selected: 0,
        options: [[{ name: "Explorer's Pack", quantity: 1, type: 'gear' }]],
      },
      {
        choiceId: 'fixed',
        description: 'SRD 5.1 Ranger: a longbow and a quiver of 20 arrows',
        selected: 0,
        options: [
          [
            { name: 'Longbow', quantity: 1, type: 'weapon' },
            { name: 'Arrow', quantity: 20, type: 'gear' },
            { name: 'Quiver', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: { selectedCantrips: [], knownSpells: [] },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // Human +1: DEX 16 (+3), WIS 15 (+2), CON 14 (+2), STR 13 (+1),
    // INT 11 (0), CHA 9 (-1)
    abilities: { STR: 13, DEX: 16, CON: 14, INT: 11, WIS: 15, CHA: 9 },
    hp: 12, // 10 + CON 2
    ac: 14, // Leather armor 11 + DEX 3
    initiative: 3,
    speed: 30,
    saves: {
      proficient: ['STR', 'DEX'],
      bonuses: { STR: 3, DEX: 5 },
    },
    attacks: [{ name: 'Longbow', attackBonus: 5, damage: '1d8+3' }],
    skills: {
      perception: { bonus: 4 }, // WIS +2 + 2
      stealth: { bonus: 5 }, // DEX +3 + 2
      survival: { bonus: 4 },
      insight: { bonus: 4 }, // Acolyte: WIS +2 + 2
      religion: { bonus: 2 }, // Acolyte: INT 0 + 2
    },
    features: ['Favored Enemy', 'Natural Explorer'],
    currency: { gp: 15 }, // Acolyte only; the Ranger kit has no gold
  },
};

// SRD 5.2.1: Elf (Wood Elf lineage: speed 35, Druidcraft; Keen Senses), Criminal
// (Alert; DEX/CON/INT; Sleight of Hand, Stealth; package A 16 gp), Ranger
// package A (Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows,
// Quiver, Druidic Focus, Explorer's Pack, 7 gp). Favored Enemy: Hunter's Mark
// always prepared with two free casts.
REFERENCE_BUILDS.RG24 = {
  id: 'RG24',
  title: 'Wood Elf Ranger/Criminal (2024)',
  edition: '2024',
  creationData: {
    name: 'Elf Ranger 2024',
    level: 1,
    edition: '2024',
    speciesSlug: 'elf-2024',
    selectedLineage: 'wood-elf',
    speciesSkillProficiency: 'Perception',
    classSlug: 'ranger',
    background: 'criminal-2024',
    abilities: { STR: 12, DEX: 15, CON: 13, INT: 10, WIS: 14, CHA: 8 },
    backgroundAbilityChoices: { method: '2/1', bonuses: { DEX: 2, CON: 1 } },
    originFeat: 'alert',
    weaponMastery: ['Longbow', 'Scimitar'],
    abilityScoreMethod: 'standard-array',
    selectedSkills: ['Survival', 'Nature', 'Insight'],
    alignment: 'Neutral Good',
    equipmentChoices: [
      {
        choiceId: 'ranger-kit',
        description: 'SRD 5.2.1 p57 Ranger package A',
        selected: 0,
        options: [
          [
            { name: 'Studded Leather Armor', quantity: 1, type: 'armor' },
            { name: 'Scimitar', quantity: 1, type: 'weapon' },
            { name: 'Shortsword', quantity: 1, type: 'weapon' },
            { name: 'Longbow', quantity: 1, type: 'weapon' },
            { name: 'Arrow', quantity: 20, type: 'gear' },
            { name: 'Quiver', quantity: 1, type: 'gear' },
            { name: "Explorer's Pack", quantity: 1, type: 'gear' },
            { name: '7 gp', quantity: 1, type: 'gear' },
          ],
        ],
      },
    ],
    additionalCastingSources: [
      {
        id: 'species:elf:wood-elf',
        sourceType: 'species',
        sourceSlug: 'wood-elf',
        ability: 'WIS',
        cantrips: ['druidcraft'],
        knownSpells: [],
        preparedSpells: [],
        freeUses: 1,
        allowClassSlots: true,
      },
    ],
    selectedMusicalInstruments: [],
    spellSelection: {
      selectedCantrips: [],
      knownSpells: [],
      preparedSpells: ['cure-wounds', 'goodberry'],
    },
    hpCalculationMethod: 'max',
    personality: '',
    ideals: '',
    bonds: '',
    flaws: '',
  },
  expected: {
    // DEX 15 + 2 = 17 (+3); CON 13 + 1 = 14 (+2); WIS 14 (+2); STR 12 (+1)
    abilities: { STR: 12, DEX: 17, CON: 14, INT: 10, WIS: 14, CHA: 8 },
    hp: 12, // 10 + CON 2
    ac: 15, // Studded leather 12 + DEX 3
    initiative: 5, // DEX +3 + Alert (Proficiency Bonus +2)
    speed: 35,
    saves: {
      proficient: ['STR', 'DEX'],
      bonuses: { STR: 3, DEX: 5 },
    },
    attacks: [{ name: 'Longbow', attackBonus: 5, damage: '1d8+3' }],
    skills: {
      survival: { bonus: 4 }, // WIS +2 + 2
      nature: { bonus: 2 }, // INT 0 + 2
      insight: { bonus: 4 },
      perception: { bonus: 4 }, // Elf Keen Senses: WIS +2 + 2
      sleight_of_hand: { bonus: 5 }, // Criminal: DEX +3 + 2
      stealth: { bonus: 5 },
    },
    spells: {
      cantripsCount: 0,
      knownOrBookCount: 0,
      preparedCount: 2, // Hunter's Mark is always prepared and not counted
      spellAttackBonus: 4, // WIS +2 + 2
      spellSaveDC: 12,
    },
    features: ['Spellcasting', 'Favored Enemy', 'Weapon Mastery', 'Alert'],
    currency: { gp: 23 }, // Ranger package A 7 + Criminal package A 16
  },
};
