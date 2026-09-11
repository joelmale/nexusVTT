import { ParsedEntity, clampConfidence } from './types';

export interface SpellData {
  name: string;
  level: string;
  school: string;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  description?: string;
}

const SPELL_PATTERN = /([A-Z][a-zA-Z\s']+)\n(\d+(?:st|nd|rd|th)-level\s+\w+|Cantrip)/gm;

const extractField = (text: string, pattern: RegExp): string | undefined => {
  const match = text.match(pattern);
  return match ? match[1].trim() : undefined;
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

const findBlockEnd = (text: string, start: number): number => {
  const remaining = text.substring(start);
  const nextBlock = remaining.substring(100).search(/\n\n[A-Z]/);
  if (nextBlock !== -1) {
    return start + 100 + nextBlock;
  }
  return Math.min(start + 1000, text.length);
};

const extractSchoolFromCantrip = (text: string, index: number): string => {
  const block = text.substring(index, Math.min(index + 200, text.length));
  const schoolMatch = block.match(/(evocation|conjuration|transmutation|necromancy|abjuration|divination|enchantment|illusion)/i);
  return schoolMatch ? schoolMatch[1] : '';
};

const scoreSpell = (spell: SpellData) => {
  const required = ['name', 'level', 'school'];
  const optional = ['castingTime', 'range', 'components', 'duration', 'description'];

  let present = 0;
  required.forEach((key) => {
    if ((spell as any)[key]) present += 1;
  });
  optional.forEach((key) => {
    if ((spell as any)[key]) present += 1;
  });

  const base = present / (required.length + optional.length);
  const descBonus = spell.description && spell.description.length > 40 ? 0.1 : 0;
  return clampConfidence(base + descBonus);
};

export class SpellParser {
  parse(text: string): ParsedEntity<SpellData>[] {
    const results: ParsedEntity<SpellData>[] = [];
    let match;

    while ((match = SPELL_PATTERN.exec(text)) !== null) {
      const name = match[1].trim();
      const levelSchool = match[2];
      const levelMatch = levelSchool.match(/(\d+)(?:st|nd|rd|th)-level\s+(\w+)/);
      const isCantrip = levelSchool.toLowerCase().includes('cantrip');

      const blockStart = match.index;
      const blockEnd = findBlockEnd(text, blockStart);
      const block = text.substring(blockStart, blockEnd);

      const spell: SpellData = {
        name,
        level: isCantrip ? 'Cantrip' : (levelMatch ? levelMatch[1] : ''),
        school: isCantrip ? extractSchoolFromCantrip(text, match.index) : (levelMatch ? levelMatch[2] : ''),
        castingTime: extractField(block, /Casting Time:\s*([^\n]+)/),
        range: extractField(block, /Range:\s*([^\n]+)/),
        components: extractField(block, /Components:\s*([^\n]+)/),
        duration: extractField(block, /Duration:\s*([^\n]+)/),
        description: extractDescription(block),
      };

      const confidence = scoreSpell(spell);
      const failureReason = !spell.school ? 'Missing school' : undefined;

      results.push({
        entity: spell,
        confidence,
        rawSnippet: block,
        failureReason,
      });
    }

    return results;
  }
}
