import type { CampaignFixtureBundle } from '@/demo/fixture-registry';

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

/** The session with a plan, or undefined for an unknown id / planless session. */
export function findPlannedSession(
  bundle: CampaignFixtureBundle,
  sessionId: string,
) {
  const session = bundle.sessions.find((item) => item.id === sessionId);
  return session?.plan ? session : undefined;
}

/**
 * Builds the run-sheet view model for one session of a campaign bundle.
 * Returns undefined when the session does not exist or has no plan.
 */
export function buildSessionPlanModel(
  bundle: CampaignFixtureBundle,
  sessionId: string,
  basePath?: string,
): SessionPlanViewModel | undefined {
  const session = findPlannedSession(bundle, sessionId);
  const plan = session?.plan;
  if (!session || !plan) return undefined;

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
