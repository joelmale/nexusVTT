# Map Studio redesign plan

Status: **implemented** (all five phases), building on `e781dee1` (per-generator
action registry). See "Implementation notes" at the end for where the build
differs from the proposal.

## Where we are

- `GeneratorOverlay` is a full-screen modal (`aria-modal`, focus trap) that hosts
  `GeneratorPanel`: a hub iframe plus `GeneratorFloatingControls`, a draggable
  340x560 card absolutely positioned **over** the map.
- `GeneratorFloatingControls` is ~800 lines of inline styles with a fixed
  vertical stack: scene pill, generator chips, a 2-column Quick Actions grid,
  Add to Scene, options, a collapsible shortcut list.
- Actions flow panel -> hub (`generator/action`) -> bridge (`EXECUTE_ACTION`) ->
  synthetic keyboard event. Nothing flows back, so the panel cannot know whether
  an action worked, is still running, or what a toggle's current state is.
- The registry (`generatorActions.ts`) already holds every verified action with a
  `kind` (`reroll | toggle | cycle | dialog | preset | export`) and a `group`
  (`generate | style | layers | export`). This plan renders more of it.

## Goals

1. Controls never cover the map being edited.
2. Every verified action is reachable, grouped by intent, and unsupported ones
   are absent (never dead buttons).
3. The user can tell when an action is running, finished or failed.
4. Works from a wide desktop down to a narrow window.

Non-goals: changing the generators themselves, new generators, or the
asset-import pipeline (`BaseMapImporter`).

## Target layout

```
+--------------------------------------------------------------+
| Map Studio                                    [scene pill] [x]|
+-----------------+--------------------------------------------+
| Generator       |                                            |
| [D][C][W][T][H] |                                            |
|-----------------|                                            |
| Generate|Style  |            generator iframe                |
| Layers |Output  |         (gets the full remaining width)    |
|                 |                                            |
|  tab content    |                                            |
|  (scrolls)      |                                            |
|-----------------|                                            |
| [ Add to Scene ]|                                            |
| Scene: Cave 1   |                                            |
+-----------------+--------------------------------------------+
```

A flex row inside the overlay: sidebar (resizable 280-420px) + iframe. The
sidebar is a sibling of the iframe, not an overlay on it.

## Phases

Each phase is independently shippable and leaves the app working.

### Phase 1 - Layout shell (option 4, structure)

- New `GeneratorSidebar` replaces `GeneratorFloatingControls` in
  `GeneratorPanel`; `.generator-panel` becomes `display: flex` row;
  `.generator-iframe-container` takes `flex: 1; min-width: 0`.
- Drop `useDraggablePanel` / `useResizablePanel` for this panel. Keep a single
  width handle on the sidebar edge; persist width under `nexus-ui-generator-width`.
- Dock side (left | right) setting, persisted. Default left.
- Collapse to a 48px icon rail (generator icons + Reroll + Add to Scene).
- Move styling to `GeneratorSidebar.module.css` using design tokens (the current
  inline `rgba(...)` values bypass theming).
- Narrow screens (< 720px): sidebar becomes a bottom sheet with a drag handle.
- Break the file up: `GeneratorPicker`, `ActionButton`, `ShortcutList`,
  `SceneStatus`, `AddToSceneBar`.
- Files: `GeneratorPanel.tsx`, `GeneratorPanel.css`,
  `GeneratorFloatingControls.tsx` (deleted at the end), new `Generator/Sidebar/*`.
- Tests: update `tests/unit/components/GeneratorPanel.test.tsx` selectors;
  keep the stable `Reroll new map (Enter)` title.
- Risk: `GeneratorOverlay`'s focus trap + Escape handling must still cover the
  sidebar (it queries focusable descendants, so this should hold; add a test).
- Size: M.

### Phase 2 - Tabs and presets (option 2)

- Tabs from the registry groups: Generate, Style, Layers, Output.
- Generate: large Reroll button, generator-specific rerolls (World: Reroll
  names, Random towns; Dwellings: variants), Tags/Rotate dialogs.
- Style: preset chips for every `kind: 'preset'` action (World 1-5, City 1-6,
  Dwellings 6-0), plus the style dialog/cycle button. Dungeon shows its cycler.
- Layers: toggles for every `kind: 'toggle'` action in the `layers` group.
- Output: Export PNG/JSON actions, WebP option, Upload Dungeon JSON.
- Visual language by `kind`: toggles are pill switches, dialogs carry a
  trailing ellipsis and a hint ("opens a dialog in the map"), presets are chips.
- Search/filter field when a generator has many actions (Dwellings, Dungeon).
- Registry additions: optional `defaultOn` where known, and an `order` field.
  Keyboard-only entries stay listed in the shortcut section.
- Tests: registry-driven render test (every action appears once; none for
  other generators), chip click sends the right key code.
- Size: M. Depends on Phase 1.

### Phase 3 - Sticky output bar (option 3)

- Footer fixed to the bottom of the sidebar: scene pill, **Add to Scene**,
  progress text while importing, error line on failure.
- Keep the disabled-state tooltips already in place (no scene / nothing
  generated). Replace the `alert()` calls in `handleApplyToScene` with inline
  errors or toasts (`@/utils/notifications`).
- Show a small thumbnail of the cached export so users see what will be added
  (also reveals stale exports).
- Size: S. Can ship with Phase 1.

### Phase 4 - Responsive and docking polish (option 4, behavior)

- Drag-to-redock between left and right; remember per user.
- Keyboard: `[` collapses the sidebar, `Ctrl+Enter` = Add to Scene while focus is
  outside the iframe; document in the shortcut section.
- Reduced-motion and light-theme checks; focus order sidebar -> iframe.
- Size: S-M.

### Phase 5 - Action acknowledgements (option 5)

Protocol (extend `shared/generator/protocol.ts`):

```ts
| { type: 'generator/action'; actionId: string; requestId: string; keyCode: number; ... }
| { type: 'generator/action-result'; payload: {
    requestId: string; status: 'done' | 'error'; error?: string } }
```

- Bridges: after dispatching the key and the post-action re-export settles
  (they already wait ~800ms then call `triggerExport`), post
  `ACTION_RESULT` to the hub; the hub forwards it as `generator/action-result`.
  On exception, post `error`.
- Panel: per-action pending state (spinner on the button, disabled while
  pending), 4s timeout -> "no response" toast, then re-enable.
- Honest limit: the generators are black boxes and expose no toggle state, so
  acknowledgements can say "applied", not "grid is now on". For toggle
  indicators, track optimistic local state per (generator, action), reset it on
  generator switch or reroll, and label it as approximate - or skip indicators
  and show only the pending/done flash. Recommendation: skip persistent state
  indicators in v1.
- Export freshness: tie "Add to Scene" to the latest export id; if an action is
  pending, wait for its result before capturing.
- Tests: protocol round-trip unit tests; panel test with a fake hub that
  acks/never-acks.
- Size: M. Independent of Phases 1-4 except for the button UI.

## Suggested order

1. Phase 1 + 3 together (layout shell and sticky bar): the visible win.
2. Phase 2 (tabs and presets): where the registry pays off.
3. Phase 5 (acks): removes the "did it work?" doubt.
4. Phase 4 (polish) last.

## Open questions

- Dock side default: left (keeps the right free for the panel dock) or right?
- Should the sidebar stay open by default, or start as the icon rail?
- Is a persistent toggle indicator worth the approximate-state caveat?
- Keep the in-iframe generator UI (its own buttons) visible, or can the hub
  hide it so the sidebar is the only control surface? Hiding it would remove
  duplicate controls but needs a per-generator CSS/bridge change.

## Implementation notes

Built as proposed, with these differences:

- **Redock by button, not drag.** The header has a "move to the other side"
  button (persisted in `nexus-ui-generator-dock`); there is no drag-to-redock.
  The width handle is draggable and keyboard-resizable (260-460px, persisted in
  `nexus-ui-generator-width`). Collapsed state is `nexus-ui-generator-collapsed`.
- **No toggle-state indicators.** As recommended, buttons show only
  pending/done; the generators expose no toggle state.
- **Acknowledgement timing.** The bridge acks about 1.2s after the key (after
  its own re-export is scheduled), but the hub finishes rasterizing the new
  export roughly 0.7s later. "Add to Scene" therefore waits for the first
  `generator/export-ready` after an acknowledged action (4s cap), not just for
  the ack.
- **In-iframe generator UI is untouched.** Hiding the generators' own buttons
  was left as an open question and is still open.
- Shortcuts: `[` collapses the sidebar and Ctrl/Cmd+Enter adds to the scene,
  both ignored while typing.
- Verified in a browser against the real generators: every action on all five
  returns an `ACTION_RESULT` and triggers a fresh export. Whether each key has
  the intended visual effect rests on the key-handler analysis in
  `generatorActions.ts`; the verification pane did not paint the generator
  canvases, so that was not confirmed by eye.
