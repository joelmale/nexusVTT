# ADR-0008 — Pointer-event DnD; hand-rolled grid virtualization

Status: **Accepted** (Joel, 2026-07-02)

## Context
Dock→canvas drag needs a mechanism; the thumbnail grid must handle 16k+ items.

## Decision
1. **Pointer events, not HTML5 Drag & Drop**: the canvas already owns a pointer-event gesture
   model; HTML5 DnD would add a parallel event system (dataTransfer, dragover bookkeeping) with
   OS-rendered ghosts we can't style. Pointer capture + rAF-driven custom ghost + hit-test on
   pointerup, sharing the transient-gesture discipline of A2.
2. **Hand-rolled virtualization**: uniform-size cards + `content-visibility: auto` +
   IntersectionObserver sentinel for cursor pagination. No react-window/react-virtual dependency
   (React 19 peer-range risk at decision time; trivial manual math for uniform grids).

## Consequences
- One gesture vocabulary across canvas and dock; Escape-cancel works uniformly.
- Zero new runtime dependencies for the grid; revisit only if variable-height cards appear.
