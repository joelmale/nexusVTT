import { campaign, campaignActs } from './campaign';
import { clues } from './clues';
import { encounters } from './encounters';
import { factions } from './factions';
import { handouts } from './handouts';
import { folders, libraryObjects } from './library';
import { locations } from './locations';
import { mapPins, maps } from './maps';
import { npcs } from './npcs';
import { questObjectives, quests } from './quests';
import { sessions } from './sessions';
import { inspectBundleIntegrity } from '../fixture-registry/integrity';
import type {
  ActivityLink,
  CampaignFixture,
  CampaignSession,
  FixtureId,
  MapPin,
  SceneTemplateRef,
} from './types';

export * from './campaign';
export * from './clues';
export * from './encounters';
export * from './factions';
export * from './handouts';
export * from './library';
export * from './locations';
export * from './maps';
export * from './npcs';
export * from './quests';
export * from './sessions';
export * from './types';

export interface AshesOfVeyraFixtures {
  campaign: CampaignFixture;
  acts: typeof campaignActs;
  sessions: CampaignSession[];
  npcs: typeof npcs;
  factions: typeof factions;
  quests: typeof quests;
  objectives: typeof questObjectives;
  encounters: typeof encounters;
  clues: typeof clues;
  handouts: typeof handouts;
  locations: typeof locations;
  maps: typeof maps;
  pins: MapPin[];
  libraryObjects: typeof libraryObjects;
  folders: typeof folders;
  sceneTemplates: SceneTemplateRef[];
}

/** Scene templates referenced by locations, session plans and map pins. */
export const ashesSceneTemplates: SceneTemplateRef[] = [
  { id: 'scene-glass-harbor-docks', title: 'Glass Harbor Docks' },
  {
    id: 'scene-harbor-warehouse-template',
    title: 'Harbor Warehouse scene template',
  },
  { id: 'scene-salty-mast-cellar', title: 'Salty Mast Cellar' },
];

export const ashesOfVeyra: AshesOfVeyraFixtures = {
  campaign,
  acts: campaignActs,
  sessions,
  npcs,
  factions,
  quests,
  objectives: questObjectives,
  encounters,
  clues,
  handouts,
  locations,
  maps,
  pins: mapPins,
  libraryObjects,
  folders,
  sceneTemplates: ashesSceneTemplates,
};

export interface FixtureIntegrityIssue {
  path: string;
  reference: FixtureId;
  reason: 'missing' | 'duplicate' | 'invalid-coordinate';
}

export function getCampaignFixture(
  campaignId: string,
): CampaignFixture | undefined {
  return campaignId === campaign.id ? campaign : undefined;
}

export function getSessionFixture(
  sessionId: string,
): CampaignSession | undefined {
  return sessions.find((session) => session.id === sessionId);
}

export function getMapPins(mapId: string): MapPin[] {
  return mapPins.filter((pin) => pin.mapId === mapId);
}

export function resolveActivityLink(link: ActivityLink): string | undefined {
  const records: Record<ActivityLink['objectType'], readonly { id: string }[]> =
    {
      npc: npcs,
      location: locations,
      encounter: encounters,
      quest: quests,
      faction: factions,
      map: maps,
    };
  return records[link.objectType].some((record) => record.id === link.targetId)
    ? link.targetId
    : undefined;
}

export function inspectFixtureIntegrity(): FixtureIntegrityIssue[] {
  return inspectBundleIntegrity(ashesOfVeyra);
}
