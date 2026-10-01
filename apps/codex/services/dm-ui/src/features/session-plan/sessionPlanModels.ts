export type LibraryObjectType =
  'scene' | 'encounter' | 'npc' | 'lore' | 'handout';

export interface LibraryCount {
  label: string;
  count: number;
  type: LibraryObjectType | 'all';
}

export interface LibraryObject {
  id: string;
  title: string;
  subtitle: string;
  type: LibraryObjectType;
}

export interface CampaignFolder {
  id: string;
  title: string;
  subtitle: string;
  childCounts?: Array<{ label: string; count: number }>;
}

export interface SessionStepViewModel {
  id: string;
  command: string;
  title: string;
  durationMinutes: number;
  visibility: 'shared' | 'dm-only';
  /** 'main' = sequential spine beat; 'parallel' = always-available thread */
  track: 'main' | 'parallel';
  body?: string;
  referenceLabel?: string;
  /**
   * Authored `encounter` prep object a "Deploy encounter" step runs. Without
   * it the step publishes as a reminder, as the example plans do.
   */
  encounterId?: string;
  /** Stat blocks for that encounter's monsters, sent when it is published. */
  encounterMonsters?: EncounterMonsterStats[];
}

/** Stat block the server turns into a library monster for deployment. */
export interface EncounterMonsterStats {
  key: string;
  name: string;
  cr: string;
  ac: number;
  hp: number;
  speed: number;
  /** STR, DEX, CON, INT, WIS, CHA. */
  abilities: number[];
}

export interface DependencyViewModel {
  id: string;
  label: string;
  kind: string;
  ready: boolean;
}

export interface ChecklistViewModel {
  id: string;
  label: string;
  complete: boolean;
}

export interface SessionPlanViewModel {
  campaignDescription?: string;
  campaignTitle: string;
  title: string;
  breadcrumb: string;
  /** Sessions section URL; adds a back link to the breadcrumb. */
  backHref?: string;
  dateLabel: string;
  durationLabel: string;
  partyLevel: number;
  tags: string[];
  counts: LibraryCount[];
  recentObjects: LibraryObject[];
  compendiumObjects: LibraryObject[];
  folders: CampaignFolder[];
  steps: SessionStepViewModel[];
  dependencies: DependencyViewModel[];
  checklist: ChecklistViewModel[];
  revision: number;
  sceneMapPath?: string;
  lastEditedLabel: string;
  notes: string;
  playerFacing: string;
  attachments: LibraryObject[];
}
