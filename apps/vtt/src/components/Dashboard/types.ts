export interface Campaign {
  id: string;
  name: string;
  subtitle: string;
  characterClass?: string;
  characterRace?: string;
  characterLevel?: number;
  updatedAt: string; // ISO date string
}

export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface CharacterRecord {
  id: string;
  name: string;
  level: number;
  klass: string;
  race: string;
  xp?: number;
  hp?: { current: number; max: number };
  mana?: { current: number; max: number };
  stats: CharacterStats;
  updatedAt: string; // ISO date string
}

export interface DiceRollResult {
  id: string;
  dieType: string; // e.g., 'd6', 'd20'
  rolls: number[];
  modifier: number;
  total: number;
  timestamp: string; // Time string
}

export interface LibraryDocument {
  id: string;
  name: string;
  size: string;
}

export interface ToolbarButton {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number | string; className?: string }>;
  onClick?: () => void;
  hoverText?: string;
  trailing?: React.ReactNode;
}
