import { ParsedEntity, clampConfidence } from './types';

export interface MonsterData {
  name: string;
  size?: string;
  type?: string;
  alignment?: string;
  ac?: string;
  hp?: string;
  speed?: string;
  abilities?: Record<string, number>;
  cr?: string;
}

const MONSTER_PATTERN = /([A-Z][a-zA-Z\s]+)\n([A-Z][a-z]+\s+[a-z]+(?:\s+\([a-z\s]+\))?,\s*[a-z\s]+)/gm;

const extractField = (text: string, pattern: RegExp): string | undefined => {
  const match = text.match(pattern);
  return match ? match[1].trim() : undefined;
};

const findBlockEnd = (text: string, start: number): number => {
  const remaining = text.substring(start);
  const nextBlock = remaining.substring(100).search(/\n\n[A-Z]/);
  if (nextBlock !== -1) {
    return start + 100 + nextBlock;
  }
  return Math.min(start + 1000, text.length);
};

const scoreMonster = (monster: MonsterData) => {
  const fields = ['name', 'size', 'type', 'ac', 'hp', 'speed', 'cr'];
  let present = 0;
  fields.forEach((key) => {
    if ((monster as any)[key]) present += 1;
  });
  const base = present / fields.length;
  return clampConfidence(base);
};

export class MonsterParser {
  parse(text: string): ParsedEntity<MonsterData>[] {
    const results: ParsedEntity<MonsterData>[] = [];
    let match;

    while ((match = MONSTER_PATTERN.exec(text)) !== null) {
      const name = match[1].trim();
      const sizeTypeAlignment = match[2];
      const monster: MonsterData = { name };

      const typeMatch = sizeTypeAlignment.match(/([A-Z][a-z]+)\s+([a-z]+(?:\s+\([a-z\s]+\))?),\s*([a-z\s]+)/);
      if (typeMatch) {
        monster.size = typeMatch[1];
        monster.type = typeMatch[2];
        monster.alignment = typeMatch[3];
      }

      const blockStart = match.index;
      const blockEnd = findBlockEnd(text, blockStart);
      const block = text.substring(blockStart, blockEnd);

      monster.ac = extractField(block, /Armor Class\s+(\d+(?:\s+\([^)]+\))?)/);
      monster.hp = extractField(block, /Hit Points\s+([\d\s+d()]+)/);
      monster.speed = extractField(block, /Speed\s+([^\n]+)/);
      monster.cr = extractField(block, /Challenge\s+([\d/]+)/);

      const confidence = scoreMonster(monster);
      const failureReason = !monster.size ? 'Missing size/type' : undefined;

      results.push({
        entity: monster,
        confidence,
        rawSnippet: block,
        failureReason,
      });
    }

    return results;
  }
}
