import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import { generateSessionSpine } from '@/features/sessions/sessionSpineGenerator';

import type {
  LibraryObject,
  LibraryObjectType,
  SessionPlanViewModel,
} from './sessionPlanModels';

const COMPENDIUM_OBJECTS: LibraryObject[] = [
  {
    id: 'srd-bandit',
    title: 'Bandit',
    subtitle: 'CR 1/8 humanoid',
    type: 'encounter',
  },
  {
    id: 'srd-guard',
    title: 'Guard',
    subtitle: 'CR 1/8 humanoid',
    type: 'encounter',
  },
  {
    id: 'srd-fog-cloud',
    title: 'Fog Cloud',
    subtitle: '1st-level conjuration',
    type: 'lore',
  },
  {
    id: 'srd-rope',
    title: 'Hempen Rope',
    subtitle: 'Adventuring gear',
    type: 'handout',
  },
];

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
    compendiumObjects: COMPENDIUM_OBJECTS,
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
    sceneMapPath: bundle.maps[0]?.imagePath,
    steps: plan.steps.map((step) => ({
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
    })),
    tags: session.tags,
    title: `Session ${session.number} - ${session.title}`,
  };
}
