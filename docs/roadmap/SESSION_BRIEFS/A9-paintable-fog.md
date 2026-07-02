# A9 — Paintable Fog of War

track: A · risk: Med · gate: **blocking 🔍** (new player-facing layer) · depends_on: [A4, A5] · unblocks: [A10]
budget_cap: 160k tokens (T2 ~90k / T3 ~40k)

## Objective
Net-new feature: DM-paintable fog on a Canvas 2D layer at `var(--z-fog)` (40), above tokens,
below UI. `destination-out` compositing for revealed areas. DM sees fog at ~50% opacity with
hidden content visible; players see opaque fog. Token-vision fog is explicitly OUT of scope
(deferred, ADR-0009).

## Ground truth (verified @ e29131b, 2026-07-02)
- **No fog code exists anywhere.** No `'mask'` drawing type exists (CLAUDE.md stale). This is greenfield inside the A4/A5 architecture.
- State: populate the reserved `fogSlice` from A4 — per scene: `{ enabled: boolean, shapes: FogShape[] }` where FogShape = `{ id, kind: 'reveal'|'conceal', geometry: polygon|rect|brush-stroke points, createdAt }`. Model fog as **conceal-all + reveal shapes** (Owlbear's model) rather than freeform paint-only — simpler sync, deterministic replay.
- Sync: **new event family `fog/*` requires server changes** — add `'fog/update'`, `'fog/clear'` (and if incremental: `'fog/reveal'`) to RELAY_EVENTS in `server/socket/handlers/EntitySyncHandler.ts` (~line 18) and to DM_ONLY_EVENTS (fog is host-authored; `drawing/clear` at ~line 51 is the precedent). Client: add handlers to gameStore's event registry (pattern: `'token/place'` handler at gameStore.ts:683).
- Persistence: fog state rides `sceneState`→`gameState` JSONB persistence to PostgreSQL (sessions table) like tokens do — verify serialization includes the new slice (A4's persistence test is the template).
- Tools UI: fog brush/rect/polygon reveal tools join `GameToolbar` (`src/components/GameToolbar.tsx`, groups pattern in `toolbar-unified.css`) as a host-only group.
- Rendering: same canvas conventions as A8a (dpr, camera-root transform, layer-level invalidation — redraw only on fogSlice change).

## Drift check
```bash
rg -n "fog" src server --ignore-case -l | head -5   # expect: nothing (greenfield)
sed -n '15,55p' server/socket/handlers/EntitySyncHandler.ts
ls src/stores/scene/ && rg -n "fogSlice|fog" src/stores/scene/ 2>/dev/null | head -3
```

## Delegation plan
- T2 #1 (server + store): fog events end-to-end (RELAY + DM_ONLY registration, gameStore handlers, fogSlice actions, persistence).
- T2 #2 (rendering + tools): `FogLayer` canvas component + toolbar group + DM/player opacity split.
- T3: review the DM-only enforcement server-side (a malicious player must not be able to send fog/update — copy drawing/clear's enforcement) and the gate packet.

## Exit criteria (gate evidence)
- Two-tab smoke: host paints conceal + reveals an area → player tab shows opaque fog with the reveal hole; host tab shows 50% translucent fog.
- Player tab CANNOT alter fog (attempt via devtools sendEvent → server rejects; show the rejection log).
- Refresh mid-session: fog state restores from persistence (both roles).
- Token move under fog: profiler shows FogLayer does NOT re-render (fog reads fogSlice only — the A5 guarantee extended).
- type-check / lint / test pass; screen recording of the paint→reveal flow attached.

## Rollback
Feature is additive behind `fogSlice.enabled` per scene (default off). Branch revert clean; fog events unknown to old clients are ignored by the registry pattern.

Handoff & close-out: RESUME_PROTOCOL.md §4–5. **Pause for Joel's review.**
