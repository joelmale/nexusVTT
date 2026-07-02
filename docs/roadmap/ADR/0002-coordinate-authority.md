# ADR-0002 — Coordinate authority: sceneUtils; camera is viewport-centered

Status: **Accepted** (Joel, 2026-07-02)

## Context
Two independent agents designed coordinate math from the same digest and both got it wrong,
because the camera transform is non-obvious: `SceneCanvas.tsx` (~line 745) applies
`translate(w/2 − cam.x·zoom, h/2 − cam.y·zoom) scale(zoom)` — `camera.x/y` is the world point
at the viewport **center**, not a top-left pan offset.

## Decision
`sceneUtils.screenToWorld / worldToScreen / snapToGrid` (`src/utils/sceneUtils.ts` ~285) are the
ONLY conversion implementations. Signature: screen coords relative to the SVG rect; viewport =
rect dimensions. Nobody hand-rolls inverse math; nobody reads the SVG `transform` attribute.
For mid-gesture use (transient drag/pan), a `screenToWorldLive` variant reading the live camera
ref (A3) extends sceneUtils — same module, same math, different camera source.

## Consequences
- Dock drag-drop (C5), token drag (A2), selection, and future tools all share one source of truth.
- World-space unit = scene pixels at zoom 1 (background image natural pixels).
- Any layer-tech migration (tokens out of SVG) must preserve sceneUtils' semantics, which is why
  reading the transform attribute is banned.
