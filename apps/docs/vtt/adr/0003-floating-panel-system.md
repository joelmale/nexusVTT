# ADR-0003 — The floating panel system: multi-window, focus mode, workspaces and docking

Status: **Accepted** (2026-09-15)

> **A note on ADR numbering.** Source comments across `apps/vtt` cite ADR-0004 (the chrome
> z-band clamp), ADR-0005 (the scene layer stack), ADR-0007 (the floating-panels layout),
> ADR-0008 and ADR-0009 (Atlas virtualization, fog/ink model). Those numbers belong to the
> roadmap-local series in `apps/docs/vtt/roadmap/ADR/`, not to this canonical series, which
> previously held only 0001 and 0002. This ADR takes the next free number in the canonical
> series and consolidates the panel-system decisions so future work has one place to read.

## Context

The VTT's context panel began as a single fixed sidebar reserved by a CSS grid column, gated
behind a `floating-panels` feature flag. The flag's "on" branch replaced that column with a
single portal-mounted `FloatingPanel` whose content swapped as the user clicked the
`PanelDock`. A DM could not see the initiative tracker and the chat at the same time.

A UI/UX review proposed seven changes. Three of its premises were wrong against the code, and
its priority order was close to inverted — it led with tear-off windows and "cinematic mode"
while treating canvas navigation as polish, when in fact zoom was centre-anchored, ignored
`deltaY` magnitude, had no `ctrlKey` branch, and the canvas had no touch handling at all.

## Decisions

### 1. One layout, no flag

The `floating-panels` flag is removed along with the legacy sidebar. `.game-layout` is a
single full-viewport scene cell; all chrome floats over the map. The orphaned CSS
(`.layout-header`, `.layout-panel`, `.sidebar-resize-handle`, `.scene-tab-bar`,
`--sidebar-width`) is deleted rather than left to rot.

### 2. `uiStackStore` owns chrome state; it stays a leaf

`activePanels`, `panelStack`, `poppedOutPanels`, `dockedPanels` and `focusMode` all live in
`uiStackStore`. It previously imported `gameStore` at module scope for a single boolean;
that edge is gone — `persistOpenPanels` is read back from the `nexus-settings` key that
`gameStore` already writes. `npm run check:cycles` is part of the contract here.

### 3. z-order compresses, it does not clamp

The chrome band is `[CHROME_Z_BASE 60, CHROME_Z_MAX 78]` and **cannot be widened**:
`z-scale.test.ts` enforces TS↔CSS parity and strict ascension, and the band already
straddles `--z-panel` (70) and `--z-popover` (75). With 12 panels plus 5 chrome elements a
naive `base + index` overflows and silently flattens everything onto 78, destroying the
ordering. `stackZIndex` therefore maps stack position proportionally across the band.

### 4. Escape belongs to the topmost panel only

Every mounted `FloatingPanel` registers its own `window` keydown listener, and
`stopPropagation` does nothing between listeners on the same target — one Escape used to
close every open panel. `useIsTopmostPanel` scopes it to the frontmost open panel.

Focus mode's Escape exit goes further: it listens in the **capture** phase and calls
`stopImmediatePropagation`, because five other components (FloatingPanel, AtlasDock,
GeneratorOverlay, DocumentViewer, CharacterSheetPopup) also listen for Escape on `window`.

### 5. Tear-off windows are created once, and never restored automatically

`WindowPortal` creates its window on mount and tears it down on unmount — nothing else.
`onClose`, `title`, `width` and `height` are deliberately **not** effect dependencies:
callers pass an inline arrow for `onClose`, so a dependency on it closed and re-opened the
window on every render, the re-open had no transient activation, the popup blocker killed
it, and the panel tore itself down.

For the same reason, pop-out state never rehydrates on load: both
`documentPictureInPicture.requestWindow()` and `window.open()` require a user gesture.
Panels always come back docked and the user re-pops deliberately.

### 6. Focus mode is a document-level attribute

`#portal-root` is a **sibling** of `#root`, so a rule scoped to `.game-layout` can never
reach `FloatingPanel` or the AtlasDock pill. The flag is mirrored onto `<html>` as
`data-focus-mode`, and every chrome root carries a plain `data-chrome` attribute — an
attribute rather than a class, so one rule reaches both global-class chrome and CSS-module
chrome whose names are hashed at build time.

Hidden chrome gets `inert`, not just `opacity: 0`, so it leaves the tab order; focus is
parked on `.layout-scene` and restored on exit; and a visually-hidden live region announces
the change. The hotkey is `F` — `GameToolbar` already claims V/H/M/I/D/L/R/O/C/E/-/+, `F11`
is browser fullscreen and `Tab` collides with the generator's focus trap.

This work also finally consumes `settings.reducedMotion`, which had existed in
`UserSettings` and the Settings UI for months with no consumer.

### 7. Workspace restore is imperative, not a remount

Panel position lives in a **ref** in `useDraggablePanel`, applied as
`transform: translate3d(...)`, specifically so dragging never re-renders. Restoring a
workspace does not undo that:

- `applyWorkspace` writes geometry to localStorage **first**, so panels that are about to
  mount pick it up in their own mount effects with no extra plumbing.
- It then bumps `applySeq`; already-mounted panels subscribe and apply geometry through the
  new `setPosition` / `setSizeClamped` / `setCollapsed` setters. Nothing remounts, so no
  panel loses its scroll position or in-progress input.
- Size is applied before position (on the next frame), because `useDraggablePanel`'s
  `ResizeObserver` compensates `x` for width changes on right-anchored panels and would
  otherwise shift a panel after it was placed.

Presets are stored under `nexus-ui-workspaces` and are therefore swept by `resetLayout()`.
That is deliberate and documented — the menu labels the action
"Reset layout & delete workspaces" so it is not silent data loss.

### 8. Layout presets stay local

A workspace is a per-browser UI preference: not tabletop state, not shared between players,
and its pixel geometry is device-specific. Writing it through the durable game-state path
would advance `stateVersion` and fan a purely cosmetic change out to every peer. It stays in
localStorage, outside the server-authoritative boundary described in CLAUDE.md.

### 9. Docking is a second layout mode, not edge-snapping

A docked panel reserves real layout space. `.game-layout` carries `--dock-left-width`,
`--dock-right-width` and `--dock-bottom-height` grid tracks that default to `0px`, so an
undocked layout is identical to the single-cell case. Docked panels portal into
`.dock-region` hosts inside the grid rather than floating.

Because the scene cell genuinely shrinks, `SceneCanvas`'s existing `ResizeObserver` picks the
change up and re-syncs `svgSize` — which is what the cursor-anchored zoom measures against.
Without that, zoom would keep anchoring on pre-dock canvas dimensions.

### 10. Touch is two-finger only, and suppresses nothing else

Pinch is a first-class engine sub-gesture (`pinchStart`/`pinchMove`/`pinchEnd`) rather than a
reuse of `movePan`, which freezes zoom at `panStartCamera.zoom` for the whole gesture and
would compute the wrong world delta while scaling. `pinchActive` is registered in **both**
`isGestureActive` and the `endGestureIfIdle` guard, or the pinch would commit to the store
mid-gesture and break the zero-writes-mid-gesture invariant.

The canvas uses native `TouchEvent` listeners with `{ passive: false }` and calls
`preventDefault()` **only** on the two-finger branch. A blanket `touch-action: none` would
kill the browser's synthesized mouse-compat events that `DrawingTools`, `MeasurementTool`,
`TerrainTool`, `PropRenderer` and `SelectionOverlay` all depend on.

## Consequences

- There is exactly one layout and one zoom path; `GameToolbar`'s zoom buttons route through
  the gesture engine rather than writing the camera directly.
- Adding a new panel means adding it to `panels` in `GameUI`; z-order, cascade placement,
  focus-mode hiding, workspace capture and docking all follow automatically.
- `resetLayout()` is now reachable from the UI (the workspace menu). It previously had no
  caller anywhere in the app.
- Two pre-existing bugs were fixed in passing: `GameToolbar`'s shortcut handler ignored
  modifier keys, so `Ctrl+R` matched the "R" tool and suppressed browser reload; and
  `AtlasDock` persisted its drag position under `atlasPill` while looking its z-index up as
  `atlasDock`.
- One pre-existing bug is worked around, not fixed: `initiativeStore.addCondition` replaces a
  condition's `id` with a fresh `crypto.randomUUID()` when storing it, so applied conditions
  can only be matched by **name**. `TokenContextMenu` does that and passes the stored
  instance id to `removeCondition`. The store's own dedupe is still ineffective.
