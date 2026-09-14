# Drawing and ink

Scene drawings cover freehand ink, geometric shapes, notes, measurements,
area-of-effect guides, spell overlays, pings, and older DM mask types. Stored
drawings use world coordinates and live in `Scene.drawings`.

## Tools and drawing records

The main toolbar exposes select/move, pan, measure, ping, pencil, line,
rectangle, circle, cone, eraser, note, and six spell-overlay shapes. The type
model contains additional AoE and DM-only variants that are not all first-class
toolbar entries.

Every persisted drawing has an ID, type, style, layer, room, creator, and
timestamps plus type-specific geometry. Style includes fill and stroke data and
player/DM visibility. Measurements are temporary interaction data rather than
members of the persisted `Drawing` union.

`DrawingTools` owns active gestures and previews. It converts client input
through `sceneUtils`, creates one record when the gesture completes, and uses
SVG for the in-progress preview. Selection, transforms, property editing, and
deletion operate on the committed record.

## Why ink uses Canvas 2D

Committed pencil, line, rectangle, circle, and polygon records render only in
`CanvasInkLayer`. Their `Path2D` geometry is cached in
`src/components/Scene/inkHitTest.ts` and shared between painting and JavaScript
hit testing. There is no invisible SVG hit-test twin. Tolerance is adjusted for
zoom so a thin stroke remains selectable.

Text, cones, AoEs, spell overlays, pings, and the legacy fog mask still render
as SVG in `DrawingRenderer`, where element-level markup and interaction are a
better fit. The Canvas/SVG split is by drawing type, not by persistence model:
both consume the same scene array.

The current ink canvas schedules continuous animation-frame paints while
mounted. That is an implementation detail, not a requirement to copy; the
accepted layer architecture prefers invalidation when the layer changes.

## Visibility, sync, and durability

Hosts see every drawing. Player rendering excludes the `dm-only` layer,
`dmNotesOnly` drawings, and drawings with `visibleToPlayers: false`.

Create, update, delete, and clear are durable ordered events. Clearing is
host/co-host only. Other drawing mutations are permitted for players while the
host is connected, but `EntitySyncHandler` does not validate drawing ownership.
All drawing mutations also update the containing scene, schedule local
IndexedDB save, and enter the host's canonical PostgreSQL snapshot.

## Source map

- Model: `src/types/drawing.ts`
- Gestures and previews: `src/components/Scene/DrawingTools.tsx`
- Canvas path: `src/components/Scene/CanvasInkLayer.tsx`,
  `src/components/Scene/inkHitTest.ts`
- SVG path: `src/components/Scene/DrawingRenderer.tsx`
- State and transport: `src/stores/gameStore.ts`,
  `server/socket/handlers/EntitySyncHandler.ts`
