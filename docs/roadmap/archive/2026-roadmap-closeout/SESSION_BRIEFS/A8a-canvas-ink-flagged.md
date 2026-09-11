# A8a — Canvas 2D ink renderer (behind flag)

track: A · risk: Med-High · gate: none (flag stays off; gate is at A8b cutover) · depends_on: [A4] · unblocks: [A8b]
budget_cap: 180k tokens (T2 ~100k / T3 ~40k)

## Objective
Migrate **committed drawing strokes** from SVG `<g>` paths to a Canvas 2D layer at `var(--z-drawing)`
(20), behind the A6a flag util. The in-progress stroke preview in DrawingTools stays SVG (ruling:
separate concern, revisit only if profiling demands). Ship dark with a T0 pixel-compare harness.

## Ground truth (verified @ e29131b, 2026-07-02)
- `src/components/Scene/DrawingRenderer.tsx`: renders drawings as SVG `<g>` per drawing (pencil polylines, shapes, spell overlays); visibility filter (`hidden` shown only to host via `useIsHost` + `visibility` field); a rAF ping animation lives here — keep it working (SVG or port it).
- Drawing shape (src/types, verify via drift check): `{ id, sceneId, type: 'pencil'|'rectangle'|'circle'|'polygon', points?/x/y/width/height, style: {color, thickness, opacity, lineJoin}, visibility, createdAt, updatedAt }`. **Note: no `'mask'` type exists** (CLAUDE.md is stale on this) and **no `drawingPersistenceV2.ts` exists** — only `src/services/drawingPersistence.ts` (compression + IndexedDB).
- After A4: `drawingsSlice` with narrow selector; the canvas layer subscribes to it and redraws the full layer on change (dirty-rect deferred — layer-level invalidation only: static until drawings change; camera moves the layer via the shared transform root, NOT via redraw).
- Camera integration: the canvas element lives inside the camera-transformed container (CSS transform from A3's shared root). Canvas backing store sized to viewport × dpr; world→canvas mapping via the same camera math — coordinate authority ADR-0002.
- Events unchanged: `drawing/create|update|delete|clear` (RELAY_EVENTS; `drawing/clear` is DM_ONLY).

## Drift check
```bash
rg -n "interface Drawing|type.*'pencil'" src/types/*.ts | head -5
ls src/services/drawingPersistence*.ts
rg -n "requestAnimationFrame" src/components/Scene/DrawingRenderer.tsx | head -3
ls src/utils/featureFlags.ts 2>/dev/null || echo "A6a flag util missing — introduce locally"
```

## Delegation plan
- T2: `CanvasInkLayer` component (draw all committed strokes via Path2D per drawing, cached in a `Map<id, Path2D>` — the cache is A8b's hit-testing foundation; host-visibility filter preserved; dpr-aware).
- T0: pixel-compare harness — script renders N sample drawings (export from a real session's IndexedDB or synthesize all 4 types × 3 styles) through BOTH paths to PNG (playwright screenshot per path), `pixelmatch` diff, threshold <1% differing pixels excluding antialias edges.
- T3: review compression/persistence interplay (decompressed points feed Path2D identically) and the harness results.

## Exit criteria
- Flag ON: all drawing types render on canvas; host-only visibility respected; ping animation works; zoom 0.3–3.0 stays crisp (dpr handling).
- Flag OFF: SVG path untouched, zero regressions (tests + screenshot).
- Pixel-compare harness report committed under `tools/ink-compare/` with results <1% diff on the sample set.
- Selection of drawings still works flag-ON via the temporary fallback: SVG hit-rects OR selection disabled with a visible "editing requires legacy mode" notice — **choose the fallback explicitly and record it in the handoff** (A8b removes it).
- type-check / lint / test pass.

## Rollback
Flag off (runtime). Branch revert.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
