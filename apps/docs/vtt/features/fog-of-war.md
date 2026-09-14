# Fog of war

Paintable fog is a per-scene conceal-all model. When fog is enabled, the
visible viewport is covered and the union of recorded reveal shapes is cut out.
It is deliberately not token vision, line-of-sight, or dynamic lighting.

## State model

`Scene.fog` is optional. When present it contains an `enabled` flag and an
array of `FogShape` records. A shape is either:

- a rectangle with two world-coordinate corner points; or
- a brush polyline with world-coordinate points and an optional brush width.

Every shape has a stable ID and creation timestamp. There are no incremental
conceal strokes: clearing removes all reveal shapes, so enabled fog with an
empty shape array conceals everything. This is separate from the legacy
`Drawing` subtype named `fog-of-war`, which implements polygon mask controls
and still renders through `DrawingRenderer`.

## Host workflow and rendering

The Fog toolbar is host-only. It can toggle fog, draw rectangular or freehand
reveals, and clear all reveals after confirmation. `fogGestureEngine` converts
pointer input with the live camera and commits one shape at the end of a
gesture. The SVG preview is transient and is not stored.

`FogLayer` is a Canvas 2D surface embedded above tokens and props. It paints a
large conceal rectangle, then uses `destination-out` composition to punch out
the reveals. Players receive an opaque cover; hosts receive a half-opacity
cover so they can still see concealed content. The canvas is non-interactive;
the host-only SVG capture layer owns pointer events.

Fog subscribes only to its scene's fog object. Token and drawing changes do
not invalidate it. Unlike the committed ink layer, fog redraws when its state,
camera, viewport, or role changes rather than on every animation frame.

## Sync, authorization, and persistence

`setFogEnabled` and `addFogShape` apply locally, schedule canonical state sync,
and send `fog/update` containing the complete `SceneFog`. `clearFog` sends
`fog/clear`. Full replacement makes reconnect and late application
deterministic without merging stroke deltas.

Both events are durable and host/co-host only in `EntitySyncHandler`. They are
not entity-versioned. Fog also rides the scene array in
`buildGameStateProjection`, so PostgreSQL persists it as part of the canonical
game-state transaction.

## Source map

- Product decision:
  `apps/docs/vtt/roadmap/ADR/0009-consolidated-ux-rulings.md`
- Historical implementation brief:
  `apps/docs/vtt/roadmap/archive/2026-roadmap-closeout/SESSION_BRIEFS/A9-paintable-fog.md`
- Model and state: `src/types/fog.ts`, `src/stores/scene/fogSlice.ts`,
  `src/stores/gameStore.ts`
- Gesture and renderer: `src/utils/fogGestureEngine.ts`,
  `src/components/Scene/FogLayer.tsx`, `src/components/Scene/SceneCanvas.tsx`
- Tests: `src/stores/fog.test.ts`,
  `src/components/Scene/FogLayer.test.tsx`
