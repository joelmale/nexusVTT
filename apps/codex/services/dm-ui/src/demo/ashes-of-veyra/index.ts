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
import type {
  ActivityLink,
  CampaignFixture,
  CampaignSession,
  FixtureId,
  MapPin,
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
}

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
  const issues: FixtureIntegrityIssue[] = [];
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
  addIds('acts', campaignActs);
  addIds('sessions', sessions);
  addIds('npcs', npcs);
  addIds('factions', factions);
  addIds('quests', quests);
  addIds('objectives', questObjectives);
  addIds('encounters', encounters);
  addIds('clues', clues);
  addIds('handouts', handouts);
  addIds('locations', locations);
  addIds('maps', maps);
  addIds(
    'mapLayers',
    maps.flatMap((map) => map.layers),
  );
  addIds('pins', mapPins);
  addIds('libraryObjects', libraryObjects);
  addIds('folders', folders);
  ids.add(campaign.id);
  ids.add('scene-glass-harbor-docks');
  ids.add('scene-harbor-warehouse-template');
  ids.add('scene-salty-mast-cellar');

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

  check('campaign.currentSessionId', [campaign.currentSessionId]);
  check('campaign.actIds', campaign.actIds);
  check('campaign.sessionIds', campaign.sessionIds);
  check('campaign.nextSession', [
    campaign.nextSession.sessionId,
    campaign.nextSession.encounterId,
    campaign.nextSession.npcId,
    campaign.nextSession.locationId,
    campaign.nextSession.questId,
  ]);
  checkNested(campaignActs, 'acts', (record) => [record.campaignId]);
  checkNested(sessions, 'sessions', (record) => [
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
    sessions.flatMap((session) => session.plan?.dependencies ?? []),
    'session.dependencies',
    (record) => [record.objectId],
  );
  checkNested(
    sessions.flatMap((session) => session.plan?.steps ?? []),
    'session.steps',
    (record) => [record.objectId],
  );
  checkNested(
    sessions.flatMap((session) => session.plan?.attachments ?? []),
    'session.attachments',
    (id) => [id],
  );
  checkNested(npcs, 'npcs', (record) => [
    record.campaignId,
    ...record.factionIds,
    ...record.locationIds,
    ...record.sessionIds,
  ]);
  checkNested(factions, 'factions', (record) => [
    record.campaignId,
    record.leaderNpcId,
    ...record.alliedFactionIds,
    ...record.rivalFactionIds,
    ...record.locationIds,
    ...record.questIds,
  ]);
  checkNested(quests, 'quests', (record) => [
    record.campaignId,
    record.giverNpcId,
    ...record.factionIds,
    ...record.sessionIds,
    ...record.locationIds,
    ...record.objectiveIds,
  ]);
  checkNested(questObjectives, 'objectives', (record) => [
    record.questId,
    ...record.clueIds,
    ...record.locationIds,
  ]);
  checkNested(encounters, 'encounters', (record) => [
    record.campaignId,
    ...record.sessionIds,
    ...record.locationIds,
    ...record.factionIds,
  ]);
  checkNested(clues, 'clues', (record) => [
    record.campaignId,
    ...record.sourceHandoutIds,
    ...record.relatedQuestIds,
    ...record.locationIds,
    ...record.sessionIds,
  ]);
  checkNested(handouts, 'handouts', (record) => [
    record.campaignId,
    ...record.sessionIds,
    ...record.clueIds,
    ...record.questIds,
    ...record.locationIds,
    ...record.factionIds,
  ]);
  checkNested(locations, 'locations', (record) => [
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
  checkNested(maps, 'maps', (record) => [
    record.campaignId,
    ...record.locationIds,
    ...record.layers.flatMap((layer) => [layer.id, ...layer.locationIds]),
  ]);
  checkNested(mapPins, 'pins', (record) => [
    record.mapId,
    record.locationId,
    ...record.layerIds,
    ...record.linkedObjectIds,
  ]);
  mapPins.forEach((pin) => {
    if (pin.x < 0 || pin.x > 1 || pin.y < 0 || pin.y > 1) {
      issues.push({
        path: `pins.${pin.id}`,
        reference: pin.id,
        reason: 'invalid-coordinate',
      });
    }
  });
  checkNested(libraryObjects, 'libraryObjects', (record) => [
    record.id,
    record.folderActId,
  ]);
  checkNested(folders, 'folders', (record) => [
    record.actId,
    ...record.objectIds,
  ]);
  checkNested(
    campaign.activity.backlinks,
    'campaign.activity.backlinks',
    (record) => [resolveActivityLink(record)],
  );
  checkNested(
    campaign.activity.recentEdits,
    'campaign.activity.recentEdits',
    (record) => [resolveActivityLink(record)],
  );

  return issues;
}
