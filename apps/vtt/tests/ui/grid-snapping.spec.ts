import type { SceneState } from '../../src/types/game';
import { favoriteOrListedPanel } from '../support/panelDock';
import { expect, gotoGame, test } from './support/gameFixture';

type Position = { x: number; y: number };
type Move = (sceneId: string, tokenId: string, position: Position) => void;
interface GridTestWindow {
  __gameStore: {
    getState: () => { sceneState: SceneState; moveToken: Move };
    setState: (state: {
      sceneState?: SceneState;
      moveTokenOptimistic?: Move;
    }) => void;
  };
  gridMoveCount: number;
}

const grids = [
  {
    type: 'square',
    anchor: { x: -135, y: -38 },
    destination: { x: -235, y: -138 },
  },
  {
    type: 'hex',
    anchor: { x: -105, y: 12 - 40 * Math.sqrt(3) },
    destination: { x: -225, y: 12 - 120 * Math.sqrt(3) },
  },
] as const;

for (const { type, anchor, destination } of grids) {
  test(
    'Atlas placement and drag share ' + type + ' grid anchors',
    async ({ page }) => {
      await gotoGame(page);
      await page.evaluate((type) => {
        const fixture = window as unknown as GridTestWindow;
        const store = fixture.__gameStore;
        const { sceneState, moveToken } = store.getState();
        fixture.gridMoveCount = 0;
        store.setState({
          moveTokenOptimistic: (...args) => {
            fixture.gridMoveCount++;
            // This fixture has no server. Apply the move as an acknowledged client would.
            moveToken(...args);
          },
          sceneState: {
            ...sceneState,
            camera: { x: -150, y: 20, zoom: 1.25 },
            scenes: sceneState.scenes.map((scene) => ({
              ...scene,
              gridSettings: {
                ...scene.gridSettings,
                type,
                size: type === 'hex' ? 20 : 50,
                hexScale: 2,
                offsetX: 15,
                offsetY: 12,
                snapToGrid: true,
              },
            })),
          },
        });
      }, type);

      const toScreen = (point: Position) =>
        page
          .locator('g.scene-content')
          .evaluate((world: SVGGElement, { x, y }) => {
            const point = new DOMPoint(x, y).matrixTransform(
              world.getScreenCTM()!,
            );
            return { x: point.x, y: point.y };
          }, point);
      const placed = () =>
        page.evaluate(() => {
          const fixture = window as unknown as GridTestWindow;
          const token =
            fixture.__gameStore.getState().sceneState.scenes[0]
              ?.placedTokens[0];
          return token
            ? { x: token.x, y: token.y, moves: fixture.gridMoveCount }
            : null;
        });
      const assertPosition = async (position: Position, moves: number) => {
        await expect
          .poll(async () => {
            const token = await placed();
            return (
              token && [
                Math.round((token.x - position.x) * 1e6),
                Math.round((token.y - position.y) * 1e6),
                token.moves,
              ]
            );
          })
          .toEqual([0, 0, moves]);
      };

      await (await favoriteOrListedPanel(page, 'Atlas Studio')).click();
      const atlas = page.getByRole('dialog', {
        name: 'Atlas Studio',
        exact: true,
      });
      await atlas
        .getByRole('textbox', { name: 'Search Atlas assets' })
        .fill('Soldier');
      const asset = await atlas
        .getByText('Soldier', { exact: true })
        .boundingBox();
      expect(asset).not.toBeNull();
      const drop = await toScreen({ x: anchor.x + 7, y: anchor.y - 5 });
      await page.mouse.move(
        asset!.x + asset!.width / 2,
        asset!.y + asset!.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(drop.x, drop.y, { steps: 8 });
      await page.mouse.up();
      await assertPosition(anchor, 0);
      await atlas.getByRole('button', { name: 'Close panel' }).click();

      const move = async (from: Position, to: Position, priorMoves: number) => {
        // Start on the visible lower half so a selected token's toolbar
        // can keep its own hit target above the token.
        const grabOffset = 6;
        const start = await toScreen({ x: from.x, y: from.y + grabOffset });
        const end = await toScreen({ x: to.x + 7, y: to.y + grabOffset - 5 });
        const target = await page.evaluate(
          ({ x, y }) =>
            document
              .elementFromPoint(x, y)
              ?.closest('.drawing-tools')
              ?.classList.contains('drawing-tools'),
          start,
        );
        expect(target).toBe(true);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 7 });
        await assertPosition(from, priorMoves);
        await page.mouse.up();
        await assertPosition(to, priorMoves + 1);
      };
      await move(anchor, destination, 0);
      await move(destination, anchor, 1);
    },
  );
}
