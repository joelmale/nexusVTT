// Initiative Tracker Types for D&D 5e Combat Management

export interface Condition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  duration?: number; // rounds remaining, undefined for permanent
  concentration?: boolean; // if the condition requires concentration
}

export interface InitiativeEntry {
  id: string;
  name: string;
  type: 'player' | 'npc' | 'monster';
  initiative: number;
  maxHP: number;
  currentHP: number;
  tempHP: number;
  armorClass: number;
  conditions: Condition[];
  isActive: boolean; // currently taking their turn
  isReady: boolean; // has readied an action
  isDelayed: boolean; // has delayed their turn
  tokenId?: string; // reference to map token if placed
  playerId?: string; // reference to player if PC
  characterId?: string; // Links to Character.id
  notes: string;
  // Death saves for 5e
  deathSaves: {
    successes: number;
    failures: number;
  };
  // Initiative modifiers
  initiativeModifier: number;
  dexterityModifier: number;
}

export interface CombatRound {
  number: number;
  startTime: number;
  activeEntryId: string | null;
  events: CombatEvent[];
}

export interface CombatEvent {
  id: string;
  type:
    | 'damage'
    | 'healing'
    | 'condition_applied'
    | 'condition_removed'
    | 'death_save'
    | 'turn_start'
    | 'turn_end'
    | 'initiative_rolled';
  timestamp: number;
  entryId: string;
  description: string;
  amount?: number; // for damage/healing
  conditionId?: string; // for condition events
  rollResult?: number; // for death saves or initiative
}

export interface InitiativeState {
  isActive: boolean; // combat is currently running
  isPaused: boolean; // combat is paused
  round: number;
  entries: InitiativeEntry[];
  activeEntryId: string | null;
  history: CombatRound[];
  // Settings
  autoAdvanceTurns: boolean;
  showPlayerHP: boolean;
  allowPlayerInitiative: boolean;
  sortByInitiative: boolean;
}

// D&D 5e Standard Conditions
export const STANDARD_CONDITIONS: Condition[] = [
  {
    id: 'blinded',
    name: 'Blinded',
    description:
      "Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.",
    icon: '👁️‍🗨️',
    color: '#9CA3AF',
  },
  {
    id: 'charmed',
    name: 'Charmed',
    description:
      "Can't attack the charmer or target the charmer with harmful abilities or magical effects.",
    icon: '💖',
    color: '#F472B6',
  },
  {
    id: 'deafened',
    name: 'Deafened',
    description:
      "Can't hear and automatically fails any ability check that requires hearing.",
    icon: '🔇',
    color: '#6B7280',
  },
  {
    id: 'frightened',
    name: 'Frightened',
    description:
      'Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.',
    icon: '😨',
    color: '#FCD34D',
  },
  {
    id: 'grappled',
    name: 'Grappled',
    description: "Speed becomes 0, and can't benefit from any bonus to speed.",
    icon: '🤝',
    color: '#F97316',
  },
  {
    id: 'incapacitated',
    name: 'Incapacitated',
    description: "Can't take actions or reactions.",
    icon: '💤',
    color: '#8B5CF6',
  },
  {
    id: 'invisible',
    name: 'Invisible',
    description:
      'Impossible to see without the aid of magic or a special sense.',
    icon: '👻',
    color: '#E5E7EB',
  },
  {
    id: 'paralyzed',
    name: 'Paralyzed',
    description:
      "Incapacitated and can't move or speak. Fails Strength and Dexterity saving throws.",
    icon: '🧊',
    color: '#3B82F6',
  },
  {
    id: 'petrified',
    name: 'Petrified',
    description:
      'Transformed into a solid inanimate substance along with any nonmagical object worn or carried.',
    icon: '🗿',
    color: '#78716C',
  },
  {
    id: 'poisoned',
    name: 'Poisoned',
    description: 'Disadvantage on attack rolls and ability checks.',
    icon: '☠️',
    color: '#10B981',
  },
  {
    id: 'prone',
    name: 'Prone',
    description:
      'Disadvantage on attack rolls. Attack rolls against the creature have advantage if within 5 feet.',
    icon: '⬇️',
    color: '#EF4444',
  },
  {
    id: 'restrained',
    name: 'Restrained',
    description:
      'Speed becomes 0. Disadvantage on attack rolls and Dexterity saving throws.',
    icon: '⛓️',
    color: '#991B1B',
  },
  {
    id: 'stunned',
    name: 'Stunned',
    description: "Incapacitated, can't move, and can speak only falteringly.",
    icon: '💫',
    color: '#FBBF24',
  },
  {
    id: 'unconscious',
    name: 'Unconscious',
    description:
      "Incapacitated, can't move or speak, and is unaware of surroundings.",
    icon: '😴',
    color: '#1F2937',
  },
  {
    id: 'concentration',
    name: 'Concentrating',
    description: 'Maintaining concentration on a spell or effect.',
    icon: '🧠',
    color: '#8B5CF6',
    concentration: true,
  },
];

// Helper function to get condition by ID
export function getConditionById(id: string): Condition | undefined {
  return STANDARD_CONDITIONS.find((condition) => condition.id === id);
}

// Helper function to create a new initiative entry
export function createInitiativeEntry(
  name: string,
  type: 'player' | 'npc' | 'monster',
  initiative: number,
  options: Partial<InitiativeEntry> = {},
): InitiativeEntry {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    initiative,
    maxHP: options.maxHP || 10,
    currentHP: options.currentHP || options.maxHP || 10,
    tempHP: 0,
    armorClass: options.armorClass || 10,
    conditions: [],
    isActive: false,
    isReady: false,
    isDelayed: false,
    notes: '',
    deathSaves: {
      successes: 0,
      failures: 0,
    },
    initiativeModifier: options.initiativeModifier || 0,
    dexterityModifier: options.dexterityModifier || 0,
    ...options,
  };
}
