import type { CampaignCollections, FixtureId } from './types';

export interface BundleIntegrityIssue {
  path: string;
  reference: FixtureId;
  reason: 'missing' | 'duplicate' | 'invalid-coordinate';
}

/**
 * Generic cross-reference check. Empty-string references (used by synthesized
 * catalog-only and server-empty bundles as "no value") are ignored.
 */
export function inspectBundleIntegrity(
  bundle: CampaignCollections,
): BundleIntegrityIssue[] {
  const {
    campaign,
    acts,
    sessions,
    npcs,
    factions,
    quests,
    objectives,
    encounters,
    clues,
    handouts,
    locations,
    maps,
    pins,
    libraryObjects,
    folders,
    sceneTemplates,
  } = bundle;
  const issues: BundleIntegrityIssue[] = [];
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
  addIds('acts', acts);
  addIds('sessions', sessions);
  addIds('npcs', npcs);
  addIds('factions', factions);
  addIds('quests', quests);
  addIds('objectives', objectives);
  addIds('encounters', encounters);
  addIds('clues', clues);
  addIds('handouts', handouts);
  addIds('locations', locations);
  addIds('maps', maps);
  addIds(
    'mapLayers',
    maps.flatMap((map) => map.layers),
  );
  addIds('pins', pins);
  addIds('libraryObjects', libraryObjects);
  addIds('folders', folders);
  addIds('sceneTemplates', sceneTemplates);
  ids.add(campaign.id);

  const check = (
    path: string,
    references: readonly (string | undefined)[],
  ): void => {
    for (const reference of references) {
      if (reference && !ids.has(reference)) {
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
  checkNested(acts, 'acts', (record) => [record.campaignId]);
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
  checkNested(objectives, 'objectives', (record) => [
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
    record.parentLocationId,
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
  checkNested(pins, 'pins', (record) => [
    record.mapId,
    record.locationId,
    ...record.layerIds,
    ...record.linkedObjectIds,
  ]);
  pins.forEach((pin) => {
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
  const activityTargets: Record<string, readonly { id: string }[]> = {
    npc: npcs,
    location: locations,
    encounter: encounters,
    quest: quests,
    faction: factions,
    map: maps,
  };
  const checkActivity = (
    path: string,
    links: readonly { objectType: string; targetId: string }[],
  ): void => {
    links.forEach((link, index) => {
      const resolved = activityTargets[link.objectType]?.some(
        (record) => record.id === link.targetId,
      );
      if (!resolved) {
        issues.push({
          path: `${path}[${index}]`,
          reference: link.targetId,
          reason: 'missing',
        });
      }
    });
  };
  checkActivity('campaign.activity.backlinks', campaign.activity.backlinks);
  checkActivity('campaign.activity.recentEdits', campaign.activity.recentEdits);

  return issues;
}
