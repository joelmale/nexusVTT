import { useGameStore } from '@/stores/gameStore';
import { createPlacedToken, createToken, type TokenSize } from '@/types/token';

export interface EncounterActor {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  payload?: {
    monsterData?: {
      size?: string;
      armorClass?: Array<{ value: number }>;
      speed?: { walk?: number };
    };
    placement?: { sceneId: string; x: number; y: number; hidden: boolean };
  };
}
export interface EncounterRunView {
  run: {
    id: string;
    stage: 'staged' | 'deployed' | 'active' | 'completed' | 'archived';
    currentRound: number;
    currentTurnIndex: number;
    participants: Array<{ actorId: string; initiativeRoll: number }>;
  };
  actors: EncounterActor[];
}

export async function loadEncounterRun(
  campaignId: string,
  runId: string,
): Promise<EncounterRunView> {
  const response = await fetch(
    `/api/campaigns/${encodeURIComponent(campaignId)}/encounters/${encodeURIComponent(runId)}`,
    { credentials: 'include' },
  );
  if (!response.ok)
    throw new Error(
      'Could not load the committed encounter. Refresh after restoring the connection.',
    );
  return response.json() as Promise<EncounterRunView>;
}

/** Project committed campaign actors through the host's normal durable scene sync. */
export async function placeEncounterTokens(
  campaignId: string,
  runId: string,
): Promise<void> {
  const data = await loadEncounterRun(campaignId, runId);
  const state = useGameStore.getState();
  if (
    !state.session ||
    state.session.campaignId !== campaignId ||
    state.user.type !== 'host'
  )
    throw new Error('Open the campaign as DM before placing its encounter.');
  if (
    data.run.participants.some(
      (participant) =>
        !data.actors.some((actor) => actor.id === participant.actorId),
    )
  )
    throw new Error(
      'An encounter actor is unavailable. Restore it before deployment.',
    );
  if (
    data.actors.some(
      (actor) =>
        !actor.payload?.placement ||
        !Number.isFinite(actor.payload.placement.x) ||
        !Number.isFinite(actor.payload.placement.y) ||
        !state.sceneState.scenes.some(
          (scene) => scene.id === actor.payload?.placement?.sceneId,
        ),
    )
  )
    throw new Error(
      'The encounter scene is unavailable. Restore the scene and retry deployment.',
    );
  for (const actor of data.actors) {
    const placement = actor.payload?.placement;
    const scene = state.sceneState.scenes.find(
      (entry) => entry.id === placement?.sceneId,
    );
    if (!placement || !scene)
      throw new Error(
        'The encounter scene is unavailable. Restore the scene and retry deployment.',
      );
    if (scene.placedTokens.some((token) => token.id === actor.id)) continue;
    const size = actor.payload?.monsterData?.size?.toLowerCase();
    const sizes: TokenSize[] = [
      'tiny',
      'small',
      'medium',
      'large',
      'huge',
      'gargantuan',
    ];
    const baseToken = {
      ...createToken({
        name: actor.name,
        image: '/assets/icons/panels/tokens-1.png',
        size: sizes.find((entry) => entry === size) ?? 'medium',
        category: 'monster',
        stats: {
          hp: actor.maxHp,
          ac: actor.payload?.monsterData?.armorClass?.[0]?.value,
          speed: actor.payload?.monsterData?.speed?.walk,
        },
      }),
      id: actor.id,
    };
    const token = createPlacedToken(
      baseToken,
      { x: placement.x, y: placement.y },
      scene.id,
      state.session.roomCode,
      state.user.id,
      {
        id: actor.id,
        baseToken,
        nameOverride: actor.name,
        visibleToPlayers: !placement.hidden,
        currentStats: { hp: actor.currentHp },
      },
    );
    state.placeToken(scene.id, token);
  }
  state.syncGameStateToServer();
}
