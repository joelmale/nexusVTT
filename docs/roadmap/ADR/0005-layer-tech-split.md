# ADR-0005 — Layer tech split: SVG background/grid, DOM tokens, Canvas ink+fog

Status: **Accepted** (Joel, 2026-07-02)

## Context
Rendering is one master SVG with DOM `<img>` tokens nested inside SVG groups (CLAUDE.md's canvas
claims are stale). Perceived jank traced to over-subscription (any store write re-renders the
scene tree), not to SVG itself.

## Decision
Target stack (bottom→top): Background **SVG** → Grid **SVG** → Drawing/ink **Canvas 2D**
(committed strokes; A8a/b) → Tokens/props **plain DOM** (out of the SVG) → Fog **Canvas 2D**
(A9) → UI **DOM**. One camera-root element carries the transform for all layers (one imperative
write per frame during gestures). State: per-layer Zustand slices 1:1 with layers (A4); the
invariant "a token move never re-renders the grid" is enforced by selector isolation (A5) and
proven by profiler trace. Invalidation is layer-level (static-until-changed), not dirty-rect —
revisit only if profiling demands.

## Consequences
- No big-bang rewrite: SVG stays where it's already correct; only ink and fog earn canvas.
- DrawingTools' in-progress preview stays SVG (separate concern from committed strokes).
- Fog reads tokens via a memoized projection; tokens never know fog exists.
