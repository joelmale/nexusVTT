import trinketTable from '../data/trinketTable.json';
import { TrinketData } from '../types/dnd';
import { log } from './logger';

/**
 * Roll a random trinket from the Player's Handbook table
 */
export function rollRandomTrinket(extended: boolean = false): TrinketData {
  const maxRoll = extended ? 200 : 100;
  const roll = Math.floor(Math.random() * maxRoll) + 1;

  const trinket = (trinketTable as TrinketData[]).find(t => t.roll === roll);

  if (!trinket) {
    log.warn('No trinket found for roll; using fallback', { roll, maxRoll });
    return (trinketTable as TrinketData[])[0]; // Fallback to first trinket
  }

  return trinket;
}

/**
 * Get trinket by roll number
 */
export function getTrinketByRoll(roll: number): TrinketData | undefined {
  return (trinketTable as TrinketData[]).find(t => t.roll === roll);
}

/**
 * Get all available trinkets
 */
export function getAllTrinkets(): TrinketData[] {
  return trinketTable as TrinketData[];
}

/**
 * Get trinkets within a roll range
 */
export function getTrinketsInRange(minRoll: number, maxRoll: number): TrinketData[] {
  return (trinketTable as TrinketData[]).filter(t => t.roll >= minRoll && t.roll <= maxRoll);
}
