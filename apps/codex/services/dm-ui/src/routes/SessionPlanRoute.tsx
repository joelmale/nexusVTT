import { useMemo, useState } from 'react';

import {
  ashesOfVeyra,
  handouts,
  libraryObjects,
  session12Plan,
  sessions,
} from '@/demo/ashes-of-veyra';
import { useCapabilityNotice } from '@/features/capability-notice';
import { SessionPlan } from '@/features/session-plan/SessionPlan';
import type {
  LibraryObject,
  LibraryObjectType,
  SessionStepViewModel,
  SessionPlanViewModel,
} from '@/features/session-plan/sessionPlanModels';
import { StudioFrame } from '@/features/studio-shell/StudioFrame';
import {
  activateSessionPlan,
  publishSessionPlan,
  type PublishSessionPlanInput,
} from '@/services/campaign-prep-api';

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

function normalizeLibraryType(kind: string): LibraryObjectType {
  if (kind === 'faction' || kind === 'quest') return 'lore';
  return kind as LibraryObjectType;
}

function resolveObjectTitle(objectId: string): string {
  return (
    libraryObjects.find((item) => item.id === objectId)?.title ??
    handouts.find((item) => item.id === objectId)?.title ??
    objectId.replace(/-/g, ' ')
  );
}

function removeCommandPrefix(title: string): string {
  const separatorIndex = title.indexOf(': ');
  return separatorIndex >= 0 ? title.slice(separatorIndex + 2) : title;
}

function buildSessionPlanModel(): SessionPlanViewModel {
  const session = sessions.find((item) => item.number === 12);
  if (!session)
    throw new Error('Ashes of Veyra Session 12 fixture is missing.');

  return {
    attachments: handouts
      .filter((item) => session12Plan.attachments.includes(item.id))
      .map((item) => ({
        id: item.id,
        subtitle: item.summary,
        title: item.title,
        type: item.kind,
      })),
    breadcrumb: 'Sessions > Session 12',
    campaignDescription: ashesOfVeyra.campaign.premise,
    campaignTitle: ashesOfVeyra.campaign.title,
    checklist: session12Plan.readiness,
    compendiumObjects: COMPENDIUM_OBJECTS,
    counts: [
      {
        count: ashesOfVeyra.campaign.objectCounts.all,
        label: 'All Objects',
        type: 'all',
      },
      {
        count: ashesOfVeyra.campaign.objectCounts.scenes,
        label: 'Scenes',
        type: 'scene',
      },
      {
        count: ashesOfVeyra.campaign.objectCounts.encounters,
        label: 'Encounters',
        type: 'encounter',
      },
      {
        count: ashesOfVeyra.campaign.objectCounts.npcs,
        label: 'NPCs',
        type: 'npc',
      },
      {
        count: ashesOfVeyra.campaign.objectCounts.lore,
        label: 'Lore',
        type: 'lore',
      },
      {
        count: ashesOfVeyra.campaign.objectCounts.handouts,
        label: 'Handouts',
        type: 'handout',
      },
    ],
    dateLabel: 'Sat, Apr 26, 2025',
    dependencies: session12Plan.dependencies.map((dependency) => ({
      id: dependency.objectId,
      kind: dependency.objectId.split('-')[0] ?? 'object',
      label: resolveObjectTitle(dependency.objectId),
      ready: dependency.status === 'ready',
    })),
    durationLabel: '~3-4 hours',
    folders: ashesOfVeyra.folders.map((folder) => ({
      childCounts: folder.children.map((child) => ({
        count: child.count,
        label: `${child.kind.slice(0, 1).toUpperCase()}${child.kind.slice(1)}s`,
      })),
      id: folder.id,
      subtitle:
        ashesOfVeyra.acts.find((act) => act.id === folder.actId)?.summary ?? '',
      title: folder.title,
    })),
    lastEditedLabel: `Last edited ${session12Plan.lastEdited}`,
    notes: session12Plan.notes.join(' '),
    partyLevel: session.partyLevel,
    playerFacing: session12Plan.playerFacingSummary,
    recentObjects: libraryObjects.slice(0, 5).map((item) => {
      const type = normalizeLibraryType(item.kind);
      return {
        id: item.id,
        subtitle: `${KIND_LABELS[type]} - ${item.updatedLabel}`,
        title: item.title,
        type,
      };
    }),
    revision: session12Plan.revision,
    sceneMapPath: ashesOfVeyra.maps[0]?.imagePath,
    steps: session12Plan.steps.map((step) => ({
      body: step.body
        ? step.body.replace(/Typed reference: @Captain Serin.*$/, '').trim()
        : undefined,
      command: STEP_COMMANDS[step.kind],
      durationMinutes: step.durationMinutes,
      id: step.id,
      referenceLabel: step.kind === 'note' ? 'Captain Serin' : undefined,
      title: removeCommandPrefix(step.title),
      track: step.track,
      visibility: step.visibility,
    })),
    tags: session.tags,
    title: `Session ${session.number} - ${session.title}`,
  };
}

export function SessionPlanRoute() {
  const { notifyCapability } = useCapabilityNotice();
  const model = useMemo(buildSessionPlanModel, []);
  const [publishState, setPublishState] = useState<
    'idle' | 'publishing' | 'published' | 'error'
  >('idle');
  const [publishMessage, setPublishMessage] = useState<string>();
  const [activateState, setActivateState] = useState<
    'idle' | 'activating' | 'activated' | 'error'
  >('idle');

  function createPublishInput(
    steps: SessionStepViewModel[],
  ): PublishSessionPlanInput {
    return {
      campaignDescription: model.campaignDescription,
      campaignTitle: model.campaignTitle,
      planTitle: model.title,
      revision: model.revision,
      sceneMapPath: model.sceneMapPath,
      steps,
    };
  }

  async function publishPlan(steps: SessionStepViewModel[]) {
    setPublishState('publishing');
    setPublishMessage(
      'Saving the campaign objects and validating dependencies.',
    );
    try {
      const result = await publishSessionPlan(createPublishInput(steps));
      setPublishState('published');
      setPublishMessage(
        `Published revision ${result.plan.revision} to Nexus VTT.`,
      );
    } catch (error) {
      setPublishState('error');
      setPublishMessage(
        error instanceof Error
          ? error.message
          : 'The plan could not be published.',
      );
    }
  }

  async function activatePlan(steps: SessionStepViewModel[]) {
    setActivateState('activating');
    setPublishMessage('Activating plan in Nexus VTT...');
    try {
      const result = await activateSessionPlan(createPublishInput(steps));
      setActivateState('activated');
      setPublishMessage(
        `Plan activated for session ${result.activation.sessionId}! Step 1 is ready in VTT.`,
      );
    } catch (error) {
      setActivateState('error');
      setPublishMessage(
        error instanceof Error
          ? error.message
          : 'The plan could not be activated.',
      );
    }
  }

  return (
    <StudioFrame
      onCapability={notifyCapability}
      onSearch={() => notifyCapability('campaign.search')}
      onSettings={() => notifyCapability('campaign.settings.open')}
      onTheme={() => notifyCapability('campaign.theme.change')}
    >
      <SessionPlan
        activateState={activateState}
        model={model}
        onActivate={activatePlan}
        onCapability={notifyCapability}
        onPublish={publishPlan}
        publishMessage={publishMessage}
        publishState={publishState}
      />
    </StudioFrame>
  );
}
