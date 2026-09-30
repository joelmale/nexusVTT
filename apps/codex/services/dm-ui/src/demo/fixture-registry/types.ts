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
  LibraryObject,
  MapPin,
  QuestObjective,
  SceneTemplateRef,
} from '../ashes-of-veyra/types';
export type { CampaignCatalogEntry } from '../campaign-catalog/types';

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
}

export type BundleSource = 'fixture' | 'catalog-only' | 'server-empty';

export interface CampaignFixtureBundle extends CampaignCollections {
  /** URL segment, matches the catalog slug. */
  slug: string;
  campaignId: FixtureId;
  lifecycle: CampaignLifecycle;
  catalog: CampaignCatalogEntry;
  source: BundleSource;
  features: { publishSessionPlans: boolean };
}
