import type { CampaignFixture, CampaignSession, MapPin } from '../ashes-of-veyra/types';
import { inspectBundleIntegrity } from '../fixture-registry/integrity';
import { tidesActs, tidesCampaign } from './campaign';
import { tidesClues } from './clues';
import { tidesEncounters } from './encounters';
import { tidesFactions } from './factions';
import { tidesHandouts } from './handouts';
import { tidesFolders, tidesLibraryObjects } from './library';
import { tidesLocations } from './locations';
import { tidesMapPins, tidesMaps } from './maps';
import { tidesNpcs } from './npcs';
import { tidesObjectives, tidesQuests } from './quests';
import { tidesSessions } from './sessions';

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

export interface TidesOfBetrayalFixtures {
  campaign: CampaignFixture;
  acts: typeof tidesActs;
  sessions: CampaignSession[];
  npcs: typeof tidesNpcs;
  factions: typeof tidesFactions;
  quests: typeof tidesQuests;
  objectives: typeof tidesObjectives;
  encounters: typeof tidesEncounters;
  clues: typeof tidesClues;
  handouts: typeof tidesHandouts;
  locations: typeof tidesLocations;
  maps: typeof tidesMaps;
  pins: MapPin[];
  libraryObjects: typeof tidesLibraryObjects;
  folders: typeof tidesFolders;
}

export const tidesOfBetrayal: TidesOfBetrayalFixtures = {
  campaign: tidesCampaign,
  acts: tidesActs,
  sessions: tidesSessions,
  npcs: tidesNpcs,
  factions: tidesFactions,
  quests: tidesQuests,
  objectives: tidesObjectives,
  encounters: tidesEncounters,
  clues: tidesClues,
  handouts: tidesHandouts,
  locations: tidesLocations,
  maps: tidesMaps,
  pins: tidesMapPins,
  libraryObjects: tidesLibraryObjects,
  folders: tidesFolders,
};

/** Cross-reference check using the shared registry rules. */
export function inspectTidesFixtureIntegrity() {
  return inspectBundleIntegrity({
    ...tidesOfBetrayal,
    sceneTemplates: tidesLibraryObjects
      .filter((item) => item.kind === 'scene')
      .map((item) => ({ id: item.id, title: item.title })),
  });
}
