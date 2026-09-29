import { createHash } from 'crypto';
import { LayoutBlock } from '../types/layout';
import { EntityType } from './schemas';

/**
 * Candidate detection (plan: Extraction step 1). Cheap rules over each page's
 * layout blocks decide which regions go to the model.
 *
 * Text blocks from all pages are flattened into one reading-order stream
 * (art and furniture dropped) and cut into sections at headings. A stat-block
 * sub-heading ("Actions", "Legendary Actions", ...) does not start a section,
 * and page breaks, column breaks and running headers never do, so a stat
 * block that continues in the next column or on the next page stays one
 * candidate. Each section is then classified by its signals.
 */

export type CandidateRegion = {
  pageNumber: number;
  blockIds: string[];
  bbox: [number, number, number, number]; // union of the blocks on this page, normalized
};

export type Candidate = {
  key: string; // stable: `${type}:p${page}:${firstUnitId}`
  type: EntityType;
  title: string;
  pageNumber: number; // first page
  regions: CandidateRegion[]; // one per page the candidate spans
  blockIds: string[];
  markdown: string;
  blockHash: string; // sha256 of markdown; part of the extraction cache key
};

export type CandidatePage = {
  pageNumber: number;
  markdown: string;
  blocks: LayoutBlock[];
};

type Unit = {
  pageNumber: number;
  blockId: string;
  unitId: string; // blockId, or blockId#n when a block is split at headings
  bbox: [number, number, number, number];
  markdown: string;
  heading: boolean;
};

const EXCLUDED = new Set(['art', 'furniture']);
const HEADING_LINE = /^ {0,3}#{1,6}\s+/;
const STAT_SUBHEADING = /^(?:#{1,6}\s*)?\**\s*(actions|bonus actions|reactions|legendary actions|lair actions|mythic actions|regional effects)\s*\**\s*$/i;

const MONSTER_AC = /armor class/i;
const MONSTER_HP = /hit points/i;
const ABILITY_ROW = /\bSTR\b[\s\S]{0,120}?\bDEX\b[\s\S]{0,120}?\bCON\b[\s\S]{0,120}?\bINT\b[\s\S]{0,120}?\bWIS\b[\s\S]{0,120}?\bCHA\b/;
const CHALLENGE = /\bchallenge\b|\bCR\s*\d/i;
// Lines that still belong to a stat block; trailing lore after the block has none.
const STAT_LINE = /hit:|attack:|saving throw|\bDC\s*\d|\(\d+d\d+|recharge|\/day|multiattack|armor class|hit points|speed|senses|languages|challenge|\bSTR\b|actions|reactions|legendary/i;

const SPELL_FIELDS = [/casting time/i, /\brange\b/i, /components/i, /duration/i];
const SPELL_LEVEL = /\b(?:[1-9](?:st|nd|rd|th)[- ]level\s+\w+|\w+\s+cantrip|level\s+[0-9]\s+\w+)\b/i;

const ITEM_TYPE = /\b(wondrous item|weapon|armor|shield|ring|rod|staff|wand|potion|scroll|ammunition)\b/i;
const ITEM_RARITY = /\b(common|uncommon|rare|very rare|legendary|artifact|rarity varies)\b/i;
const ATTUNEMENT = /requires attunement/i;

const plain = (markdown: string) => markdown.replace(/[#*_`>|]/g, ' ');

const toUnits = (pages: CandidatePage[]): Unit[] => {
  const units: Unit[] = [];
  for (const page of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    for (const block of page.blocks) {
      if (EXCLUDED.has(block.class) || !block.markdown?.trim()) continue;
      // A Markdown-upload page is one block holding a whole section: split it
      // at heading lines so it sections the same way as a layout page.
      const pieces: string[][] = [[]];
      for (const line of block.markdown.split('\n')) {
        if (HEADING_LINE.test(line) && pieces[pieces.length - 1].some((l) => l.trim())) pieces.push([]);
        pieces[pieces.length - 1].push(line);
      }
      pieces.forEach((piece, index) => {
        const markdown = piece.join('\n').trim();
        if (!markdown) return;
        units.push({
          pageNumber: page.pageNumber,
          blockId: block.id,
          unitId: pieces.length > 1 ? `${block.id}#${index}` : block.id,
          bbox: block.bbox,
          markdown,
          heading: block.class === 'heading' || HEADING_LINE.test(markdown),
        });
      });
    }
  }
  return units;
};

const sections = (units: Unit[]): Unit[][] => {
  const result: Unit[][] = [];
  let current: Unit[] = [];
  for (const unit of units) {
    const startsSection = unit.heading && !STAT_SUBHEADING.test(unit.markdown.split('\n')[0].trim());
    if (startsSection && current.length > 0) {
      result.push(current);
      current = [];
    }
    current.push(unit);
  }
  if (current.length > 0) result.push(current);
  return result;
};

export const classifySection = (markdown: string): EntityType | null => {
  const text = plain(markdown);
  if (MONSTER_AC.test(text) && MONSTER_HP.test(text) && (ABILITY_ROW.test(text) || CHALLENGE.test(text))) {
    return 'monster';
  }
  if (SPELL_FIELDS.every((pattern) => pattern.test(text)) && SPELL_LEVEL.test(text.slice(0, 600))) {
    return 'spell';
  }
  const head = text.split('\n').filter((line) => line.trim()).slice(0, 4).join('\n');
  if ((ITEM_TYPE.test(head) && ITEM_RARITY.test(head)) || (ITEM_TYPE.test(head) && ATTUNEMENT.test(head))) {
    return 'item';
  }
  return null;
};

const union = (boxes: Array<[number, number, number, number]>): [number, number, number, number] => [
  Math.min(...boxes.map((b) => b[0])),
  Math.min(...boxes.map((b) => b[1])),
  Math.max(...boxes.map((b) => b[2])),
  Math.max(...boxes.map((b) => b[3])),
];

const titleOf = (units: Unit[]) =>
  units[0].markdown.split('\n')[0].replace(/^#+\s*/, '').replace(/[*_]/g, '').trim().slice(0, 120);

export const detectCandidates = (pages: CandidatePage[]): Candidate[] => {
  const candidates: Candidate[] = [];

  for (let section of sections(toUnits(pages))) {
    const type = classifySection(section.map((u) => u.markdown).join('\n\n'));
    if (!type) continue;

    if (type === 'monster') {
      // Drop trailing lore paragraphs that follow the stat block.
      let end = section.length;
      while (end > 1 && !STAT_LINE.test(section[end - 1].markdown)) end -= 1;
      section = section.slice(0, end);
    }

    const byPage = new Map<number, Unit[]>();
    for (const unit of section) {
      byPage.set(unit.pageNumber, [...(byPage.get(unit.pageNumber) || []), unit]);
    }
    const regions: CandidateRegion[] = [...byPage.entries()].map(([pageNumber, units]) => ({
      pageNumber,
      blockIds: [...new Set(units.map((u) => u.blockId))],
      bbox: union(units.map((u) => u.bbox)),
    }));
    const markdown = section.map((u) => u.markdown).join('\n\n');

    candidates.push({
      key: `${type}:p${section[0].pageNumber}:${section[0].unitId}`,
      type,
      title: titleOf(section),
      pageNumber: section[0].pageNumber,
      regions,
      blockIds: regions.flatMap((r) => r.blockIds),
      markdown,
      blockHash: createHash('sha256').update(markdown).digest('hex'),
    });
  }

  return candidates;
};
