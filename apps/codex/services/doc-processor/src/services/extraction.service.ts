import { MonsterParser, MonsterData } from '../parsers/monster-parser';
import { SpellParser, SpellData } from '../parsers/spell-parser';
import { ItemParser, ItemData } from '../parsers/item-parser';
import { ParsedEntity } from '../parsers/types';

class ExtractionService {
  private spellParser = new SpellParser();
  private monsterParser = new MonsterParser();
  private itemParser = new ItemParser();

  /**
   * Extract spell blocks from text using pattern matching
   */
  extractSpells(text: string): ParsedEntity<SpellData>[] {
    return this.spellParser.parse(text);
  }

  /**
   * Extract monster stat blocks from text
   */
  extractMonsters(text: string): ParsedEntity<MonsterData>[] {
    return this.monsterParser.parse(text);
  }

  /**
   * Extract magic items from text
   */
  extractItems(text: string): ParsedEntity<ItemData>[] {
    return this.itemParser.parse(text);
  }

  /**
   * Auto-detect and extract all structured data
   */
  extractAll(text: string): {
    spells: ParsedEntity<SpellData>[];
    monsters: ParsedEntity<MonsterData>[];
    items: ParsedEntity<ItemData>[];
  } {
    return {
      spells: this.extractSpells(text),
      monsters: this.extractMonsters(text),
      items: this.extractItems(text),
    };
  }
}

export const extractionService = new ExtractionService();
