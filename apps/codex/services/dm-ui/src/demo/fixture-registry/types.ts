import type { CampaignCatalogEntry } from '../campaign-catalog/types';
import type {
  CampaignAct,
  CampaignClue,
  CampaignEncounter,
  CampaignFaction,
  CampaignFixture,
  CampaignHandout,
  CampaignLifecycle,
  CampaignLocation,
  CampaignMap,
  CampaignNpc,
  CampaignQuest,
  CampaignSession,
  FixtureId,
  FolderRecord,
  LibraryObject,
  MapPin,
  QuestObjective,
  SceneTemplateRef,
} from '../ashes-of-veyra/types';

export type {
  CampaignAct,
  CampaignClue,
  CampaignEncounter,
  CampaignFaction,
  CampaignFixture,
  CampaignHandout,
  CampaignLifecycle,
  CampaignLocation,
  CampaignMap,
  CampaignNpc,
  CampaignQuest,
  CampaignSession,
  FixtureId,
  FolderRecord,
  HandoutAudience,
  LibraryObject,
  MapPin,
  PlayerCharacter,
  EncounterKind,
  TrapComplexity,
  TrapDetails,
  NpcCombatSummary,
  NpcStatBlockRef,
  QuestObjective,
  SceneTemplateRef,
} from '../ashes-of-veyra/types';
export type { CampaignCatalogEntry } from '../campaign-catalog/types';

/** Where a note hangs: a session, a scene template, or the whole campaign. */
export type NoteAnchor =
  | { type: 'campaign' }
  | { type: 'session'; id: FixtureId }
  | { type: 'scene'; id: FixtureId };

export type NoteColor =
  'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange' | 'gray';

export type NoteSize = 'small' | 'medium' | 'large';

/** Who a note is shared with: nobody (DM-only), all players, or chosen character ids. */
export type NoteAudience = 'none' | 'all' | FixtureId[];

/** A free-hand DM note. `body` is formattable multi-line (markdown) text. */
export interface CampaignNote {
  id: FixtureId;
  campaignId: FixtureId;
  title: string;
  body: string;
  anchor: NoteAnchor;
  /** Share state; a shared note is effectively a player handout. */
  audience: NoteAudience;
  /** Legacy board field; ignored by the UI. */
  color: NoteColor;
  /** Legacy board field; ignored by the UI. */
  size: NoteSize;
  /** Stable global order (ascending); new notes get max + 1. */
  order: number;
}

/** The entity collections shared by every fixture, without registry metadata. */
export interface CampaignCollections {
  campaign: CampaignFixture;
  acts: CampaignAct[];
  sessions: CampaignSession[];
  npcs: CampaignNpc[];
  factions: CampaignFaction[];
  quests: CampaignQuest[];
  objectives: QuestObjective[];
  encounters: CampaignEncounter[];
  clues: CampaignClue[];
  handouts: CampaignHandout[];
  locations: CampaignLocation[];
  maps: CampaignMap[];
  pins: MapPin[];
  libraryObjects: LibraryObject[];
  folders: FolderRecord[];
  sceneTemplates: SceneTemplateRef[];
  notes: CampaignNote[];
}

/** A campaign-scoped homebrew monster, kept apart from canonical SRD entries. */
export interface HomebrewMonster {
  id: FixtureId;
  campaignId: FixtureId;
  name: string;
  size: string;
  type: string;
  /** Challenge rating label ('0', '1/8', '1/4', '1/2', '1' ... '30'). */
  cr: string;
  ac: number;
  hp: number;
  /** Walking speed in feet. */
  speed: number;
  /** STR, DEX, CON, INT, WIS, CHA scores. */
  abilities: [number, number, number, number, number, number];
  edition: '2014' | '2024';
  /** Traits, actions and anything else the DM wants on the stat block. */
  notes: string;
}

export const ITEM_TYPES = [
  'weapon',
  'armor',
  'shield',
  'wondrous_item',
  'potion',
  'scroll',
  'spellbook',
  'tool',
  'ammunition',
  'adventuring_gear',
  'treasure',
  'other',
] as const;
export type CampaignItemType = (typeof ITEM_TYPES)[number];

export const ITEM_RARITIES = [
  'none',
  'common',
  'uncommon',
  'rare',
  'very_rare',
  'legendary',
  'artifact',
] as const;
export type CampaignItemRarity = (typeof ITEM_RARITIES)[number];

export const ITEM_HOLDER_KINDS = [
  'none',
  'party-member',
  'npc',
  'location',
  'encounter',
] as const;
export type CampaignItemHolderKind = (typeof ITEM_HOLDER_KINDS)[number];

/** A piece of loot or treasure authored for the campaign. */
export interface CampaignItem {
  id: FixtureId;
  campaignId: FixtureId;
  name: string;
  itemType: CampaignItemType;
  rarity: CampaignItemRarity;
  requiresAttunement: boolean;
  attunementNote?: string;
  valueGp?: number;
  weightLb?: number;
  quantity: number;
  /** Supports `@` mentions. */
  description: string;
  /** Rules text, kept apart from the description. */
  mechanics?: string;
  /** Who carries it, or where it lies. `id` is unset for `none`. */
  holder: { kind: CampaignItemHolderKind; id?: FixtureId };
  /** The party has found it. */
  discovered: boolean;
  /** The party knows what it is. */
  identified: boolean;
  questIds: FixtureId[];
  /** Set when started from an SRD catalog entry. */
  source?: { ruleset: string; entityId: string };
}

export type BundleSource =
  'fixture' | 'catalog-only' | 'server-empty' | 'server';

export interface CampaignFixtureBundle extends CampaignCollections {
  /** URL segment, matches the catalog slug. */
  slug: string;
  campaignId: FixtureId;
  lifecycle: CampaignLifecycle;
  catalog: CampaignCatalogEntry;
  source: BundleSource;
  features: { publishSessionPlans: boolean };
  /** Server campaigns only; fixtures have no homebrew monsters. */
  homebrewMonsters?: HomebrewMonster[];
  /** Server campaigns only; fixtures have no authored items. */
  items?: CampaignItem[];
}
