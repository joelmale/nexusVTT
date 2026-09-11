# A8b — Ink hit-testing + cutover

track: A · risk: Med · gate: **blocking 🔍** (cutover) · depends_on: [A8a] · unblocks: [A10]
budget_cap: 140k tokens (T2 ~70k / T3 ~40k)

## Objective
Restore full drawing selection on the canvas ink layer via JS hit-testing (`Path2D.isPointInPath`
/ `isPointInStroke` — ruling ADR-0009: no invisible DOM twin layer), integrate with
SelectionOverlay, then cut over: flag defaults ON, SVG committed-stroke path deleted, flag removed.

## ⚠️ S8 T3 ruling on gate evidence (supersedes the pixel-harness references below)
A8a shipped `tools/ink-compare/index.html` — a MANUAL side-by-side compare page, not the
automated <1%-diff harness the A8a brief specified. Accepted substitute for this gate:
**Joel performs a manual visual sign-off on the full sample set (all 4 drawing types × 3
styles, at zoom 0.3/1.0/3.0) using that page, recorded in the gate approval note.**
Alternatively the executor may upgrade the page to an automated pixelmatch assertion —
optional, not required. Do not treat "harness re-run <1%" below as literal.

## Ground truth (verified @ e29131b, 2026-07-02 — re-verify against A8a's landed shape)
- A8a delivered `CanvasInkLayer` with a `Map<id, Path2D>` cache and recorded its selection fallback in its handoff (read A8a's SESSION_STATE entry + PR).
- `src/components/Scene/SelectionOverlay.tsx`: SVG selection boxes + resize/drag handles; converts screen→scene coords on mousemove; selection state is component-local (pre-existing pattern, fine).
- Hit-test spec: on canvas click, iterate `tokenOrder`-equivalent drawing order **top-down**; for stroked types use `ctx.isPointInStroke(path2d, x, y)` with `lineWidth = style.thickness + tolerance(8/zoom)`; for filled shapes `isPointInPath`. Point in world space (ADR-0002 conversion).
- Drawing mutations flow through existing `drawing/update`/`drawing/delete` events.

## Drift check
```bash
rg -n "Path2D" src/components/Scene/ -l
rg -n "isPointInStroke|isPointInPath" src -l
rg -n "SelectionOverlay" src/components/Scene/SceneCanvas.tsx | head -3
```

## Delegation plan
- T2: hit-test module (`src/components/Scene/inkHitTest.ts`), click-routing in SceneCanvas (tokens keep DOM hit-testing; canvas layer consulted only when no token hit), SelectionOverlay wiring (selected drawing's bounds from Path2D bounding box or stored geometry).
- T3: cutover review — the gate evidence is the full regression checklist below, plus sign-off to delete the SVG path.

## Exit criteria (gate evidence)
- Click-select works for all 4 drawing types at zoom 0.3 / 1.0 / 3.0 (tolerance scales with zoom).
- Multi-select, move, resize, delete of drawings all work; two-tab multiplayer smoke green.
- Overlapping drawings: top-most wins (z-order verified with 3 stacked shapes).
- Flag removed from code; SVG committed-stroke rendering deleted; `rg -n "flag.*ink|ink.*flag" src` → 0.
- A8a pixel-harness re-run on final code: still <1% diff.
- type-check / lint / test pass.

## Rollback
This packet deletes the fallback — rollback = branch revert BEFORE merge (restores flag + SVG path). After merge, rollback is a forward-fix; hence the blocking gate.

Handoff & close-out: RESUME_PROTOCOL.md §4–5. **Pause for Joel's review before merge.**
