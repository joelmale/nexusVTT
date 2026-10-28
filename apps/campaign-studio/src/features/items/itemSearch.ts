import type {
  CampaignItemRarity,
  CampaignItemType,
} from '@/demo/fixture-registry';

import { ITEM_TYPE_LABELS, RARITY_LABELS } from './itemsModel';

export function getItemTypeLabel(type: string): string {
  if (type in ITEM_TYPE_LABELS) {
    return ITEM_TYPE_LABELS[type as CampaignItemType];
  }
  return type;
}

export function getItemRarityLabel(rarity: string): string {
  if (rarity in RARITY_LABELS) {
    return RARITY_LABELS[rarity as CampaignItemRarity];
  }
  return rarity;
}

/** Formats a classic book-style item subtitle (e.g. "Wondrous item, rare (requires attunement)") */
export function formatItemSubtitle(item: {
  itemType: string;
  rarity: string;
  requiresAttunement?: boolean;
  attunementNote?: string;
}): string {
  const typeLabel = getItemTypeLabel(item.itemType);
  const rarityLabel = getItemRarityLabel(item.rarity);
  const parts: string[] = [typeLabel];

  if (item.rarity && item.rarity !== 'none') {
    parts.push(rarityLabel);
  }

  let text = parts.join(', ');
  if (item.requiresAttunement) {
    const note = item.attunementNote ? ` ${item.attunementNote}` : '';
    text += ` (requires attunement${note})`;
  }
  return text;
}

export interface SearchableItemLike {
  id: string;
  name: string;
  itemType: CampaignItemType | string;
  rarity: CampaignItemRarity | string;
  description?: string;
  attunementNote?: string;
  requiresAttunement?: boolean;
  valueGp?: number;
  weightLb?: number;
}

export interface ParsedItemQuery {
  freeText: string;
  terms: string[];
  rarity?: string;
  itemType?: string;
  requiresAttunement?: boolean;
  minGp?: number;
  maxGp?: number;
}

export interface ItemSearchResult<T extends SearchableItemLike> {
  item: T;
  score: number;
  matchedNameHighlights: Array<{ text: string; match: boolean }>;
}

/** Computes Levenshtein distance between two strings */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev + cost, row[j] + 1, row[j - 1] + 1);
      prev = temp;
    }
  }
  return row[b.length];
}

/** Parses query string into structured operators and free-text search terms */
export function parseItemQuery(rawQuery: string): ParsedItemQuery {
  const parts = rawQuery.trim().split(/\s+/).filter(Boolean);
  const terms: string[] = [];
  let rarity: string | undefined;
  let itemType: string | undefined;
  let requiresAttunement: boolean | undefined;
  let minGp: number | undefined;
  let maxGp: number | undefined;

  for (const part of parts) {
    const lower = part.toLowerCase();

    // Rarity operator: rarity:rare or r:rare
    const rarityMatch = /^(?:rarity|r):([a-z_]+)$/.exec(lower);
    if (rarityMatch) {
      rarity = rarityMatch[1].replace('-', '_');
      continue;
    }

    // Type operator: type:weapon or t:weapon
    const typeMatch = /^(?:type|t):([a-z_]+)$/.exec(lower);
    if (typeMatch) {
      itemType = typeMatch[1].replace('-', '_');
      continue;
    }

    // Attunement operator: attune, attunement, attune:yes/no
    if (lower === 'attune' || lower === 'attunement' || lower === 'attune:yes') {
      requiresAttunement = true;
      continue;
    }
    if (lower === 'attune:no' || lower === '!attune') {
      requiresAttunement = false;
      continue;
    }

    // GP value operators: gp<1000, gp>500, gp<=1000, gp>=500, gp=500
    const gpMinMatch = /^(?:gp|value|cost)>=?(\d+(?:\.\d+)?)$/.exec(lower);
    if (gpMinMatch) {
      minGp = Number(gpMinMatch[1]);
      continue;
    }
    const gpMaxMatch = /^(?:gp|value|cost)<=?(\d+(?:\.\d+)?)$/.exec(lower);
    if (gpMaxMatch) {
      maxGp = Number(gpMaxMatch[1]);
      continue;
    }
    const gpExactMatch = /^(?:gp|value|cost)=(\d+(?:\.\d+)?)$/.exec(lower);
    if (gpExactMatch) {
      minGp = Number(gpExactMatch[1]);
      maxGp = Number(gpExactMatch[1]);
      continue;
    }

    // Otherwise, standard search term
    terms.push(lower);
  }

  return {
    freeText: terms.join(' '),
    terms,
    rarity,
    itemType,
    requiresAttunement,
    minGp,
    maxGp,
  };
}

/** Check if text matches term and return score: exact > prefix > substring > typo */
function scoreTermInText(term: string, text: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,.'’"()/-]+/).filter(Boolean);

  // Exact full text match
  if (lower === term) return 150;

  // Exact word match
  if (words.includes(term)) return 100;

  // Prefix match on any word (e.g. "hold" matches beginning of "Holding")
  if (words.some((w) => w.startsWith(term))) return 60;

  // Substring match
  if (lower.includes(term)) return 30;

  // 1-character typo tolerance on words of length >= 5
  if (term.length >= 5) {
    for (const word of words) {
      if (Math.abs(word.length - term.length) <= 1 && levenshteinDistance(term, word) <= 1) {
        return 20;
      }
    }
  }

  return 0;
}

/** Creates highlighted segments for matched parts in the item name */
export function highlightMatchedText(
  text: string,
  terms: string[],
): Array<{ text: string; match: boolean }> {
  if (!terms.length || !text) {
    return [{ text, match: false }];
  }

  const validTerms = terms.filter((t) => t.length > 0);
  if (!validTerms.length) return [{ text, match: false }];

  // Find all match ranges in text
  const lower = text.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];

  for (const term of validTerms) {
    let index = lower.indexOf(term);
    while (index !== -1) {
      ranges.push({ start: index, end: index + term.length });
      index = lower.indexOf(term, index + 1);
    }
  }

  if (!ranges.length) {
    return [{ text, match: false }];
  }

  // Merge overlapping ranges
  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr.start <= prev.end) {
      prev.end = Math.max(prev.end, curr.end);
    } else {
      merged.push(curr);
    }
  }

  const segments: Array<{ text: string; match: boolean }> = [];
  let currentPos = 0;

  for (const range of merged) {
    if (range.start > currentPos) {
      segments.push({
        text: text.slice(currentPos, range.start),
        match: false,
      });
    }
    segments.push({
      text: text.slice(range.start, range.end),
      match: true,
    });
    currentPos = range.end;
  }

  if (currentPos < text.length) {
    segments.push({
      text: text.slice(currentPos),
      match: false,
    });
  }

  return segments;
}

/**
 * Searches and ranks items according to the query.
 * Fast, pure, and forgiving matching with operator support.
 */
export function searchItems<T extends SearchableItemLike>(
  items: readonly T[],
  rawQuery: string,
): Array<ItemSearchResult<T>> {
  const parsed = parseItemQuery(rawQuery);
  const results: Array<ItemSearchResult<T>> = [];

  for (const item of items) {
    // 1. Filter by operator criteria
    if (parsed.rarity) {
      const itemRarity = String(item.rarity).toLowerCase();
      if (!itemRarity.includes(parsed.rarity)) {
        continue;
      }
    }

    if (parsed.itemType) {
      const itemType = String(item.itemType).toLowerCase();
      const typeLabel = getItemTypeLabel(String(item.itemType)).toLowerCase();
      if (!itemType.includes(parsed.itemType) && !typeLabel.includes(parsed.itemType)) {
        continue;
      }
    }

    if (parsed.requiresAttunement !== undefined) {
      if (Boolean(item.requiresAttunement) !== parsed.requiresAttunement) {
        continue;
      }
    }

    if (parsed.minGp !== undefined) {
      if (item.valueGp === undefined || item.valueGp < parsed.minGp) {
        continue;
      }
    }

    if (parsed.maxGp !== undefined) {
      if (item.valueGp === undefined || item.valueGp > parsed.maxGp) {
        continue;
      }
    }

    // 2. Score free text terms
    if (!parsed.terms.length) {
      results.push({
        item,
        score: 1,
        matchedNameHighlights: [{ text: item.name, match: false }],
      });
      continue;
    }

    let totalScore = 0;
    let allTermsMatched = true;

    const rarityLabel = getItemRarityLabel(String(item.rarity));
    const typeLabel = getItemTypeLabel(String(item.itemType));

    for (const term of parsed.terms) {
      // Name score (3x weight)
      const nameScore = scoreTermInText(term, item.name) * 3;
      // Type/rarity score (2x weight)
      const metaScore =
        (scoreTermInText(term, typeLabel) + scoreTermInText(term, rarityLabel)) * 2;
      // Description / attunement note (1x weight)
      const descScore =
        scoreTermInText(term, item.description ?? '') +
        scoreTermInText(term, item.attunementNote ?? '');

      const termScore = nameScore + metaScore + descScore;
      if (termScore === 0) {
        allTermsMatched = false;
        break;
      }
      totalScore += termScore;
    }

    if (allTermsMatched) {
      results.push({
        item,
        score: totalScore,
        matchedNameHighlights: highlightMatchedText(item.name, parsed.terms),
      });
    }
  }

  // Sort by score descending, then by name ascending
  results.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return results;
}
