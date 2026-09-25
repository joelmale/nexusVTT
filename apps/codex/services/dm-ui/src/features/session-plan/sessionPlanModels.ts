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
  body?: string;
  referenceLabel?: string;
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
  title: string;
  breadcrumb: string;
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
  lastEditedLabel: string;
  notes: string;
  playerFacing: string;
  attachments: LibraryObject[];
}
