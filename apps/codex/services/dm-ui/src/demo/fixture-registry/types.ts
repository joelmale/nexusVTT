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

/** A free-hand DM-only sticky note. `body` is formattable multi-line (markdown) text. */
export interface CampaignNote {
  id: FixtureId;
  campaignId: FixtureId;
  title: string;
  body: string;
  anchor: NoteAnchor;
  /** Card color; defaults to 'yellow'. */
  color: NoteColor;
  /** Card footprint; defaults to 'small'. */
  size: NoteSize;
  /** Stable global board order (ascending). */
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
