import { ParsedEntity, clampConfidence } from './types';

export interface ItemData {
  name: string;
  type?: string;
  rarity?: string;
  attunement?: boolean;
  description?: string;
}

const ITEM_PATTERN = /([A-Z][a-zA-Z\s,']+)\n(Weapon|Armor|Wondrous item|Potion|Ring|Rod|Staff|Wand)[,\s]+([a-z\s]+)/gm;

const findBlockEnd = (text: string, start: number): number => {
  const remaining = text.substring(start);
  const nextBlock = remaining.substring(100).search(/\n\n[A-Z]/);
  if (nextBlock !== -1) {
    return start + 100 + nextBlock;
  }
  return Math.min(start + 1000, text.length);
};

const extractDescription = (block: string): string | undefined => {
  const lines = block.split('\n');
  const descriptionLines: string[] = [];
  let foundHeader = false;

  for (const line of lines) {
    if (line.includes(':')) {
      foundHeader = true;
      continue;
    }

    if (foundHeader && line.trim().length > 0) {
      descriptionLines.push(line.trim());
      if (descriptionLines.length >= 3) break;
    }
  }

  return descriptionLines.length > 0 ? descriptionLines.join(' ') : undefined;
};

const scoreItem = (item: ItemData) => {
  const fields = ['name', 'type', 'rarity', 'description'];
  let present = 0;
  fields.forEach((key) => {
    if ((item as any)[key]) present += 1;
  });
  return clampConfidence(present / fields.length);
};

export class ItemParser {
  parse(text: string): ParsedEntity<ItemData>[] {
    const results: ParsedEntity<ItemData>[] = [];
    let match;

    while ((match = ITEM_PATTERN.exec(text)) !== null) {
      const name = match[1].trim();
      const type = match[2];
      const rarity = match[3].trim();

      const blockStart = match.index;
      const blockEnd = findBlockEnd(text, blockStart);
      const block = text.substring(blockStart, blockEnd);

      const item: ItemData = {
        name,
        type,
        rarity,
        attunement: block.toLowerCase().includes('requires attunement'),
        description: extractDescription(block),
      };

      const confidence = scoreItem(item);
      const failureReason = !item.rarity ? 'Missing rarity' : undefined;

      results.push({
        entity: item,
        confidence,
        rawSnippet: block,
        failureReason,
      });
    }

    return results;
  }
}
