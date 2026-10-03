import characterTraits from '../data/characterTraits.json';
import alignments from '../data/alignments.json';
import { generateName } from '../utils/nameGenerator';

export interface NpcCombatSummary {
  hp: number;
  maxHp: number;
  ac: number;
  cr?: string;
}

export interface NpcStatBlockRef {
  slug: string;
  ruleset: '2014' | '2024';
}

export interface GeneratedNpc {
  name: string;
  ancestry: string;
  role: string;
  motivation: string;
  relationship: string;
  alignment: string;
  tags: string[];
  personalityTraits: string[];
  statBlockRef?: NpcStatBlockRef;
  combatSummary?: NpcCombatSummary;
}

export interface NpcGeneratorOptions {
  ancestry?: string;
  gender?: 'male' | 'female' | 'any';
  role?: string;
  alignment?: string;
  statBlockPreset?: 'commoner' | 'guard' | 'bandit' | 'noble' | 'acolyte' | 'scout' | 'veteran' | 'mage';
}

const DEFAULT_MOTIVATIONS = [
  'Searching for an apprentice who went missing near the local ruins.',
  'Owes a heavy gambling debt to a ruthless local syndicate.',
  'Secretly guards a rare magical heirloom passed down through generations.',
  'Suspects the town magistrate is under the influence of an enchantment.',
  'Working tirelessly to secure funds to rebuild the community apothecary.',
  'Desperately seeking a rare herbal remedy for a cursed family member.',
  'Knows a hidden entrance into the fortress vaults and seeks discrete partners.',
  'Trying to quietly relocate before bounty hunters catch wind of their trail.',
  'Collecting folklore and strange rumors for a secretive scholarly society.',
  'Trying to win a lucrative seat on the regional merchant guild council.',
  'Disturbed by unsettling sounds echoing from the catacombs after sundown.',
  'Looking to hire capable escorts for a high-value cargo shipment across the moors.',
  'Planning to expose a corrupt noble who framed them for smuggling.',
  'Hoping to earn enough favor to apprentice with a renowned master in the capital.',
  'Harboring a refugee hunted by an authoritarian foreign inquisitor.',
];

const DEFAULT_RELATIONSHIPS = [
  'Friendly and eager to share local gossip over a drink.',
  'Cautious and tight-lipped around armed wanderers.',
  'Secretly suspicious that the party was hired by their adversaries.',
  'Warmly hospitable, seeing adventurers as the town’s only hope.',
  'Strictly transactional: skeptical of promises and demanding coin upfront.',
  'Nervous and jumpy, terrified the party will draw unwanted attention.',
  'Fascinated by traveling heroes and eager to hear battle tales.',
  'Aloof and slightly condescending toward unwashed sellswords.',
  'Deeply relieved to meet capable problem-solvers in a troubled time.',
  'Polite on the surface, but watching closely for signs of dishonesty.',
];

const STAT_BLOCK_PRESETS: Record<string, { statBlockRef: NpcStatBlockRef; combatSummary: NpcCombatSummary }> = {
  commoner: {
    statBlockRef: { slug: 'commoner', ruleset: '2014' },
    combatSummary: { hp: 10, maxHp: 10, ac: 10, cr: '0' },
  },
  guard: {
    statBlockRef: { slug: 'guard', ruleset: '2014' },
    combatSummary: { hp: 16, maxHp: 16, ac: 16, cr: '1/8' },
  },
  bandit: {
    statBlockRef: { slug: 'bandit', ruleset: '2014' },
    combatSummary: { hp: 11, maxHp: 11, ac: 12, cr: '1/8' },
  },
  noble: {
    statBlockRef: { slug: 'noble', ruleset: '2014' },
    combatSummary: { hp: 9, maxHp: 9, ac: 15, cr: '1/8' },
  },
  acolyte: {
    statBlockRef: { slug: 'acolyte', ruleset: '2014' },
    combatSummary: { hp: 9, maxHp: 9, ac: 10, cr: '1/4' },
  },
  scout: {
    statBlockRef: { slug: 'scout', ruleset: '2014' },
    combatSummary: { hp: 16, maxHp: 16, ac: 13, cr: '1/2' },
  },
  veteran: {
    statBlockRef: { slug: 'veteran', ruleset: '2014' },
    combatSummary: { hp: 58, maxHp: 58, ac: 17, cr: '3' },
  },
  mage: {
    statBlockRef: { slug: 'mage', ruleset: '2014' },
    combatSummary: { hp: 40, maxHp: 40, ac: 12, cr: '6' },
  },
};

const COMMON_OCCUPATIONS = [
  'Innkeeper',
  'Blacksmith',
  'Town Guard',
  'Merchant',
  'Alchemist',
  'Acolyte',
  'Bounty Hunter',
  'Scholar',
  'Herbalist',
  'Tavern Cook',
  'Cartographer',
  'Watch Captain',
  'Smuggler',
  'Fisherman',
  'Scribe',
  'Fortune Teller',
  'Carpenter',
  'Jeweler',
  'Stablehand',
  'Guide',
];

function getRandomElement<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function resolvePresetForRole(role: string): string {
  const lower = role.toLowerCase();
  if (lower.includes('guard') || lower.includes('soldier') || lower.includes('watch')) return 'guard';
  if (lower.includes('bandit') || lower.includes('smuggler') || lower.includes('thief')) return 'bandit';
  if (lower.includes('priest') || lower.includes('acolyte') || lower.includes('cleric')) return 'acolyte';
  if (lower.includes('noble') || lower.includes('diplomat') || lower.includes('mayor')) return 'noble';
  if (lower.includes('scout') || lower.includes('ranger') || lower.includes('hunter') || lower.includes('guide')) return 'scout';
  if (lower.includes('mage') || lower.includes('wizard') || lower.includes('alchemist')) return 'mage';
  if (lower.includes('veteran') || lower.includes('captain') || lower.includes('knight')) return 'veteran';
  return 'commoner';
}

function normalizeAncestrySlug(ancestry: string): string {
  const lower = ancestry.toLowerCase().trim();
  if (lower.includes('human')) return 'human';
  if (lower.includes('high elf') || lower.includes('wood elf') || lower.includes('elf')) return 'elf';
  if (lower.includes('mountain dwarf') || lower.includes('hill dwarf') || lower.includes('dwarf')) return 'dwarf';
  if (lower.includes('halfling')) return 'halfling';
  if (lower.includes('tiefling')) return 'tiefling';
  if (lower.includes('dragonborn')) return 'dragonborn';
  if (lower.includes('gnome')) return 'gnome';
  if (lower.includes('orc')) return 'half-orc';
  return 'human';
}

export const COMMON_RACES = [
  'Human',
  'Elf',
  'Dwarf',
  'Halfling',
  'Tiefling',
  'Dragonborn',
  'Gnome',
  'Half-Orc',
  'Half-Elf',
];
export const COMMON_ANCESTRIES = COMMON_RACES;

/**
 * Procedurally generates a lightweight, narrative-focused NPC object.
 */
export function generateRandomNpc(options: NpcGeneratorOptions = {}): GeneratedNpc {
  const ancestry = options.ancestry || getRandomElement(COMMON_RACES);
  const ancestrySlug = normalizeAncestrySlug(ancestry);

  // Generate name
  const generatedNameObj = generateName({
    race: ancestrySlug,
    gender: options.gender || 'any',
  });
  const name = generatedNameObj.name;

  // Generate role / occupation
  const role = options.role || getRandomElement(COMMON_OCCUPATIONS);

  // Generate alignment
  const alignmentKeys = Object.keys(alignments);
  const alignment = options.alignment || (alignmentKeys.length > 0 ? getRandomElement(alignmentKeys) : 'Neutral');

  // Generate personality traits & tags
  const rawTraits = (characterTraits as { personalities?: string[] }).personalities || [];
  const selectedTraits: string[] = [];
  if (rawTraits.length > 0) {
    while (selectedTraits.length < 2) {
      const candidate = getRandomElement(rawTraits);
      if (!selectedTraits.includes(candidate)) {
        selectedTraits.push(candidate);
      }
    }
  } else {
    selectedTraits.push('Observant', 'Pragmatic');
  }

  const tags = [...selectedTraits, role.toLowerCase().replace(/\s+/g, '-')];

  // Motivation & Relationship
  const motivation = getRandomElement(DEFAULT_MOTIVATIONS);
  const relationship = getRandomElement(DEFAULT_RELATIONSHIPS);

  // Combat stats / statblock reference
  const presetKey = options.statBlockPreset || resolvePresetForRole(role);
  const preset = STAT_BLOCK_PRESETS[presetKey] || STAT_BLOCK_PRESETS.commoner;

  return {
    name,
    ancestry,
    role,
    motivation,
    relationship,
    alignment,
    tags,
    personalityTraits: selectedTraits,
    statBlockRef: preset.statBlockRef,
    combatSummary: preset.combatSummary,
  };
}

export { STAT_BLOCK_PRESETS, COMMON_OCCUPATIONS, DEFAULT_MOTIVATIONS, DEFAULT_RELATIONSHIPS };
