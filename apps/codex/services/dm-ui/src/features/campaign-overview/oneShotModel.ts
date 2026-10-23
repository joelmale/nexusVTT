import type {
  CampaignFixtureBundle,
  CampaignSession,
  EntityKind,
} from '@/demo/fixture-registry';

export type OneShotPacingStatus = 'under' | 'balanced' | 'over';
export type OneShotSceneStatus = 'few' | 'ideal' | 'many';

export interface OneShotPacingSegment {
  id: string;
  label: string;
  phase: 'hook' | 'scene' | 'climax' | 'rewards';
  minutes: number;
  percentage: number;
}

export interface OneShotBeat {
  id: string;
  phase: 'hook' | 'scene' | 'climax' | 'rewards';
  title: string;
  kind?: string;
  durationMinutes: number;
  description?: string;
  entityId?: string;
  entityKind?: EntityKind;
  entityLabel?: string;
}

export interface OneShotModel {
  isOneShot: boolean;
  sessionId?: string;
  sessionTitle: string;
  targetBudgetMinutes: number;
  totalDurationMinutes: number;
  pacingStatus: OneShotPacingStatus;
  pacingStatusMessage: string;
  sceneCountStatus: OneShotSceneStatus;
  sceneCountMessage: string;
  segments: OneShotPacingSegment[];
  hook: OneShotBeat;
  scenes: OneShotBeat[];
  climax: OneShotBeat;
  rewards: OneShotBeat;
  scheduledLootCount: number;
  unrevealedSecretsCount: number;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const DEFAULT_TARGET_BUDGET_MINUTES = 240; // 4 hours standard one-shot

/**
 * Builds the structured One-Shot Adventure Model for single-session campaigns.
 * Evaluates the 4-beat pipeline (Hook -> 3-5 Scenes -> Climax -> Rewards),
 * computes proportional pacing segments, and validates pacing vs target time budget.
 */
export function buildOneShotModel(
  bundle: CampaignFixtureBundle,
  targetBudgetMinutes = DEFAULT_TARGET_BUDGET_MINUTES,
): OneShotModel {
  const isOneShot = bundle.campaign.mode === 'one-shot';

  const sessionId =
    bundle.campaign.currentSessionId || bundle.catalog.selectedSessionId;
  const session: CampaignSession | undefined =
    bundle.sessions.find((s) => s.id === sessionId) ?? bundle.sessions[0];

  const scheduledLoot =
    session && Array.isArray(bundle.items)
      ? bundle.items.filter((i) => i.sessionId === session.id)
      : [];
  const unrevealedSecrets = Array.isArray(bundle.secrets)
    ? bundle.secrets.filter(
        (s) =>
          !s.revealed &&
          (!s.revealedInSessionId || s.revealedInSessionId === session?.id),
      )
    : [];

  const steps = session?.plan?.steps ?? [];

  let hook: OneShotBeat;
  let scenes: OneShotBeat[] = [];
  let climax: OneShotBeat;
  let rewards: OneShotBeat;

  if (steps.length === 0) {
    // Generate default structured scaffolding for blank one-shot
    hook = {
      id: 'default-hook',
      phase: 'hook',
      title: 'Call to Adventure (The Hook)',
      durationMinutes: 20,
      description:
        session?.summary ||
        'The party arrives and encounters the inciting incident.',
    };
    scenes = [
      {
        id: 'default-scene-1',
        phase: 'scene',
        title: 'Initial Investigation & Clues',
        kind: 'exploration',
        durationMinutes: 45,
      },
      {
        id: 'default-scene-2',
        phase: 'scene',
        title: 'Midpoint Escalation & Encounter',
        kind: 'combat',
        durationMinutes: 50,
      },
      {
        id: 'default-scene-3',
        phase: 'scene',
        title: 'Infiltration / The Approach',
        kind: 'puzzle',
        durationMinutes: 40,
      },
    ];
    climax = {
      id: 'default-climax',
      phase: 'climax',
      title: 'The Showdown (Climax)',
      kind: 'combat',
      durationMinutes: 65,
    };
    rewards = {
      id: 'default-rewards',
      phase: 'rewards',
      title: 'Resolution, Treasure & Epilogue',
      durationMinutes: 20,
    };
  } else if (steps.length === 1) {
    hook = {
      id: steps[0].id,
      phase: 'hook',
      title: steps[0].title,
      kind: steps[0].kind,
      durationMinutes: steps[0].durationMinutes || 20,
      description: steps[0].body,
    };
    climax = {
      id: 'derived-climax',
      phase: 'climax',
      title: 'The Climax',
      durationMinutes: 60,
    };
    rewards = {
      id: 'derived-rewards',
      phase: 'rewards',
      title: 'Rewards & Epilogue',
      durationMinutes: 15,
    };
  } else if (steps.length === 2) {
    hook = {
      id: steps[0].id,
      phase: 'hook',
      title: steps[0].title,
      kind: steps[0].kind,
      durationMinutes: steps[0].durationMinutes || 20,
      description: steps[0].body,
    };
    climax = {
      id: steps[1].id,
      phase: 'climax',
      title: steps[1].title,
      kind: steps[1].kind,
      durationMinutes: steps[1].durationMinutes || 60,
      description: steps[1].body,
    };
    rewards = {
      id: 'derived-rewards',
      phase: 'rewards',
      title: 'Rewards & Epilogue',
      durationMinutes: 15,
    };
  } else {
    // 3 or more steps: First is Hook, last is Climax (or last is Rewards if named resolution/epilogue)
    hook = {
      id: steps[0].id,
      phase: 'hook',
      title: steps[0].title,
      kind: steps[0].kind,
      durationMinutes: steps[0].durationMinutes || 20,
      description: steps[0].body,
    };

    const lastStep = steps[steps.length - 1];
    const isLastStepRewards =
      lastStep.title.toLowerCase().includes('reward') ||
      lastStep.title.toLowerCase().includes('epilogue') ||
      lastStep.title.toLowerCase().includes('resolution') ||
      lastStep.kind === 'closing';

    if (isLastStepRewards && steps.length >= 4) {
      rewards = {
        id: lastStep.id,
        phase: 'rewards',
        title: lastStep.title,
        kind: lastStep.kind,
        durationMinutes: lastStep.durationMinutes || 15,
        description: lastStep.body,
      };
      const climaxStep = steps[steps.length - 2];
      climax = {
        id: climaxStep.id,
        phase: 'climax',
        title: climaxStep.title,
        kind: climaxStep.kind,
        durationMinutes: climaxStep.durationMinutes || 60,
        description: climaxStep.body,
      };
      scenes = steps.slice(1, steps.length - 2).map((s) => ({
        id: s.id,
        phase: 'scene',
        title: s.title,
        kind: s.kind,
        durationMinutes: s.durationMinutes || 40,
        description: s.body,
      }));
    } else {
      climax = {
        id: lastStep.id,
        phase: 'climax',
        title: lastStep.title,
        kind: lastStep.kind,
        durationMinutes: lastStep.durationMinutes || 60,
        description: lastStep.body,
      };
      rewards = {
        id: 'derived-rewards',
        phase: 'rewards',
        title: 'Rewards & Epilogue',
        durationMinutes: 15,
      };
      scenes = steps.slice(1, steps.length - 1).map((s) => ({
        id: s.id,
        phase: 'scene',
        title: s.title,
        kind: s.kind,
        durationMinutes: s.durationMinutes || 40,
        description: s.body,
      }));
    }
  }

  const hookMinutes = hook.durationMinutes;
  const scenesMinutes = scenes.reduce((sum, s) => sum + s.durationMinutes, 0);
  const climaxMinutes = climax.durationMinutes;
  const rewardsMinutes = rewards.durationMinutes;
  const totalDurationMinutes =
    hookMinutes + scenesMinutes + climaxMinutes + rewardsMinutes;

  // Compute pacing bar segments
  const segments: OneShotPacingSegment[] = [
    {
      id: 'pacing-hook',
      label: `Hook (${formatDuration(hookMinutes)})`,
      phase: 'hook',
      minutes: hookMinutes,
      percentage: totalDurationMinutes > 0 ? (hookMinutes / totalDurationMinutes) * 100 : 0,
    },
    ...scenes.map((s, idx) => ({
      id: `pacing-scene-${idx + 1}`,
      label: `Scene ${idx + 1}: ${s.title} (${formatDuration(s.durationMinutes)})`,
      phase: 'scene' as const,
      minutes: s.durationMinutes,
      percentage: totalDurationMinutes > 0 ? (s.durationMinutes / totalDurationMinutes) * 100 : 0,
    })),
    {
      id: 'pacing-climax',
      label: `Climax (${formatDuration(climaxMinutes)})`,
      phase: 'climax',
      minutes: climaxMinutes,
      percentage: totalDurationMinutes > 0 ? (climaxMinutes / totalDurationMinutes) * 100 : 0,
    },
    {
      id: 'pacing-rewards',
      label: `Rewards (${formatDuration(rewardsMinutes)})`,
      phase: 'rewards',
      minutes: rewardsMinutes,
      percentage: totalDurationMinutes > 0 ? (rewardsMinutes / totalDurationMinutes) * 100 : 0,
    },
  ];

  // Evaluate scene count status
  let sceneCountStatus: OneShotSceneStatus;
  let sceneCountMessage: string;
  if (scenes.length < 3) {
    sceneCountStatus = 'few';
    sceneCountMessage = `${scenes.length} scene${scenes.length === 1 ? '' : 's'}. Consider adding more scenes (3–5 recommended for a one-shot).`;
  } else if (scenes.length > 5) {
    sceneCountStatus = 'many';
    sceneCountMessage = `${scenes.length} scenes. High risk of cutting scenes during table play.`;
  } else {
    sceneCountStatus = 'ideal';
    sceneCountMessage = `${scenes.length} scenes (ideal 3–5 scene flow).`;
  }

  // Evaluate pacing vs time budget
  let pacingStatus: OneShotPacingStatus;
  let pacingStatusMessage: string;
  if (totalDurationMinutes < targetBudgetMinutes * 0.75) {
    pacingStatus = 'under';
    pacingStatusMessage = `Under budget (${formatDuration(totalDurationMinutes)} / ${formatDuration(targetBudgetMinutes)} target). Adventure may end early.`;
  } else if (totalDurationMinutes > targetBudgetMinutes * 1.15) {
    pacingStatus = 'over';
    pacingStatusMessage = `Over budget (${formatDuration(totalDurationMinutes)} / ${formatDuration(targetBudgetMinutes)} target). Risk of session overrun.`;
  } else {
    pacingStatus = 'balanced';
    pacingStatusMessage = `Balanced pacing (${formatDuration(totalDurationMinutes)} / ${formatDuration(targetBudgetMinutes)} target).`;
  }

  return {
    isOneShot,
    sessionId: session?.id,
    sessionTitle: session?.title ?? 'One-Shot Adventure',
    targetBudgetMinutes,
    totalDurationMinutes,
    pacingStatus,
    pacingStatusMessage,
    sceneCountStatus,
    sceneCountMessage,
    segments,
    hook,
    scenes,
    climax,
    rewards,
    scheduledLootCount: scheduledLoot.length,
    unrevealedSecretsCount: unrevealedSecrets.length,
  };
}
