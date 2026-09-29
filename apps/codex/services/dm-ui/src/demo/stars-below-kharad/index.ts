import type {
  ActivityLink,
  CampaignSession,
  FixtureId,
  MapPin,
} from '../ashes-of-veyra/types';
import {
  kharadActs,
  kharadCampaign,
  type KharadCampaignFixture,
} from './campaign';
import { kharadClues } from './clues';
import { kharadEncounters } from './encounters';
import { kharadFactions } from './factions';
import { kharadHandouts } from './handouts';
import { kharadFolders, kharadLibraryObjects } from './library';
import { kharadLocations } from './locations';
import { kharadMapPins, kharadMaps } from './maps';
import { kharadNpcs } from './npcs';
import { kharadQuestObjectives, kharadQuests } from './quests';
import { sessions as kharadSessions } from './sessions';

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

export interface StarsBelowKharadFixtures {
  campaign: KharadCampaignFixture;
  acts: typeof kharadActs;
  sessions: CampaignSession[];
  npcs: typeof kharadNpcs;
  factions: typeof kharadFactions;
  quests: typeof kharadQuests;
  objectives: typeof kharadQuestObjectives;
  encounters: typeof kharadEncounters;
  clues: typeof kharadClues;
  handouts: typeof kharadHandouts;
  locations: typeof kharadLocations;
  maps: typeof kharadMaps;
  pins: MapPin[];
  libraryObjects: typeof kharadLibraryObjects;
  folders: typeof kharadFolders;
}

export const starsBelowKharad: StarsBelowKharadFixtures = {
  campaign: kharadCampaign,
  acts: kharadActs,
  sessions: kharadSessions,
  npcs: kharadNpcs,
  factions: kharadFactions,
  quests: kharadQuests,
  objectives: kharadQuestObjectives,
  encounters: kharadEncounters,
  clues: kharadClues,
  handouts: kharadHandouts,
  locations: kharadLocations,
  maps: kharadMaps,
  pins: kharadMapPins,
  libraryObjects: kharadLibraryObjects,
  folders: kharadFolders,
};

export interface KharadFixtureIntegrityIssue {
  path: string;
  reference: FixtureId;
  reason: 'missing' | 'duplicate' | 'invalid-coordinate';
}

export function getKharadCampaignFixture(
  campaignId: string,
): KharadCampaignFixture | undefined {
  return campaignId === kharadCampaign.id ? kharadCampaign : undefined;
}

export function getKharadSessionFixture(
  sessionId: string,
): CampaignSession | undefined {
  return kharadSessions.find((session) => session.id === sessionId);
}

export function getKharadMapPins(mapId: string): MapPin[] {
  return kharadMapPins.filter((pin) => pin.mapId === mapId);
}

export function resolveKharadActivityLink(
  link: ActivityLink,
): string | undefined {
  const records: Record<ActivityLink['objectType'], readonly { id: string }[]> =
    {
      npc: kharadNpcs,
      location: kharadLocations,
      encounter: kharadEncounters,
      quest: kharadQuests,
      faction: kharadFactions,
      map: kharadMaps,
    };
  return records[link.objectType].some((record) => record.id === link.targetId)
    ? link.targetId
    : undefined;
}

export function inspectKharadFixtureIntegrity(): KharadFixtureIntegrityIssue[] {
  const issues: KharadFixtureIntegrityIssue[] = [];
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
  addIds('acts', kharadActs);
  addIds('sessions', kharadSessions);
  addIds('npcs', kharadNpcs);
  addIds('factions', kharadFactions);
  addIds('quests', kharadQuests);
  addIds('objectives', kharadQuestObjectives);
  addIds('encounters', kharadEncounters);
  addIds('clues', kharadClues);
  addIds('handouts', kharadHandouts);
  addIds('locations', kharadLocations);
  addIds('maps', kharadMaps);
  addIds(
    'mapLayers',
    kharadMaps.flatMap((map) => map.layers),
  );
  addIds('pins', kharadMapPins);
  addIds('libraryObjects', kharadLibraryObjects);
  addIds('folders', kharadFolders);
  ids.add(kharadCampaign.id);

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

  check('campaign.currentSessionId', [kharadCampaign.currentSessionId]);
  check('campaign.actIds', kharadCampaign.actIds);
  check('campaign.sessionIds', kharadCampaign.sessionIds);
  check('campaign.nextSession', [
    kharadCampaign.nextSession.sessionId,
    kharadCampaign.nextSession.encounterId,
    kharadCampaign.nextSession.npcId,
    kharadCampaign.nextSession.locationId,
    kharadCampaign.nextSession.questId,
  ]);
  checkNested(kharadActs, 'acts', (record) => [record.campaignId]);
  checkNested(kharadSessions, 'sessions', (record) => [
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
    kharadSessions.flatMap((session) => session.plan?.dependencies ?? []),
    'session.dependencies',
    (record) => [record.objectId],
  );
  checkNested(
    kharadSessions.flatMap((session) => session.plan?.steps ?? []),
    'session.steps',
    (record) => [record.objectId],
  );
  checkNested(
    kharadSessions.flatMap((session) => session.plan?.attachments ?? []),
    'session.attachments',
    (id) => [id],
  );
  checkNested(kharadNpcs, 'npcs', (record) => [
    record.campaignId,
    ...record.factionIds,
    ...record.locationIds,
    ...record.sessionIds,
  ]);
  checkNested(kharadFactions, 'factions', (record) => [
    record.campaignId,
    record.leaderNpcId,
    ...record.alliedFactionIds,
    ...record.rivalFactionIds,
    ...record.locationIds,
    ...record.questIds,
  ]);
  checkNested(kharadQuests, 'quests', (record) => [
    record.campaignId,
    record.giverNpcId,
    ...record.factionIds,
    ...record.sessionIds,
    ...record.locationIds,
    ...record.objectiveIds,
  ]);
  checkNested(kharadQuestObjectives, 'objectives', (record) => [
    record.questId,
    ...record.clueIds,
    ...record.locationIds,
  ]);
  checkNested(kharadEncounters, 'encounters', (record) => [
    record.campaignId,
    ...record.sessionIds,
    ...record.locationIds,
    ...record.factionIds,
  ]);
  checkNested(kharadClues, 'clues', (record) => [
    record.campaignId,
    ...record.sourceHandoutIds,
    ...record.relatedQuestIds,
    ...record.locationIds,
    ...record.sessionIds,
  ]);
  checkNested(kharadHandouts, 'handouts', (record) => [
    record.campaignId,
    ...record.sessionIds,
    ...record.clueIds,
    ...record.questIds,
    ...record.locationIds,
    ...record.factionIds,
  ]);
  checkNested(kharadLocations, 'locations', (record) => [
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
  checkNested(kharadMaps, 'maps', (record) => [
    record.campaignId,
    ...record.locationIds,
    ...record.layers.flatMap((layer) => [layer.id, ...layer.locationIds]),
  ]);
  checkNested(kharadMapPins, 'pins', (record) => [
    record.mapId,
    record.locationId,
    ...record.layerIds,
    ...record.linkedObjectIds,
  ]);
  kharadMapPins.forEach((pin) => {
    if (pin.x < 0 || pin.x > 1 || pin.y < 0 || pin.y > 1) {
      issues.push({
        path: `pins.${pin.id}`,
        reference: pin.id,
        reason: 'invalid-coordinate',
      });
    }
  });
  checkNested(kharadLibraryObjects, 'libraryObjects', (record) => [
    record.id,
    record.folderActId,
  ]);
  checkNested(kharadFolders, 'folders', (record) => [
    record.actId,
    ...record.objectIds,
  ]);
  checkNested(
    kharadCampaign.activity.backlinks,
    'campaign.activity.backlinks',
    (record) => [resolveKharadActivityLink(record)],
  );
  checkNested(
    kharadCampaign.activity.recentEdits,
    'campaign.activity.recentEdits',
    (record) => [resolveKharadActivityLink(record)],
  );

  return issues;
}
