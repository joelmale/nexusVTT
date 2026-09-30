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
}
