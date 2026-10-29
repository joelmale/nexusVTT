import type {
  ActivityLink,
  CampaignFixture,
  CampaignSession,
  FixtureId,
  MapPin,
} from '../ashes-of-veyra/types';
import { crownActs, crownCampaign, CROWN_CAMPAIGN_ID } from './campaign';
import { crownClues } from './clues';
import { crownEncounters } from './encounters';
import { crownFactions } from './factions';
import { crownHandouts } from './handouts';
import { crownFolders, crownLibraryObjects } from './library';
import { crownLocations } from './locations';
import { crownMapPins, crownMaps } from './maps';
import { crownNpcs } from './npcs';
import { crownObjectives, crownQuests } from './quests';
import { crownSessions } from './sessions';

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

export interface CrownOfCindersFixtures {
  campaign: CampaignFixture;
  acts: typeof crownActs;
  sessions: CampaignSession[];
  npcs: typeof crownNpcs;
  factions: typeof crownFactions;
  quests: typeof crownQuests;
  objectives: typeof crownObjectives;
  encounters: typeof crownEncounters;
  clues: typeof crownClues;
  handouts: typeof crownHandouts;
  locations: typeof crownLocations;
  maps: typeof crownMaps;
  pins: MapPin[];
  libraryObjects: typeof crownLibraryObjects;
  folders: typeof crownFolders;
}

export const crownOfCinders: CrownOfCindersFixtures = {
  campaign: crownCampaign,
  acts: crownActs,
  sessions: crownSessions,
  npcs: crownNpcs,
  factions: crownFactions,
  quests: crownQuests,
  objectives: crownObjectives,
  encounters: crownEncounters,
  clues: crownClues,
  handouts: crownHandouts,
  locations: crownLocations,
  maps: crownMaps,
  pins: crownMapPins,
  libraryObjects: crownLibraryObjects,
  folders: crownFolders,
};

export interface CrownFixtureIntegrityIssue {
  path: string;
  reference: FixtureId;
  reason: 'missing' | 'duplicate' | 'invalid-coordinate';
}

export function getCrownCampaignFixture(
  campaignId: string,
): CampaignFixture | undefined {
  return campaignId === crownCampaign.id ? crownCampaign : undefined;
}

export function getCrownSessionFixture(
  sessionId: string,
): CampaignSession | undefined {
  return crownSessions.find((session) => session.id === sessionId);
}

export function getCrownMapPins(mapId: string): MapPin[] {
  return crownMapPins.filter((pin) => pin.mapId === mapId);
}

export function resolveCrownActivityLink(
  link: ActivityLink,
): string | undefined {
  const records: Record<ActivityLink['objectType'], readonly { id: string }[]> =
    {
      npc: crownNpcs,
      location: crownLocations,
      encounter: crownEncounters,
      quest: crownQuests,
      faction: crownFactions,
      map: crownMaps,
    };
  return records[link.objectType].some((record) => record.id === link.targetId)
    ? link.targetId
    : undefined;
}

export function inspectCrownFixtureIntegrity(): CrownFixtureIntegrityIssue[] {
  const issues: CrownFixtureIntegrityIssue[] = [];
  const ids = new Set<string>();
  const addIds = (path: string, records: readonly { id: string }[]): void => {
    const collectionIds = new Set<string>();
    for (const record of records) {
      if (collectionIds.has(record.id)) {
        issues.push({ path, reference: record.id, reason: 'duplicate' });
      }
      collectionIds.add(record.id);
      ids.add(record.id);
    }
  };
  addIds('acts', crownActs);
  addIds('sessions', crownSessions);
  addIds('npcs', crownNpcs);
  addIds('factions', crownFactions);
  addIds('quests', crownQuests);
  addIds('objectives', crownObjectives);
  addIds('encounters', crownEncounters);
  addIds('clues', crownClues);
  addIds('handouts', crownHandouts);
  addIds('locations', crownLocations);
  addIds('maps', crownMaps);
  addIds(
    'mapLayers',
    crownMaps.flatMap((map) => map.layers),
  );
  addIds('pins', crownMapPins);
  addIds('libraryObjects', crownLibraryObjects);
  addIds('folders', crownFolders);
  ids.add(CROWN_CAMPAIGN_ID);

  const check = (
    path: string,
    references: readonly (string | undefined)[],
  ): void => {
    for (const reference of references) {
      if (reference !== undefined && !ids.has(reference)) {
        issues.push({ path, reference, reason: 'missing' });
      }
    }
  };
  const checkNested = <T>(
    records: readonly T[],
    path: string,
    select: (record: T) => readonly (string | undefined)[],
  ): void => {
    records.forEach((record, index) =>
      check(`${path}[${index}]`, select(record)),
    );
  };

  check('campaign.currentSessionId', [crownCampaign.currentSessionId]);
  check('campaign.actIds', crownCampaign.actIds);
  check('campaign.sessionIds', crownCampaign.sessionIds);
  check('campaign.nextSession', [
    crownCampaign.nextSession.sessionId,
    crownCampaign.nextSession.encounterId,
    crownCampaign.nextSession.npcId,
    crownCampaign.nextSession.locationId,
    crownCampaign.nextSession.questId,
  ]);
  checkNested(crownActs, 'acts', (record) => [record.campaignId]);
  checkNested(crownSessions, 'sessions', (record) => [
    record.campaignId,
    record.actId,
    ...record.questIds,
    ...record.npcIds,
    ...record.factionIds,
    ...record.locationIds,
    ...record.encounterIds,
    ...record.clueIds,
    ...record.handoutIds,
  ]);
  checkNested(
    crownSessions.flatMap((session) => session.plan?.dependencies ?? []),
    'session.dependencies',
    (record) => [record.objectId],
  );
  checkNested(
    crownSessions.flatMap((session) => session.plan?.steps ?? []),
    'session.steps',
    (record) => [record.objectId],
  );
  checkNested(
    crownSessions.flatMap((session) => session.plan?.attachments ?? []),
    'session.attachments',
    (id) => [id],
  );
  checkNested(crownNpcs, 'npcs', (record) => [
    record.campaignId,
    ...record.factionIds,
    ...record.locationIds,
    ...record.sessionIds,
  ]);
  checkNested(crownFactions, 'factions', (record) => [
    record.campaignId,
    record.leaderNpcId,
    ...record.alliedFactionIds,
    ...record.rivalFactionIds,
    ...record.locationIds,
    ...record.questIds,
  ]);
  checkNested(crownQuests, 'quests', (record) => [
    record.campaignId,
    record.giverNpcId,
    ...record.factionIds,
    ...record.sessionIds,
    ...record.locationIds,
    ...record.objectiveIds,
  ]);
  checkNested(crownObjectives, 'objectives', (record) => [
    record.questId,
    ...record.clueIds,
    ...record.locationIds,
  ]);
  checkNested(crownEncounters, 'encounters', (record) => [
    record.campaignId,
    ...record.sessionIds,
    ...record.locationIds,
    ...record.factionIds,
  ]);
  checkNested(crownClues, 'clues', (record) => [
    record.campaignId,
    ...record.sourceHandoutIds,
    ...record.relatedQuestIds,
    ...record.locationIds,
    ...record.sessionIds,
  ]);
  checkNested(crownHandouts, 'handouts', (record) => [
    record.campaignId,
    ...record.sessionIds,
    ...record.clueIds,
    ...record.questIds,
    ...record.locationIds,
    ...record.factionIds,
  ]);
  checkNested(crownLocations, 'locations', (record) => [
    record.campaignId,
    record.mapId,
    record.pinId,
    ...record.npcIds,
    ...record.factionIds,
    ...record.encounterIds,
    ...record.questIds,
    ...record.handoutIds,
    record.sceneTemplateId,
  ]);
  checkNested(crownMaps, 'maps', (record) => [
    record.campaignId,
    ...record.locationIds,
    ...record.layers.flatMap((layer) => [layer.id, ...layer.locationIds]),
  ]);
  checkNested(crownMapPins, 'pins', (record) => [
    record.mapId,
    record.locationId,
    ...record.layerIds,
    ...record.linkedObjectIds,
  ]);
  crownMapPins.forEach((pin) => {
    if (pin.x < 0 || pin.x > 1 || pin.y < 0 || pin.y > 1) {
      issues.push({
        path: `pins.${pin.id}`,
        reference: pin.id,
        reason: 'invalid-coordinate',
      });
    }
  });
  checkNested(crownLibraryObjects, 'libraryObjects', (record) => [
    record.id,
    record.folderActId,
  ]);
  checkNested(crownFolders, 'folders', (record) => [
    record.actId,
    ...record.objectIds,
  ]);
  checkNested(
    crownCampaign.activity.backlinks,
    'campaign.activity.backlinks',
    (record) => [resolveCrownActivityLink(record)],
  );
  checkNested(
    crownCampaign.activity.recentEdits,
    'campaign.activity.recentEdits',
    (record) => [resolveCrownActivityLink(record)],
  );

  return issues;
}
