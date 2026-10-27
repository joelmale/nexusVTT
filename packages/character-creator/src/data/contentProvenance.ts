import type { Edition } from '../types/dnd';

export type ContentKind =
  'class' | 'species' | 'background' | 'feat' | 'subclass';
/** Published PHB 2024 Origin category; legacy prerequisites do not make a feat an Origin feat.
 * https://www.dndbeyond.com/posts/1785-the-backgrounds-and-origin-feats-in-the-2024 */
export const ORIGIN_FEATS_2024: ReadonlySet<string> = new Set([
  'alert',
  'crafter',
  'healer',
  'lucky',
  'magic-initiate',
  'musician',
  'savage-attacker',
  'skilled',
  'tavern-brawler',
  'tough',
]);
const CORE_CLASSES = new Set([
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
]);
const SPECIES_2014 = new Set([
  'dragonborn',
  'dwarf',
  'elf',
  'gnome',
  'half-elf',
  'half-orc',
  'halfling',
  'human',
  'tiefling',
]);
const SPECIES_2024 = new Set([
  'dragonborn',
  'dwarf',
  'elf',
  'gnome',
  'goliath',
  'halfling',
  'human',
  'orc',
  'tiefling',
]);
const SUBCLASSES_2014 = new Set([
  'berserker',
  'lore',
  'life',
  'land',
  'champion',
  'open-hand',
  'devotion',
  'hunter',
  'thief',
  'draconic',
  'fiend',
  'evocation',
]);
const FEATS_2024 = new Set([
  'alert',
  'magic-initiate',
  'savage-attacker',
  'skilled',
  'ability-score-improvement',
  'grappler',
  'archery',
  'defense',
  'great-weapon-fighting',
  'two-weapon-fighting',
  'boon-of-combat-prowess',
  'boon-of-dimensional-travel',
  'boon-of-fate',
  'boon-of-irresistible-offense',
  'boon-of-spell-recall',
  'boon-of-the-night-spirit',
  'boon-of-truesight',
]);

/** Explicit SRD membership, not a guess from a folder or publication year.
 * The declared publication remains available; an SRD alias is a second source,
 * not permission to treat every option from that book as SRD content. */
export function isCoreSrdContent(
  kind: ContentKind,
  slug: string,
  edition: Edition,
  detail?: string,
): boolean {
  const id = slug.replace(/-(2014|2024)$/, '');
  if (kind === 'class') return CORE_CLASSES.has(id);
  if (kind === 'background')
    return edition === '2014'
      ? id === 'acolyte'
      : ['acolyte', 'criminal', 'sage', 'soldier'].includes(id);
  if (kind === 'feat')
    return edition === '2014'
      ? id === 'grappler'
      : FEATS_2024.has(id.replace(/^magic-initiate-.+$/, 'magic-initiate'));
  if (kind === 'subclass') return SUBCLASSES_2014.has(id);
  if (!(edition === '2014' ? SPECIES_2014 : SPECIES_2024).has(id)) return false;
  if (edition === '2024') return true;
  if (id === 'human' && detail === 'variant') return false;
  const subraces: Record<string, string[]> = {
    dwarf: ['hill-dwarf'],
    elf: ['high-elf'],
    halfling: ['lightfoot'],
    gnome: ['rock-gnome'],
  };
  return !detail || !subraces[id] || subraces[id].includes(detail);
}

export function isPermittedContentSource(
  kind: ContentKind,
  slug: string,
  edition: Edition,
  declared: string,
  allowed: readonly string[],
  detail?: string,
): boolean {
  if (declared.startsWith('Unverified')) return false;
  // An SRD label on a parent species does not authorize a non-SRD variant.
  const core = isCoreSrdContent(kind, slug, edition, detail);
  if (declared.startsWith('SRD') && !core) {
    const legacyVariants = [
      'variant',
      'wood-elf',
      'dark-elf',
      'drow',
      'mountain-dwarf',
      'stout',
      'stout-halfling',
      'forest-gnome',
    ];
    return (
      kind === 'species' &&
      edition === '2014' &&
      Boolean(detail && legacyVariants.includes(detail)) &&
      allowed.includes('PHB 2014')
    );
  }
  return (
    allowed.includes(declared) ||
    (core && declared.endsWith(edition) && allowed.includes(`SRD ${edition}`))
  );
}

export const RULE_SOURCE_REVISIONS = {
  '2014': {
    title: 'SRD 5.1',
    revision: 'CC v5.1',
    url: 'https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf',
  },
  '2024': {
    title: 'SRD 5.2.1',
    revision: 'CC v5.2.1',
    url: 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf',
  },
} as const;
