export type CampaignLifecycle = 'draft' | 'active' | 'paused' | 'complete';

export type FixtureId = string;

export interface SceneTemplateRef {
  id: FixtureId;
  title: string;
}

export interface CampaignAct {
  id: FixtureId;
  campaignId: FixtureId;
  title: string;
  order: number;
  status: 'complete' | 'active' | 'planned';
  firstSessionNumber: number;
  lastSessionNumber: number;
  summary: string;
}

export interface CampaignFixture {
  id: FixtureId;
  title: string;
  subtitle: string;
  premise: string;
  ruleset: string;
  edition: string;
  status: CampaignLifecycle;
  currentSessionId: FixtureId;
  actIds: FixtureId[];
  sessionIds: FixtureId[];
  playerCharacters: PlayerCharacter[];
  objectCounts: CampaignObjectCounts;
  nextSession: NextSessionSummary;
  activity: CampaignActivity;
}

export interface PlayerCharacter {
  id: FixtureId;
  name: string;
  ancestry: string;
  className: string;
  level: number;
  hook: string;
}

export interface CampaignObjectCounts {
  all: number;
  scenes: number;
  encounters: number;
  npcs: number;
  lore: number;
  handouts: number;
}

export interface NextSessionSummary {
  sessionId: FixtureId;
  plannedDate: string;
  time: string;
  relativeDate: string;
  encounterId: FixtureId;
  npcId: FixtureId;
  locationId: FixtureId;
  questId: FixtureId;
}

export interface CampaignActivity {
  backlinks: ActivityLink[];
  recentEdits: ActivityLink[];
}

export interface ActivityLink {
  id: FixtureId;
  label: string;
  objectType: 'npc' | 'location' | 'encounter' | 'quest' | 'faction' | 'map';
  targetId: FixtureId;
  detail: string;
  /** ISO time of the edit; set for server campaigns, shown as relative time. */
  updatedAt?: string;
}

export interface CampaignSession {
  id: FixtureId;
  campaignId: FixtureId;
  actId: FixtureId;
  number: number;
  title: string;
  status: 'complete' | 'draft' | 'planned';
  summary: string;
  plannedDate?: string;
  durationHours?: number;
  partyLevel: number;
  tags: string[];
  questIds: FixtureId[];
  npcIds: FixtureId[];
  factionIds: FixtureId[];
  locationIds: FixtureId[];
  encounterIds: FixtureId[];
  clueIds: FixtureId[];
  handoutIds: FixtureId[];
  plan?: SessionPlan;
}

export interface SessionPlan {
  revision: number;
  lastEdited: string;
  estimatedMinutes: number;
  readiness: ReadinessItem[];
  dependencies: PlanDependency[];
  steps: SessionPlanStep[];
  notes: string[];
  playerFacingSummary: string;
  attachments: FixtureId[];
}

export interface ReadinessItem {
  id: FixtureId;
  label: string;
  complete: boolean;
}

export interface PlanDependency {
  objectId: FixtureId;
  status: 'ready' | 'needs-review';
}

export interface SessionPlanStep {
  id: FixtureId;
  order: number;
  kind:
    'recap' | 'scene' | 'note' | 'encounter' | 'handout' | 'choice' | 'closing';
  /** 'main' = sequential spine beat; 'parallel' = always-available thread */
  track: 'main' | 'parallel';
  title: string;
  durationMinutes: number;
  visibility: 'shared' | 'dm-only';
  objectId?: FixtureId;
  body?: string;
}

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

export interface CampaignNpc {
  id: FixtureId;
  campaignId: FixtureId;
  name: string;
  role: string;
  ancestry: string;
  factionIds: FixtureId[];
  motivation: string;
  relationship: string;
  locationIds: FixtureId[];
  sessionIds: FixtureId[];
  portraitFallback: string;
  tags: string[];
  statBlockRef?: NpcStatBlockRef;
  combatSummary?: NpcCombatSummary;
}

export interface CampaignFaction {
  id: FixtureId;
  campaignId: FixtureId;
  name: string;
  publicFace: string;
  hiddenAgenda: string;
  leaderNpcId?: FixtureId;
  alliedFactionIds: FixtureId[];
  rivalFactionIds: FixtureId[];
  locationIds: FixtureId[];
  questIds: FixtureId[];
  status: 'ally' | 'neutral' | 'opposition' | 'unknown';
}

export interface CampaignQuest {
  id: FixtureId;
  campaignId: FixtureId;
  title: string;
  status: 'active' | 'on-hold' | 'not-started' | 'complete';
  priority: 'high' | 'medium' | 'low';
  summary: string;
  giverNpcId?: FixtureId;
  factionIds: FixtureId[];
  sessionIds: FixtureId[];
  locationIds: FixtureId[];
  objectiveIds: FixtureId[];
  /** How the quest ended; shown only when present. */
  resolution?: string;
}

export interface QuestObjective {
  id: FixtureId;
  questId: FixtureId;
  order: number;
  title: string;
  status: 'complete' | 'active' | 'blocked' | 'pending';
  clueIds: FixtureId[];
  locationIds: FixtureId[];
}

export interface CampaignEncounter {
  id: FixtureId;
  campaignId: FixtureId;
  title: string;
  kind: 'combat' | 'social' | 'combat-hazard' | 'combat-exploration';
  difficulty: 'low' | 'moderate' | 'high';
  composition: EncounterComponent[];
  trigger: string;
  intendedUse: string;
  sessionIds: FixtureId[];
  locationIds: FixtureId[];
  factionIds: FixtureId[];
  tactics: string;
  rulesetNotes: string;
}

export interface EncounterComponent {
  name: string;
  count: number;
  ruleset: '2024' | '2014-srd' | 'custom';
  role: string;
  /**
   * Catalog link, set by the encounter editor: `srd:<index>` for a canonical
   * SRD monster or `homebrew:<object id>` for a campaign homebrew monster.
   * Example fixtures list monsters by name only and leave this unset.
   */
  monsterKey?: string;
  /** Challenge rating label copied from the linked monster ('1/4', '5'). */
  cr?: string;
  /**
   * A hazard, lair action or other row that is not a creature. It has no stat
   * block, no challenge rating and is never spawned when the encounter deploys.
   */
  nonCreature?: boolean;
}

export interface CampaignClue {
  id: FixtureId;
  campaignId: FixtureId;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: 'unresolved' | 'partially-understood' | 'resolved';
  meaning: string;
  sourceHandoutIds: FixtureId[];
  relatedQuestIds: FixtureId[];
  locationIds: FixtureId[];
  sessionIds: FixtureId[];
}

export interface CampaignHandout {
  id: FixtureId;
  campaignId: FixtureId;
  title: string;
  kind: 'handout' | 'lore';
  summary: string;
  content: string[];
  visibility: 'shared' | 'dm-only';
  sessionIds: FixtureId[];
  clueIds: FixtureId[];
  questIds: FixtureId[];
  locationIds: FixtureId[];
  factionIds: FixtureId[];
  /** Handout organization; set for server handouts and derived for fixtures. */
  folderId?: FixtureId;
  order?: number;
  audience?: HandoutAudience;
  /** Formattable (markdown) body; `content` is its paragraph split. */
  body?: string;
}

/** Share state of a handout: hidden, all players, or chosen character ids. */
export type HandoutAudience = 'hidden' | 'all' | FixtureId[];

export interface CampaignLocation {
  id: FixtureId;
  campaignId: FixtureId;
  name: string;
  /** Free-form; the UI humanizes it. Known values (district, landmark, ...) keep icons. */
  type: string;
  shortDescription: string;
  description: string[];
  tags: string[];
  parentLocationId?: FixtureId;
  mapId?: FixtureId;
  pinId?: FixtureId;
  npcIds: FixtureId[];
  factionIds: FixtureId[];
  encounterIds: FixtureId[];
  questIds: FixtureId[];
  handoutIds: FixtureId[];
  sceneTemplateId?: FixtureId;
  imagePath?: string;
  notes: string;
}

export interface CampaignMap {
  id: FixtureId;
  campaignId: FixtureId;
  title: string;
  description: string;
  imagePath?: string;
  imageAssetRef?: { target: 'asset'; assetId: string };
  dimensions?: { width: number; height: number };
  locationIds: FixtureId[];
  layers: MapLayer[];
  pins?: MapPin[];
}

export interface MapLayer {
  id: FixtureId;
  label: string;
  visibleByDefault: boolean;
  order?: number;
  locationIds: FixtureId[];
}

export interface MapPin {
  id: FixtureId;
  mapId: FixtureId;
  locationId: FixtureId;
  label: string;
  order: number;
  x: number;
  y: number;
  layerIds: FixtureId[];
  linkedObjectIds: FixtureId[];
  linkedObjectRefs?: Array<{ target: string; [k: string]: unknown }>;
  icon?: string;
  color?: string;
  visibility?: 'dm-only' | 'players';
  notes?: string;
  selectedByDefault: boolean;
}

export interface LibraryObject {
  id: FixtureId;
  title: string;
  kind:
    'scene' | 'encounter' | 'npc' | 'lore' | 'handout' | 'faction' | 'quest';
  folderActId: FixtureId;
  updatedLabel: string;
}

export interface FolderRecord {
  id: FixtureId;
  title: string;
  actId: FixtureId;
  objectIds: FixtureId[];
  children: FolderChild[];
  /** Set on server handout folders (single level); act folders leave it unset. */
  kind?: 'handout-folder';
  order?: number;
}

export interface FolderChild {
  kind: 'scene' | 'npc' | 'encounter' | 'handout';
  count: number;
}
