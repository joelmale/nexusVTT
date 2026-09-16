# Nexus VTT — UI/UX Modernization Roadmap

## Context

A UI/UX review proposed seven modernization items. Three of its premises turned out to be wrong against the actual code, and its suggested priority order was close to inverted: it led with tear-off panels and "cinematic mode" and buried canvas navigation as polish. In fact the canvas camera is the weakest part of the product — zoom is centre-anchored, ignores `deltaY` magnitude, and has no `ctrlKey` branch, and the canvas has no touch handling at all, so tablets cannot pan or zoom. Those are the things every user touches within ten seconds.

This plan reorders the work so the cheap, universal fixes land first, then the panel-system work that unlocks workspaces, then the expensive layout work last.

**Item 3 is not greenfield.** Multi-panel wiring and a `WindowPortal` tear-off already landed in the working tree. Type-check and the 18 existing unit tests pass, but the tests were only mechanically updated for renamed props — there is no coverage for the new behaviour, and the tear-off has a render-loop bug that makes it self-destruct. Item 3 is therefore scoped as *harden and fix what landed*, not *build it*.

**Decisions taken**:
- Keep tear-off pop-out; repair it rather than reverting.
- Touch support is **pan/zoom only** — token dragging and drawing stay mouse/pointer as they are.
- Focus mode is a **hotkey toggle only** — no edge-hover reveal.

---

## ~~Item 1 — Cursor-anchored zoom, ctrl/trackpad split, deltaY magnitude~~ *(Completed)*

~~**Problem.** `cameraGestureEngine.wheelZoom(deltaY)` (`apps/vtt/src/utils/cameraGestureEngine.ts:161`) uses `deltaY` only for its sign, applies a fixed `0.9`/`1.1` step, and leaves `camera.x/y` untouched — so zoom is anchored at the viewport centre and you cannot zoom toward a corner.
`SceneCanvas.handleWheel` (`apps/vtt/src/components/Scene/SceneCanvas.tsx:484`) discards `e.ctrlKey` and `e.deltaMode`, so two-finger trackpad *scroll* (which should pan) zooms instead, in a burst of events.~~

~~**Approach.**~~

~~1. **Give the engine a viewport.** The engine never sees the SVG size today — `svgSize` is captured only inside the `applyTransform` closure. Add `getViewportRect(): DOMRect | {width, height}` to `CameraGestureEngineOptions` (`cameraGestureEngine.ts:7`) and supply it from the existing `svgSize` state + `svgRef` in the `sync()` call at `SceneCanvas.tsx:832`.~~
~~2. **Widen `wheelZoom` to `wheelZoom(deltaY, clientX, clientY)`** and make it cursor-anchored. Reuse `sceneUtils.screenToWorldLive(sx, sy, vw, vh)` (`apps/vtt/src/utils/sceneUtils.ts:334`) — it is the `cameraRef`-aware mid-gesture variant and is explicitly documented for this use. Derive the world point under the cursor *before* changing zoom, then solve for the camera that keeps it fixed. Given the viewport-centred model in `sceneUtils`: `cam' = worldAtCursor - (cursorScreen - viewport/2) / zoom'`. Do **not** re-derive the transform formula — `sceneUtils.cameraTransform` (`:368`) stays the single source.~~
~~3. **Use `deltaY` magnitude.** Replace the fixed step with an exponential map, e.g. `zoom * Math.exp(-normalizedDelta * SENSITIVITY)`, normalising for `deltaMode` (`0` = pixel, `1` = line ≈ 16px, `2` = page ≈ viewport height). Keep the existing `minZoom`/`maxZoom` clamp.~~
~~4. **Split ctrl/trackpad.** In `handleWheel`: `e.ctrlKey` (pinch-zoom on a trackpad, which the browser reports as ctrl+wheel) → zoom; plain wheel with a non-trivial `deltaX` or a small `deltaY` → pan by the raw delta; mouse wheel → zoom. A pragmatic discriminator is `e.ctrlKey || (Math.abs(deltaY) >= WHEEL_MOUSE_THRESHOLD && deltaX === 0)`.~~
~~5. **Native listener for `preventDefault`.** `onWheel` at `SceneCanvas.tsx:1119` is a React synthetic handler, which React attaches **passively** at the root — `preventDefault()` is a no-op there, so browser page-zoom on ctrl+wheel cannot be suppressed. Attach a native `wheel` listener with `{ passive: false }` to `svgRef.current` in a `useEffect` and drop the `onWheel` prop. This is the first native listener of its kind in the app; mirror the cleanup discipline in the existing `ResizeObserver` effect at `SceneCanvas.tsx:805`.~~
~~6. **Route the toolbar buttons through the engine.** `GameToolbar.tsx:106` writes the camera directly (×1.2, clamp 0.1–5.0) bypassing the engine, so it neither broadcasts nor commits the same way. Point it at the engine anchored on the viewport centre so there is one zoom path.~~

~~**Preserve.** Gating stays as-is: zoom only in `pan`/`select` tools, and `if (!isHost && followDM) return`. The commit contract in `endGestureIfIdle` (`:105`) — zero store writes mid-gesture, one `onCommit` + one unthrottled `onBroadcast` at the end — must not change.~~

~~**Tests.** Extend the `makeEngine` factory in `cameraGestureEngine.test.ts:29` to inject a viewport rect. **Note:** the existing test at `:172` asserts centre-anchored behaviour by name ("preserves center-anchored math (no cursor position used)") — it must be rewritten, not kept. New cases: world point under the cursor is invariant across a zoom; magnitude scaling; `deltaMode` normalisation; clamp still holds at both ends; ctrl vs plain wheel dispatch.~~

---

## ~~Item 2 — Touch gestures on canvas (pan/zoom only)~~ *(Completed)*

**Problem.** There is no touch handling on the scene canvas — no `onTouch*`, no pinch, no `touch-action` on `.scene-canvas`. A player on an iPad cannot pan or zoom.

**Approach.**

1. **Add pinch as a first-class sub-gesture on the engine**, not a reuse of `movePan`. `movePan` (`cameraGestureEngine.ts:135`) anchors on `panStartCamera.zoom`, frozen for the whole gesture, so driving it while zoom changes computes the wrong world delta. Add `pinchStart(touches)` / `pinchMove(touches)` / `pinchEnd()` that track centroid **and** spread together, reusing `ensureSeeded` / `scheduleFrame` / `maybeBroadcast`.
2. **Register the new flag in both lifecycle guards.** Add `pinchActive` to the `isGestureActive` getter (`:70`) *and* to the early return in `endGestureIfIdle` (`:106`). Missing either causes a store commit mid-gesture, breaking the "zero writes mid-gesture" invariant.
3. **Two-finger only.** Handle pointer/touch events on the SVG but act only when tracking two active pointers. Single-touch must fall through untouched.
   > **⚠️ IMPORTANT:** A blanket `touch-action: none` on the canvas, or an unconditional `preventDefault`, kills mouse-compat events and silently breaks drawing on tablets. `DrawingTools.tsx:2470`, `MeasurementTool.tsx:333`, `TerrainTool.tsx:195`, `PropRenderer.tsx:181` and `SelectionOverlay.tsx:292` all rely on these.
   > 
   > **Recommendation:** Instead of raw `TouchEvents` (`touchstart`/`touchmove`), consider using standard `PointerEvent` listeners (`onPointerDown`, `onPointerMove`). Filter for `e.pointerType === 'touch'` and track active pointers by `pointerId`. This often plays nicer with the browser's native synthetic event generation. If using `touch-action`, scope it strictly to the two-finger case or suppress selectively in JS via `preventDefault` only when `touches.length === 2`.
4. **Follow the existing precedent** for touch-draggable elements: `TokenRenderer.tsx:178` already sets `touchAction: canInteract ? 'none' : undefined`, and `useTransientDrag.ts:128` and `fogGestureEngine.ts:119` both use `setPointerCapture` + window listeners. Match that shape rather than inventing a new one.

**Tests.** Unit-test `pinchStart/Move/End` on the engine with synthetic touch-point pairs (centroid pan, spread zoom, combined), asserting no commit until `pinchEnd`. Manual verification on a real tablet or device-emulated browser is required for the `touch-action` interaction — jsdom will not catch a broken mouse-compat path.

---

## ~~Item 3 — Harden the multi-panel system that already landed~~ *(Completed)*

The wiring is correct and the direction is right. These are the defects found reviewing the working tree. Type-check passes and all 18 unit tests pass, but those tests were only updated for renamed props — there is **no coverage of any new behaviour**.

### 3a. Blocking bugs

1. **`WindowPortal` closes and reopens its window on every render.** `apps/vtt/src/components/WindowPortal.tsx` has `useEffect(..., [width, height, title, onClose])`. `FloatingPanel.tsx:105` passes `onClose={() => restorePanel(panelId)}` — a new identity every render — so cleanup calls `.close()` and setup calls `window.open()` again. The reopen has no user gesture, the popup blocker kills it, `onClose()` fires and `restorePanel` runs. Under StrictMode (`src/main.tsx:67`) this happens on first mount.
   **Fix:** stabilise `onClose` with `useCallback` in `FloatingPanel`, hold it in a ref inside `WindowPortal` so it is not a dependency, and reduce the effect to a mount/unmount effect. Resize the existing window imperatively instead of recreating it.
2. **Pop-out state is persisted, so reload calls `window.open`/`requestWindow` with no user gesture** — always blocked. Keep persisting the set if you like, but **restore to docked** and let the user re-pop. Both Document PiP `requestWindow()` and `window.open()` require transient activation.
3. **Escape closes every panel at once.** Each `FloatingPanel` registers its own `window` keydown listener (`FloatingPanel.tsx:93`); `stopPropagation` does nothing between listeners on the same target. One Escape wipes the workspace.
   **Fix:** only the top-of-stack panel should respond — compare against the last entry of `panelStack`. Note five other components also listen for Escape on `window`.
4. **Every panel opens at the same coordinates.** `defaultPosition: { x: window.innerWidth - 320 - 16, y: 84 }` (`FloatingPanel.tsx:46`) is identical per panel, so opening three stacks them exactly.
   **Fix:** cascade — offset by `(index in activePanels) * ~28px` on both axes for panels with no persisted position, then clamp with the hook's existing `clampPosition`.
   > **💡 TIP:** To prevent a "solitaire cascade" that pushes panels endlessly off-screen upon repeated open/closes, apply a modulo (e.g., `(index % MAX_CASCADE) * 28px`) or reset to 0 if the projected bounds hit limits.
5. **New panel ids are absent from `DEFAULT_STACK`**, so `stackZIndex` hits `indexOf === -1` and returns `CHROME_Z_BASE` for every panel until first click — all panels tie with `gameToolbar` at z 60. Seed the stack with the panel ids, or make `bringToFront` run on mount.

### 3b. Correctness and cleanup

- **z-band headroom is nearly exhausted.** 12 panels + 5 chrome = 17 entries against `CHROME_Z_BASE 60` / `CHROME_Z_MAX 78`. One more panel and ordering silently clamps to 78.
  **Do not widen the band** — `z-scale.test.ts` enforces strict constraints. Instead make `stackZIndex` **compress**: map stack position across the available range rather than adding 1 per entry. Only relative order matters.
- **Dead code paths.** Panels now unmount on close instead of toggling `isOpen`, so focus restore (`FloatingPanel.tsx:73-77`) never runs and the `data-state="closed"` / `aria-hidden` / `inert` branches are unreachable. Either restore focus on unmount, or remove the dead branches.
- **`copyStyles` copies every sheet twice** (`WindowPortal.tsx`) — once via `cssRules`, then again by cloning `style`/`link` tags.
- **The popup never gets the theme.** `themeManager.ts:91` writes to `document.documentElement`, which is not cloned into the popup. Copy the theme attributes across and re-copy on `switchTheme`.
- **The popup's inline colours reference undefined tokens.** `WindowPortal` sets `body.style.backgroundColor = 'var(--surface)'` and `color = 'var(--text)'`; neither `--surface` nor `--text` is defined anywhere in `src/styles/`. Use the real tokens: `--bg-primary` / `--text-primary`.
- **The popped-out branch drops the panel chrome.** It renders a bare div with `styles.bodyWrapper` / `styles.body` and never applies `styles.panel`, so the popup has no background or border.
- **Leftover legacy that the summary claimed was removed.** The JSX is gone, but `.layout-header`, `.layout-panel`, `.sidebar-resize-handle`, `.scene-tab-bar` and the `--sidebar-width` grid columns remain in `styles/layout-consolidated.css` with zero consumers; the `floating-panels` flag is still in `utils/featureFlags.ts` defaults with a full test suite; and `GeneratorOverlay` still takes `floatingPanelsEnabled={true}`. Remove the flag, its tests, the prop, and the orphaned CSS.
- **`AtlasDock` id mismatch** (pre-existing): drag id is `atlasPill` but z-index is looked up as `atlasDock`.
- **`uiStackStore` now imports `gameStore` at module top level.** `npm run check:cycles` passes today across 287 modules, so this is a latent risk rather than a live bug, but keeping it dynamic as per CLAUDE.md is strongly recommended.
- **ADR references are dangling.** Comments cite ADR-0004/0005/0007/0008/0009 but only 0001 and 0002 exist in `apps/docs/vtt/adr/`. Write the panel-system ADR rather than adding another dangling number.

### 3c. Tests to add

Follow `uiStackStore.test.ts`. Add: `togglePanel` add/remove; persistence gated on `persistOpenPanels`; `popOutPanel`/`restorePanel` idempotency; `stackZIndex` for a panel absent from the stack; cascade offset; Escape affecting only the top panel; and a `WindowPortal` test asserting the window is created **once** across re-renders with changing `onClose` identity.

**E2E risk:** `tests/e2e/support/flows.ts:67` `openPanel()` clicks a tab to open. Under the new toggle semantics a second click *closes* it, breaking `tests/e2e/journey.smoke.spec.ts`. Make `openPanel` idempotent (check pressed state before clicking) and run `npm run test:e2e`.

---

## ~~Item 6 — Extend `TokenContextMenu`~~ *(Completed)*

The menu already exists and is mounted (`TokenRenderer.tsx:300`); the gap is its contents, not its mechanism. Current actions: visibility (host-only), initiative toggle, rotate +45°, Edit, Delete.

**Add Damage and Conditions — by delegating, not by building a new HP model.** 
- `initiativeStore.applyDamage(entryId, damage, damageType)` (`stores/initiativeStore.ts:406`) already handles standard 5e math, clamping, combat logs, and HP syncs. 
- `PlacedToken` (`types/token.ts:60`) has no `maxHp` and no temp HP, so damage applied at the token level cannot be correct.

**Approach:** resolve the `InitiativeEntry` by `tokenId` and delegate to `initiativeStore`. Decide deliberately what the menu does for a token with no entry: hide the Damage action, or offer "add to combat" first.

**Two fixes while in there:**
1. The wrapper currently uses `--z-tool-ui` (60), which renders *under* raised panels. **It should be `--z-popover` (75).**
2. The hard-coded `-40px` vertical offset (`TokenContextMenu.tsx:52`) assumes a single row; a submenu needs real positioning with collision/flip handling.

> **⚠️ CRITICAL:** **Native Overlays Rule Alignment**
> The repository rules explicitly state: *"For ordinary dropdowns, context menus, and static toolbars, prefer the native HTML Popover API (`popover="auto"` / `popovertarget`) over hand-rolled state and window event listeners."*
> Before importing `floating-ui` or manually calculating flips, evaluate if the native Popover API (potentially with CSS Anchor Positioning) can handle the submenu's placement and edge collision natively.

**Also note:** Delete and rotate are currently available to players, not just the host. Confirm that is intended before adding damage alongside them.

---

## ~~Item 7 — Docking zones~~ *(Completed)*

The review framed this as an enhancement to `useDraggablePanel` edge detection. It is not — it is a **second layout mode**. Floating panels are portal-mounted, `position: fixed`, and clamped against `window.innerWidth`. A docked panel has to reserve layout space and reflow the canvas, which means reintroducing a grid column — the very thing item 3 just deleted.

**Prerequisites:** items 3 and 5 must be stable first. A dock/undock transition has to serialise into the same workspace preset shape.

> **💡 TIP:** Transitioning from floating to docked triggers a `.game-layout` shift. Ensure the `ResizeObserver` inside `SceneCanvas.tsx:805` correctly detects this shift and re-syncs the `svgSize`. Otherwise, the anchored zoom logic (from Item 1) will incorrectly offset based on pre-dock canvas dimensions.

Sketch: detect edge proximity during drag and render a translucent drop-zone overlay; on release, move the panel into a docked region that participates in the `.game-layout` grid. Keep floating/docked distinctions in the preset schema. Budget this as its own project.

---

## ~~Item 4 — Focus mode (hotkey toggle)~~ *(Completed)*

**State.** Transient field on `uiStackStore` — `focusMode: boolean` plus `toggleFocusMode()`. Deliberately **not** persisted: reloading into a chrome-less UI with no visible way out is a trap.

**Reaching portalled chrome.** `#portal-root` is a sibling of `#root`, so a rule scoped to `.game-layout` cannot reach `FloatingPanel` or the AtlasDock pill. Set `data-focus-mode` on `document.documentElement` from one effect in `GameUI`, and have each chrome stylesheet opt in. CSS modules must use `:global(html[data-focus-mode]) &  { … }`.

**Hotkey: `F`.** Avoid `F11` (browser fullscreen) and `Tab` (collides with focus trap). Copy the input/textarea/select guard at `GameToolbar.tsx:364-372` to prevent firing while typing. Gate the Escape exit on `focusMode === true`.

**Accessibility.** Hidden chrome must leave the tab order — `opacity: 0` alone is wrong. **Using the `inert` attribute is perfect here.** Animate with `transform`/`opacity`, apply `visibility: hidden` via `transition-delay`, and set `inert` on hidden containers (matching the precedent in `FloatingPanel.tsx:129`).

**Reduced motion — fix the dead setting while here.** `settings.reducedMotion` is declared but unconsumed. Set a `data-reduced-motion` attribute alongside `data-focus-mode` and have `reset.css` honour it next to `@media (prefers-reduced-motion: reduce)`. 

**Popped-out panels** live in separate OS windows and are unaffected. Leave them open and say so in the docs.

---

## ~~Item 5 — Layout workspaces (named presets)~~ *(Completed)*

Nearly free once item 3 is stable.

**The hard part: restoring position.** Position lives in a **ref** in `useDraggablePanel`, applied imperatively so dragging does not re-render. Do not undo that.

- **(a) Add an absolute `setPosition(x, y)` to `useDraggablePanel` (Highly Recommended).** `shiftPosition` (`:160`) already does this relatively. An absolute sibling is ~5 lines. Size is already React state, so use `setSize`. Bump a `layoutEpoch` counter in `uiStackStore` on restore; each panel re-reads its keys when epoch changes. **No remount, no state lost.**
- *(b) and (c) are discouraged (destroy internal state / cause re-renders).*

**Storage: localStorage, not PostgreSQL.** 
> **🔒 CONTEXT:** This perfectly aligns with the **Durable Game-State Contract**. PostgreSQL is for authoritative state and events; UI layout presets are browser-specific preferences that do not belong in the multiplayer sync. Keep it local.
> *Note:* If a user runs multiple VTT tabs, saving to localStorage is "last writer wins". This is usually acceptable for UI presets.

**Schema: version it now.**
```ts
interface LayoutPreset {
  version: 1;
  name: string;
  activePanels: PanelId[];
  panelStack: PanelId[];
  geometry: Record<PanelId, { pos: {x,y}; size: {width,height}; collapsed: boolean }>;
}
```
Store under `nexus-ui-workspaces` (so `resetLayout()` already sweeps it). Snapshotting should mirror the existing `resetLayout()` prefix-enumeration loop.

**UI.** Save / switch / delete from the `PanelDock` overflow. Settings is the wrong home for something used mid-session.

**Interaction with `persistOpenPanels`.** Presets are explicit user actions and apply regardless of this setting.

**Tests.** Round-trip save→restore, unknown-version rejection, restore with a panel id that no longer exists, and ensure `resetLayout()` clears presets.

---

## Verification

Run from `apps/vtt`:

```bash
npm run type-check && npm run lint && npm run check:cycles && npm run test:unit
```

- `npm run check:cycles` matters specifically because `uiStackStore` now imports `gameStore`.
- `npm run test:e2e` after item 3, because `openPanel()` is likely broken by the toggle semantics.
- **Manual, on a real tablet or device-emulated browser** after item 2 — jsdom cannot catch a broken `touch-action` / mouse-compat path.
- **Manual for items 1 and 4**: zoom toward a map corner and confirm the point under the cursor stays put; two-finger trackpad scroll pans rather than zooming; ctrl+wheel does not trigger browser page zoom; `F` hides all chrome including floating panels, and hidden chrome is not reachable by Tab.

## Suggested sequencing

1. **Items 1 and 2** are independent of 3–7 and can land first in either order. 
2. **Item 3** gates 5 and 7. 
3. **Items 4 and 6** are independent and can be slotted anywhere. 
4. **Item 5** follows Item 3.
5. **Item 7** should not start until 3 and 5 have settled.

---

## Status — all seven items complete

Every item on this roadmap has landed. The consolidated design rationale, including the
decisions that differ from the original proposal and the traps found along the way, is
recorded in [ADR-0003](./adr/0003-floating-panel-system.md).

**Decisions taken during implementation**

| Item | Notable choice |
| --- | --- |
| 2 | Native `TouchEvent` with `{ passive: false }`, `preventDefault()` on the two-finger branch only — a blanket `touch-action: none` would break the mouse-compat events `DrawingTools`/`MeasurementTool`/`TerrainTool`/`PropRenderer`/`SelectionOverlay` rely on. Pinch is **not** gated on the active tool, so a tablet user can zoom while drawing. |
| 3 | Pop-out is repaired and kept, but never rehydrates on load (no transient activation). `stackZIndex` compresses rather than clamps. Escape is scoped to the topmost panel. |
| 4 | Hotkey `F`; flag mirrored onto `<html>` because `#portal-root` is a sibling of `#root`. Escape exit uses capture + `stopImmediatePropagation` to avoid the five other window Escape listeners. `settings.reducedMotion` is now consumed. |
| 5 | Restore is imperative via new `setPosition`/`setSizeClamped`/`setCollapsed` setters plus an `applySeq` counter — no remount, no lost panel state. Size is applied before position to defeat the right-anchor `ResizeObserver` compensation. |
| 6 | Damage/conditions delegate to `initiativeStore`; disabled with an explanatory tooltip when the token has no entry. Menu moved from `--z-tool-ui` (60) to `--z-popover` (75). |
| 7 | Implemented as a real second layout mode: `--dock-left/right-width` and `--dock-bottom-height` grid tracks that default to `0px`. Verified that cursor-anchored zoom still anchors with **zero pixel drift** against a 320px dock offset. |

**E2E status — a pre-existing failure, measured.** `npm run test:e2e` does **not** pass, on this
branch *or* on a clean checkout. Measured on the same machine, same suite:

| Tree | Result |
| --- | --- |
| `HEAD` with these changes stashed (baseline) | 4 passed, **2 failed** |
| This branch | 6 passed, **1 failed** |

Both failure modes pre-date this work and reproduce on the baseline:

1. **`Target crashed`** — the Chromium renderer dies, reproducibly, when panels are opened and
   closed repeatedly (the crash always lands on the *re-open* click, on more than one panel).
   Cause unknown. It is not the 3D dice canvas, which is a global overlay mounted once
   regardless of panels, and no leaked subscription or selector loop was found in the panel
   mount path. **This needs its own investigation** — it is reachable by a real user, not just
   by the test harness.
2. **Click interception** — panels float and overlap by design, so a panel opened earlier can
   cover one opened later and swallow its clicks.

`openPanel()` in `tests/e2e/support/flows.ts` is idempotent (clicking an already-open tab would
toggle it shut), and a new `closePanel()` lets a test put away a panel it has finished with —
which is how `multiplayer.smoke.spec.ts` now avoids the interception. Deliberately *not* done:
closing and re-opening a panel to raise it, or closing every other panel on each call. Both make
the renderer crash far more likely, and one of them took the suite from 1 failure to 2.

**Bugs fixed in passing**

- `GameToolbar`'s shortcut handler ignored modifiers, so `Ctrl+R` matched the "R" tool and suppressed browser reload (likewise `Ctrl+E`/`Ctrl+O`). Now guarded by `utils/hotkeys.ts`.
- `AtlasDock` persisted its drag position under `atlasPill` while reading its z-index as `atlasDock`.
- `WorkspaceMenu`'s popover was clipped by the PanelDock's `overflow: hidden`; it is portal-mounted and anchored from JS.

**Known limitation, not fixed**

`initiativeStore.addCondition` overwrites a condition's `id` with a fresh `crypto.randomUUID()`
when storing it, so applied conditions can only be matched by **name**, and the store's own
dedupe (`c.id !== condition.id`) never matches. `TokenContextMenu` works around this; the store
itself is untouched.

**Verification**

`npm run type-check`, `npm run lint`, `npm run check:cycles` and `npm run test:unit` (309 tests,
34 files) all pass, and `npm run build` succeeds. Focus mode, multi-panel + cascade,
topmost-only Escape, docking with canvas reflow, anchored zoom under a dock offset, and the
workspace save→undock→restore round trip were all exercised against the running app.

`npm run test:e2e` is covered under **E2E status** above: it fails on this branch and fails
worse on the baseline, for reasons that pre-date this work.

Two things could not be verified in the preview pane and need a real browser or device:

- **Tear-off windows** — the preview pane blocks `window.open`. The bounded failure path was
  confirmed (the "Pop-up blocked" log fires exactly twice, from StrictMode's double mount,
  rather than looping), and `WindowPortal.test.tsx` covers the create-once contract directly.
- **Touch pinch/pan** — jsdom cannot catch a broken `touch-action` / mouse-compat path. The
  engine maths is unit-tested; the gesture itself needs a tablet.
