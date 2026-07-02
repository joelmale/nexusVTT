# ADR-0007 — The map owns the viewport; all chrome overlays, nothing reflows

Status: **Accepted** (Joel, 2026-07-02)

## Context
The legacy layout grid hard-allocates a 300px sidebar column and 108px of vertical chrome;
the map architecturally cannot be full-screen. "Get the UI out of the way of the map."

## Decision
`.game-layout` becomes a single grid cell (behind the A6a flag until proven). Every chrome
surface — floating panels, icon dock, scene pill, GameToolbar, the Atlas dock — is
absolutely/fixed positioned over the map, portal-mounted where appropriate, animated with
transform/opacity only (never height/layout properties). The Atlas dock specifically is
`position:fixed; bottom:0` with `translateY` states (closed pill / peek / open) and reserves
zero layout space.

## Consequences
- Canvas rect is invariant across all UI states (exit criteria assert this).
- z-scale (ADR-0004) is the only stacking arbiter between overlays.
- Panel content designed for ~320px floating width; panels needing more (Chat's legacy 800px)
  get scroll/responsive treatment, not reserved columns.
