import { createContext } from 'react';
import { DiceRoll } from '../services/diceService';

interface DiceContextType {
  rollHistory: DiceRoll[];
  latestRoll: DiceRoll | null;
  rollDice: (roll: DiceRoll) => DiceRoll;
  clearHistory: () => void;
  updateRollWithRealResults: (rollId: string, diceValues: number[], realTotal?: number) => void;
  createAndRollAbility: (ability: string, score: number) => DiceRoll;
  createAndRollSkill: (skillLabel: string, value: number) => DiceRoll;
  createAndRollInitiative: (modifier: number) => DiceRoll;
}

export const DiceContext = createContext<DiceContextType | undefined>(undefined);