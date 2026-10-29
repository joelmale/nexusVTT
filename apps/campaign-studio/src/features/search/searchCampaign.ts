import {
  listEntities,
  mentionSources,
  type CampaignFixtureBundle,
  type EntityRef,
} from '@/demo/fixture-registry';

export interface SearchResult {
  entity: EntityRef;
  /** A short excerpt around the first match, when the match was in the text. */
  snippet?: string;
  score: number;
}

export interface SearchCampaignOptions {
  limit?: number;
  includeSecrets?: boolean;
}

const MENTION = /@\[([^\]\n]*)\]\(ref:[\w-]+\)/g;
const SNIPPET_RADIUS = 48;

/** Mention tokens read as `@Label` in excerpts. */
function plain(text: string): string {
  return text.replace(MENTION, '@$1');
}

/** Searchable text per object id beyond its title. */
function textsByEntity(bundle: CampaignFixtureBundle): Map<string, string[]> {
  const texts = new Map<string, string[]>();
  const add = (id: string, values: readonly (string | undefined)[]) => {
    const existing = texts.get(id) ?? [];
    const next = [...existing];
    for (const value of values) {
      if (value && !next.includes(value)) {
        next.push(value);
      }
    }
    texts.set(id, next);
  };
  for (const [id, values] of mentionSources(bundle)) add(id, values);
  for (const encounter of bundle.encounters) {
    add(
      encounter.id,
      encounter.composition.map((part) => part.name),
    );
  }
  for (const npc of bundle.npcs) add(npc.id, [npc.role, ...npc.tags]);
  for (const location of bundle.locations) {
    add(location.id, [location.type, ...location.tags]);
  }
  for (const clue of bundle.clues) add(clue.id, [clue.meaning]);
  for (const handout of bundle.handouts) add(handout.id, [handout.summary]);
  for (const item of bundle.items ?? []) {
    add(item.id, [
      item.name,
      item.playerName,
      item.description,
      item.mechanics,
      item.itemType,
      item.rarity,
      item.attunementNote,
    ]);
  }
  for (const secret of bundle.secrets ?? []) {
    add(secret.id, [secret.text, secret.id]);
  }
  for (const inboxNote of bundle.inboxNotes ?? []) {
    add(inboxNote.id, [inboxNote.text]);
  }
  for (const monster of bundle.homebrewMonsters ?? []) {
    add(monster.id, [monster.name, monster.type, monster.cr, monster.notes]);
  }
  return texts;
}

function excerpt(text: string, term: string): string | undefined {
  const flat = plain(text).replace(/\s+/g, ' ');
  const at = flat.toLowerCase().indexOf(term);
  if (at < 0) return undefined;
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(flat.length, at + term.length + SNIPPET_RADIUS);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

/**
 * Searches one campaign's loaded objects: titles first, then body text. Every
 * word must match. Scope is the bundle passed in, so results can never include
 * another campaign's titles or text.
 */
export function searchCampaign(
  bundle: CampaignFixtureBundle,
  query: string,
  limitOrOptions: number | SearchCampaignOptions = 20,
  options?: SearchCampaignOptions,
): SearchResult[] {
  const phrase = query.trim().toLowerCase();
  if (!phrase) return [];
  const resolvedOptions: SearchCampaignOptions =
    typeof limitOrOptions === 'number'
      ? { ...options, limit: options?.limit ?? limitOrOptions }
      : { ...limitOrOptions, ...options };
  const limit = resolvedOptions.limit ?? 20;
  const includeSecrets = resolvedOptions.includeSecrets ?? true;

  const words = phrase.split(/\s+/);
  const texts = textsByEntity(bundle);

  const results: SearchResult[] = [];
  for (const entity of listEntities(bundle)) {
    if (!entity.href) continue;
    if (!includeSecrets && entity.kind === 'secret') continue;
    const label = entity.label.toLowerCase();
    const body = texts.get(entity.id) ?? [];
    const haystack = `${label}\n${body.map(plain).join('\n').toLowerCase()}`;
    if (!words.every((word) => haystack.includes(word))) continue;

    const inLabel = words.every((word) => label.includes(word));
    const score = label.startsWith(phrase)
      ? 100
      : label.includes(phrase)
        ? 80
        : inLabel
          ? 60
          : 10;
    const snippet = inLabel
      ? undefined
      : body
          .map((text) => excerpt(text, words[0]))
          .find((text): text is string => Boolean(text));
    results.push({ entity, score, ...(snippet ? { snippet } : {}) });
  }
  return results
    .sort(
      (a, b) =>
        b.score - a.score || a.entity.label.localeCompare(b.entity.label),
    )
    .slice(0, limit);
}
