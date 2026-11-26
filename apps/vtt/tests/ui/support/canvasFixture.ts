import type { Page } from '@playwright/test';
import type { SceneState, User } from '../../../src/types/game';

export interface CanvasTestWindow {
  __gameStore: {
    getState: () => { sceneState: SceneState; user: User };
    setState: (state: { sceneState: SceneState }) => void;
  };
}

export const CANVAS_TOKEN_ID = 'ui-canvas-token';

export function selectedCanvasObjects(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as CanvasTestWindow).__gameStore.getState().sceneState
        .selectedObjectIds,
  );
}

export async function seedCanvasScene(page: Page, revealCentre = false) {
  await page.route('**/ui-canvas-map.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1800"><path fill="#e72b4e" d="M0 0h2400v1800H0z"/></svg>',
    }),
  );

  await page.evaluate(
    ({ tokenId, revealCentre }) => {
      const store = (window as unknown as CanvasTestWindow).__gameStore;
      const { sceneState, user } = store.getState();
      const scene = sceneState.scenes[0]!;
      const now = Date.now();
      store.setState({
        sceneState: {
          ...sceneState,
          scenes: [
            {
              ...scene,
              backgroundImage: {
                url: '/ui-canvas-map.svg',
                width: 2400,
                height: 1800,
                offsetX: -1200,
                offsetY: -900,
                scale: 1,
              },
              gridSettings: { ...scene.gridSettings, enabled: false },
              fog: {
                enabled: true,
                shapes: revealCentre
                  ? [
                      {
                        id: 'ui-fog-reveal',
                        kind: 'reveal',
                        shape: 'rect',
                        points: [
                          { x: -40, y: -40 },
                          { x: 40, y: 40 },
                        ],
                        createdAt: now,
                      },
                    ]
                  : [],
              },
              placedTokens: [
                {
                  id: tokenId,
                  tokenId: 'default-token-10',
                  roomCode: scene.roomCode,
                  sceneId: scene.id,
                  visibleToPlayers: true,
                  dmNotesOnly: false,
                  layer: 'tokens',
                  x: 0,
                  y: 0,
                  scale: 1,
                  rotation: 0,
                  conditions: [],
                  placedBy: user.id,
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            },
          ],
        },
      });
    },
    { tokenId: CANVAS_TOKEN_ID, revealCentre },
  );
}
