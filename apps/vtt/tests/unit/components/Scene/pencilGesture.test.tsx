import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrawingTools } from '../../../../src/components/Scene/DrawingTools';
import { useGameStore } from '@/stores/gameStore';
import { drawingPersistenceService } from '@/services/drawingPersistence';
import { webSocketService } from '@/services/websocket';
import type { Scene } from '@/types/game';

// Same conventions as src/stores/fog.test.ts — network + persistence mocked.
vi.mock('@/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn().mockReturnValue(true),
    sendEvent: vi.fn(),
    sendGameStateUpdate: vi.fn(),
  },
}));
vi.mock('@/services/drawingPersistence', () => ({
  drawingPersistenceService: {
    saveScene: vi.fn().mockResolvedValue(undefined),
    loadScene: vi.fn().mockResolvedValue(null),
  },
}));

/**
 * End-to-end pencil gesture regression test (A8b gate finding, S13).
 *
 * The freehand pencil was broken by TWO stacked, never-tested bugs:
 *  1. the toolbar dispatched activeTool='draw', which no handler listens to;
 *  2. pencil's mousedown override skipped setStartPoint, so the mouseup
 *     commit guard (`!isDrawing || !startPoint`) silently discarded every
 *     stroke.
 * This test drives the REAL DrawingTools interaction rect through a full
 * down → move → move → up gesture and asserts a pencil drawing lands in the
 * store — guarding the whole pipeline, not just the dispatch map.
 */
const SCENE_ID = 'pencil-test-scene';

const makeScene = (): Scene =>
  ({
    id: SCENE_ID,
    name: 'Pencil Test',
    drawings: [],
    placedTokens: [],
    placedProps: [],
    gridSettings: { size: 50, snapToGrid: false },
  }) as unknown as Scene;

const drawingStyle = {
  strokeColor: '#ff0000',
  strokeWidth: 3,
  fillColor: 'transparent',
  fillOpacity: 0.5,
  dmNotesOnly: false,
  visibleToPlayers: true,
};

describe('pencil gesture → committed drawing', () => {
  beforeEach(() => {
    // vitest.config.ts sets mockReset:true, which wipes implementations set
    // inside vi.mock factories before every test — re-arm here (documented
    // repo gotcha; see gameStore.persistence.test.ts convention).
    vi.mocked(drawingPersistenceService.saveScene).mockResolvedValue(undefined);
    vi.mocked(webSocketService.isConnected).mockReturnValue(true);
    useGameStore.setState((state) => {
      state.sceneState.scenes = [makeScene()];
      state.sceneState.activeSceneId = SCENE_ID;
      state.sceneState.activeTool = 'pencil';
    });
  });

  it('commits a pencil drawing with the dragged points on mouseup', () => {
    const svgEl = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    const { container } = render(
      <svg>
        <DrawingTools
          activeTool="pencil"
          drawingStyle={drawingStyle}
          camera={{ x: 0, y: 0, zoom: 1 }}
          _gridSize={50}
          svgRef={{ current: svgEl }}
          snapToGrid={false}
          selectedObjectIds={[]}
          setSelection={() => {}}
          clearSelection={() => {}}
          sceneId={SCENE_ID}
          spellElementType="arcane"
          spellGridSnap={true}
        />
      </svg>,
    );

    // The oversized transparent interaction rect owns the gesture handlers.
    const rect = container.querySelector('rect[width="20000"]');
    expect(rect, 'interaction rect must render for the pencil tool').not.toBeNull();

    fireEvent.mouseDown(rect!, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.mouseMove(rect!, { clientX: 40, clientY: 25 });
    fireEvent.mouseMove(rect!, { clientX: 80, clientY: 60 });
    fireEvent.mouseUp(rect!, { clientX: 80, clientY: 60 });

    const drawings = useGameStore
      .getState()
      .sceneState.scenes.find((s) => s.id === SCENE_ID)!.drawings;

    expect(drawings).toHaveLength(1);
    const pencil = drawings[0];
    expect(pencil.type).toBe('pencil');
    // down + 2 moves accumulate at least 3 points
    expect(
      (pencil as { points: Array<{ x: number; y: number }> }).points.length,
    ).toBeGreaterThanOrEqual(3);
    // shape tools reset to select after committing
    expect(useGameStore.getState().sceneState.activeTool).toBe('select');
  });
});
