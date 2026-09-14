# Grid and coordinate systems

The scene uses world coordinates. One world unit is one background-image pixel
at zoom `1`. Camera coordinates identify the world point at the centre of the
viewport; they are not a top-left pan offset. This convention is the key
constraint behind every placement, drag, drawing, measurement, and fog tool.

## Coordinate authority

`src/utils/sceneUtils.ts` owns the viewport-centred transforms:

```text
screen.x = (world.x - camera.x) * camera.zoom + viewport.width / 2
screen.y = (world.y - camera.y) * camera.zoom + viewport.height / 2

world.x = (screen.x - viewport.width / 2) / camera.zoom + camera.x
world.y = (screen.y - viewport.height / 2) / camera.zoom + camera.y
```

Screen coordinates passed to these functions are relative to the scene
viewport, not the browser window. Use the existing helpers instead of reading
an SVG transform or reproducing the formula:

- `screenToWorld` and `worldToScreen` convert with a supplied camera.
- `clientToWorld` subtracts an element's bounding rectangle before converting.
- `screenToWorldLive` reads `cameraRef` during an active gesture, when the
  Zustand camera can be one frame behind an imperative pan or zoom.
- `cameraTransform` produces the transform used by the scene camera root.
- `viewportWorldRect` returns the visible viewport in world units.

One-shot operations should use the committed store camera. Mid-gesture code
should use the live-camera variant. `SceneCanvas`, `useTransientDrag`,
`fogGestureEngine`, `MeasurementTool`, and `SelectionOverlay` demonstrate the
two cases.

## Grid model

Each `Scene` stores its own `gridSettings`. The renderer supports square and
flat-top hex grids, with a cell size, colour, opacity, visibility flag, snapping
flag, X/Y alignment offsets, and a hex scale. Hex grids use axial `(q, r)`
coordinates in `src/utils/hexMath.ts`; difficult terrain is also stored as
axial cells.

`SceneGrid` renders only the visible world region plus a small margin. Square
lines are aligned to `offsetX` and `offsetY`. Hex centres and vertices come from
`hexToPixel` and `hexVertices`.

The measurement tool assumes five feet per square or hex. Square diagonals use
the alternating 5/10-foot rule in `calculateDiagonalDistance`. Hex distance is
cube distance; if the sampled line crosses any marked difficult-terrain hex,
the current implementation doubles the whole measured distance.

## Snapping caveat

ADR-0002 names `sceneUtils.snapToGrid` as the snapping authority, but the code
has not fully converged on that rule. The helper handles an un-offset square
grid. Hex- and offset-aware snapping exists in `mathUtils.snapToGrid` and in a
few placement call sites. `TokenDropZone` handles both offsets and hexes,
whereas `useDockToCanvasDrag` calls the simpler `sceneUtils` helper and ignores
offsets. Treat this as current implementation drift: do not add another
formula, and prefer consolidating existing callers when changing snapping.

## Tests and source map

- Decision: `docs/roadmap/ADR/0002-coordinate-authority.md`
- Camera and conversion helpers: `src/utils/sceneUtils.ts`,
  `src/utils/cameraRef.ts`
- Square and hex math: `src/utils/mathUtils.ts`, `src/utils/hexMath.ts`
- Rendering and gestures: `src/components/Scene/SceneCanvas.tsx`,
  `src/components/Scene/SceneGrid.tsx`, `src/hooks/useTransientDrag.ts`
- Tests: `src/hooks/useTransientDrag.test.ts`,
  `src/components/Scene/renderIsolation.test.tsx`
