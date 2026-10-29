import { SRD_MONSTERS } from '@/data/srdMonsters';
import type {
  CampaignFixtureBundle,
  CampaignItemRarity,
  CampaignItemType,
} from '@/demo/fixture-registry';
import { buildMonsterCatalog } from '@/features/encounters/monsterCatalog';
import {
  ITEM_TYPE_LABELS,
  RARITY_LABELS,
} from '@/features/items/itemsModel';
import { getFallbackSrdCatalog } from '@/features/items/srdFallbackCatalog';
import { resolveMapImage } from '@/features/map-preparation/buildMapPreparationModel';
import { generateSessionSpine } from '@/features/sessions/sessionSpineGenerator';

import type {
  LibraryObject,
  LibraryObjectType,
  SessionPlanViewModel,
} from './sessionPlanModels';

function formatItemSubtitle(
  itemType: CampaignItemType,
  rarity: CampaignItemRarity,
): string {
  const typeLabel = ITEM_TYPE_LABELS[itemType] ?? itemType;
  if (rarity === 'none') {
    return typeLabel;
  }
  const rarityLabel = RARITY_LABELS[rarity] ?? rarity;
  return `${typeLabel} · ${rarityLabel}`;
}

/**
 * Builds the Compendium library entries for the Session Plan sidebar from
 * canonical SRD monsters, campaign homebrew monsters, campaign items, and
 * bundled SRD fallback items with deterministic IDs and labels.
 */
export function buildCompendiumObjects(
  bundle?: Pick<
    CampaignFixtureBundle,
    'homebrewMonsters' | 'items' | 'campaign' | 'catalog'
  >,
): LibraryObject[] {
  const ruleset = /2014|5\.1/.test(
    bundle?.campaign?.edition ?? bundle?.catalog?.edition ?? '',
  )
    ? '2014'
    : '2024';

  const homebrewEntries: LibraryObject[] = (bundle?.homebrewMonsters ?? []).map(
    (monster) => ({
      id: monster.id.startsWith('homebrew-')
        ? monster.id
        : `homebrew-${monster.id}`,
      title: monster.name,
      subtitle: `CR ${monster.cr} ${monster.type}`,
      type: 'encounter',
    }),
  );

  const campaignItemEntries: LibraryObject[] = (bundle?.items ?? []).map(
    (item) => ({
      id: item.id,
      title: item.name,
      subtitle: formatItemSubtitle(item.itemType, item.rarity),
      type: 'handout',
    }),
  );

  const srdMonsterEntries: LibraryObject[] = SRD_MONSTERS.map((monster) => ({
    id: `srd-${monster.id}`,
    title: monster.name,
    subtitle: `CR ${monster.cr} ${monster.type}`,
    type: 'encounter',
  }));

  const srdItemEntries: LibraryObject[] = getFallbackSrdCatalog(ruleset).map(
    (item) => ({
      id: item.id,
      title: item.name,
      subtitle: formatItemSubtitle(item.itemType, item.rarity),
      type: 'handout',
    }),
  );

  return [
    ...homebrewEntries,
    ...campaignItemEntries,
    ...srdMonsterEntries,
    ...srdItemEntries,
  ];
}

const KIND_LABELS: Record<LibraryObjectType, string> = {
  encounter: 'Encounter',
  handout: 'Handout',
  lore: 'Lore',
  npc: 'NPC',
  scene: 'Scene',
};

const STEP_COMMANDS = {
  choice: 'Decision point',
  closing: 'Closing beat',
  encounter: 'Deploy encounter',
  handout: 'Share handout',
  note: 'Open note',
  recap: 'Opening recap',
  scene: 'Activate scene',
} as const;

const TYPED_REFERENCE = /Typed reference: @([A-Z][\w'-]*(?: [A-Z][\w'-]*)*)/;

function normalizeLibraryType(kind: string): LibraryObjectType {
  if (kind === 'faction' || kind === 'quest') return 'lore';
  return kind as LibraryObjectType;
}

function removeCommandPrefix(title: string): string {
  const separatorIndex = title.indexOf(': ');
  return separatorIndex >= 0 ? title.slice(separatorIndex + 2) : title;
}

function formatPlannedDate(plannedDate: string | undefined): string {
  if (!plannedDate) return 'Date not set';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plannedDate);
  if (!match) return plannedDate;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
    year: 'numeric',
  });
}

/** The session for the given ID, or undefined if not found in the bundle. */
export function findPlannedSession(
  bundle: CampaignFixtureBundle,
  sessionId: string,
) {
  return bundle.sessions.find((item) => item.id === sessionId);
}

/**
 * Builds the run-sheet view model for one session of a campaign bundle.
 * If the session does not have a pre-authored plan, dynamically generates
 * a baseline narrative spine and readiness checklist from connected entities.
 * Returns undefined only when the session does not exist in the bundle.
 */
export function buildSessionPlanModel(
  bundle: CampaignFixtureBundle,
  sessionId: string,
  basePath?: string,
): SessionPlanViewModel | undefined {
  const session = findPlannedSession(bundle, sessionId);
  if (!session) return undefined;

  const plan =
    session.plan ??
    generateSessionSpine({
      campaignTitle: bundle.campaign.title,
      sessionNumber: session.number,
      targetDurationMinutes: (session.durationHours ?? 4) * 60,
      previousSession: bundle.sessions.find(
        (s) => s.number === session.number - 1,
      ),
      primaryLocation: bundle.locations.find((l) =>
        session.locationIds?.includes(l.id),
      ),
      quests: bundle.quests.filter((q) => session.questIds?.includes(q.id)),
      objectives:
        bundle.objectives?.filter((o) =>
          bundle.quests.some(
            (q) =>
              session.questIds?.includes(q.id) &&
              q.objectiveIds?.includes(o.id),
          ),
        ) ?? [],
      encounters: bundle.encounters.filter((e) =>
        session.encounterIds?.includes(e.id),
      ),
      npcs: bundle.npcs.filter((n) => session.npcIds?.includes(n.id)),
      factions: bundle.factions.filter((f) =>
        session.factionIds?.includes(f.id),
      ),
      handouts: bundle.handouts.filter((h) =>
        session.handoutIds?.includes(h.id),
      ),
      clues: bundle.clues.filter((c) => session.clueIds?.includes(c.id)),
    }).plan;

  const { campaign, handouts, libraryObjects } = bundle;

  const resolveObjectTitle = (objectId: string): string =>
    libraryObjects.find((item) => item.id === objectId)?.title ??
    handouts.find((item) => item.id === objectId)?.title ??
    bundle.encounters.find((item) => item.id === objectId)?.title ??
    bundle.npcs.find((item) => item.id === objectId)?.name ??
    bundle.locations.find((item) => item.id === objectId)?.name ??
    objectId.replace(/-/g, ' ');

  return {
    sessionId: session.id,
    planId: session.planId,
    authoring: plan,
    attachments: handouts
      .filter((item) => plan.attachments.includes(item.id))
      .map((item) => ({
        id: item.id,
        subtitle: item.summary,
        title: item.title,
        type: item.kind,
      })),
    backHref: basePath ? `${basePath}/sessions` : undefined,
    breadcrumb: `Sessions > Session ${session.number}`,
    campaignDescription: campaign.premise,
    campaignTitle: campaign.title,
    checklist: plan.readiness,
    compendiumObjects: buildCompendiumObjects(bundle),
    counts: [
      { count: campaign.objectCounts.all, label: 'All Objects', type: 'all' },
      { count: campaign.objectCounts.scenes, label: 'Scenes', type: 'scene' },
      {
        count: campaign.objectCounts.encounters,
        label: 'Encounters',
        type: 'encounter',
      },
      { count: campaign.objectCounts.npcs, label: 'NPCs', type: 'npc' },
      { count: campaign.objectCounts.lore, label: 'Lore', type: 'lore' },
      {
        count: campaign.objectCounts.handouts,
        label: 'Handouts',
        type: 'handout',
      },
    ],
    dateLabel: formatPlannedDate(session.plannedDate),
    dependencies: plan.dependencies.map((dependency) => ({
      id: dependency.objectId,
      kind: dependency.objectId.split('-')[0] ?? 'object',
      label: resolveObjectTitle(dependency.objectId),
      ready: dependency.status === 'ready',
    })),
    durationLabel: session.durationHours
      ? `~${session.durationHours} hours`
      : `~${Math.max(1, Math.round(plan.estimatedMinutes / 60))} hours`,
    folders: bundle.folders.map((folder) => ({
      childCounts: folder.children.map((child) => ({
        count: child.count,
        label: `${child.kind.slice(0, 1).toUpperCase()}${child.kind.slice(1)}s`,
      })),
      id: folder.id,
      subtitle:
        bundle.acts.find((act) => act.id === folder.actId)?.summary ?? '',
      title: folder.title,
    })),
    lastEditedLabel: `Last edited ${plan.lastEdited}`,
    notes: plan.notes.join(' '),
    partyLevel: session.partyLevel,
    playerFacing: plan.playerFacingSummary,
    recentObjects: libraryObjects.slice(0, 5).map((item) => {
      const type = normalizeLibraryType(item.kind);
      return {
        id: item.id,
        subtitle: `${KIND_LABELS[type]} - ${item.updatedLabel}`,
        title: item.title,
        type,
      };
    }),
    revision: plan.revision,
    steps: plan.steps.map((step) => {
      const location = bundle.locations.find(
        (item) => item.id === step.objectId,
      );
      const map = bundle.maps.find(
        (item) => item.id === (step.mapId || location?.mapId),
      );
      const encounter = bundle.encounters.find(
        (item) => item.id === step.objectId,
      );
      const catalog = buildMonsterCatalog(bundle.homebrewMonsters);
      const monsters = encounter?.composition
        .filter((row) => !row.nonCreature)
        .flatMap((row) => {
          const monster = catalog.find((item) => item.key === row.monsterKey);
          return monster ? [monster] : [];
        });
      return {
        objectId: step.objectId,
        handoutBody:
          step.kind === 'handout'
            ? bundle.handouts.find((handout) => handout.id === step.objectId)
                ?.body
            : undefined,
        sceneTemplateId:
          step.sceneTemplateId ||
          location?.sceneTemplateId ||
          (bundle.sceneTemplates.some((item) => item.id === step.objectId)
            ? step.objectId
            : undefined),
        mapId: map?.id,
        mapAssetId: map?.imageAssetRef?.assetId,
        mapImagePath: map ? resolveMapImage(map) : undefined,
        encounterId: step.kind === 'encounter' ? step.objectId : undefined,
        encounterMonsters: step.kind === 'encounter' ? monsters : undefined,
        body: step.body
          ? step.body.replace(/Typed reference: @.*$/, '').trim() || undefined
          : undefined,
        command: STEP_COMMANDS[step.kind],
        durationMinutes: step.durationMinutes,
        id: step.id,
        referenceLabel:
          step.kind === 'note' && step.body
            ? TYPED_REFERENCE.exec(step.body)?.[1]
            : undefined,
        title: removeCommandPrefix(step.title),
        track: step.track,
        visibility: step.visibility,
      };
    }),
    tags: session.tags,
    title: `Session ${session.number} - ${session.title}`,
  };
}
