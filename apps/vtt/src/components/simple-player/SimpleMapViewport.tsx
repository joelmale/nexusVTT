import React, { useCallback, useMemo, useState } from 'react';
import LocateFixed from 'lucide-react/dist/esm/icons/locate-fixed';
import Move from 'lucide-react/dist/esm/icons/move';
import Users from 'lucide-react/dist/esm/icons/users';
import { SceneCanvas } from '@/components/Scene/SceneCanvas';
import { useFollowDM, useGameStore } from '@/stores/gameStore';
import type { Scene } from '@/types/game';
import {
  gridDistanceFeet,
  isOwnedToken,
  isPointOnToken,
  tapDestination,
  type Point,
} from './mapGeometry';
import styles from './SimpleMapViewport.module.css';

export interface SimpleMapViewportProps {
  scene: Scene;
  userId: string;
  ownedCharacterIds: ReadonlySet<string>;
  /** Spectators: pan, zoom and Follow DM only. */
  readOnly?: boolean;
}

type InteractionMode = 'pan' | 'move-token';

interface PendingMove {
  destination: Point;
  feet: number;
}

/**
 * Touch-safe map for Simple Player Mode. One finger always pans; moving a
 * token is an explicit tap-to-move with a confirm step, dispatched through the
 * existing versioned `moveTokenOptimistic` path (server version conflicts roll
 * the move back as they do in the full VTT).
 */
export const SimpleMapViewport: React.FC<SimpleMapViewportProps> = ({
  scene,
  userId,
  ownedCharacterIds,
  readOnly = false,
}) => {
  const moveTokenOptimistic = useGameStore((s) => s.moveTokenOptimistic);
  const updateCamera = useGameStore((s) => s.updateCamera);
  const setFollowDM = useGameStore((s) => s.setFollowDM);
  const followDM = useFollowDM();

  const [mode, setMode] = useState<InteractionMode>('pan');
  const [pending, setPending] = useState<PendingMove | null>(null);

  const gridSize = scene.gridSettings?.size ?? 50;
  const snapToGrid = scene.gridSettings?.snapToGrid ?? true;

  const myToken = useMemo(
    () =>
      readOnly
        ? undefined
        : scene.placedTokens.find((token) =>
            isOwnedToken(token, userId, ownedCharacterIds),
          ),
    [readOnly, scene.placedTokens, userId, ownedCharacterIds],
  );
  const canMove = myToken !== undefined && !myToken.locked;

  const exitMoveMode = () => {
    setMode('pan');
    setPending(null);
  };

  const handleSceneTap = useCallback(
    (point: Point) => {
      if (!myToken || !canMove) return;
      if (mode === 'move-token') {
        const destination = tapDestination(point, {
          size: gridSize,
          snapToGrid,
        });
        setPending({
          destination,
          feet: gridDistanceFeet(myToken, destination, gridSize),
        });
      } else if (isPointOnToken(point, myToken, gridSize)) {
        setMode('move-token');
      }
    },
    [myToken, canMove, mode, gridSize, snapToGrid],
  );

  const centerOnMe = () => {
    if (!myToken) return;
    const size = gridSize * (myToken.scale || 1);
    setFollowDM(false);
    updateCamera({ x: myToken.x + size / 2, y: myToken.y + size / 2 });
  };

  const confirmMove = () => {
    if (!myToken || !pending) return;
    moveTokenOptimistic(scene.id, myToken.id, pending.destination);
    exitMoveMode();
  };

  return (
    <div className={styles.viewport} data-testid="simple-map-viewport">
      <SceneCanvas
        scene={scene}
        interactionProfile="simple"
        onSceneTap={handleSceneTap}
      />

      {mode === 'move-token' && !pending && (
        <p className={styles.hint} role="status">
          Tap where your token should go
        </p>
      )}

      {pending && (
        <div className={styles.confirm} role="group" aria-label="Confirm move">
          <span>Move here — {pending.feet} ft</span>
          <button
            type="button"
            className={styles.primary}
            onClick={confirmMove}
          >
            Confirm Move
          </button>
          <button type="button" onClick={exitMoveMode}>
            Cancel
          </button>
        </div>
      )}

      <div className={styles.hud}>
        <button
          type="button"
          aria-pressed={followDM}
          aria-label="Follow DM"
          onClick={() => setFollowDM(!followDM)}
        >
          <Users size={22} aria-hidden="true" />
        </button>
        {myToken && (
          <button
            type="button"
            aria-label="Center on My Token"
            onClick={centerOnMe}
          >
            <LocateFixed size={22} aria-hidden="true" />
          </button>
        )}
        {myToken && (
          <button
            type="button"
            aria-label="Move My Token"
            aria-pressed={mode === 'move-token'}
            disabled={!canMove}
            onClick={() =>
              mode === 'move-token' ? exitMoveMode() : setMode('move-token')
            }
          >
            <Move size={22} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
