/**
 * The printed type line that opens a magic item entry, e.g.
 * "*Wondrous item, rare*" or "Weapon (longsword), very rare (requires attunement)".
 * Shared by candidate detection (to split two items that share a section) and
 * validation (to notice an item whose description swallowed another entry).
 */

const ITEM_TYPE_START = /^(wondrous item|weapon|armor|shield|ring|rod|staff|wand|potion|scroll|ammunition)\b/i;
const ITEM_RARITY = /\b(common|uncommon|rare|very rare|legendary|artifact|rarity varies)\b/i;

// Prose that merely mentions an item type and a rarity is much longer than a type line.
const MAX_TYPE_LINE_LENGTH = 140;

const stripMarkup = (line: string) => line.replace(/[#*_`>|]/g, ' ').replace(/\s+/g, ' ').trim();

export const isItemTypeLine = (line: string): boolean => {
  const text = stripMarkup(line);
  return text.length > 0 && text.length <= MAX_TYPE_LINE_LENGTH && ITEM_TYPE_START.test(text) && ITEM_RARITY.test(text);
};

/** Lines of `text` that look like an item type line. */
export const itemTypeLines = (text: string): string[] => text.split('\n').filter(isItemTypeLine);
