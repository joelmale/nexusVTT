# ADR-0004 — Canvas panel layouts: Original, Compact and Widescreen

Status: **Accepted** (2026-09-16)

> Numbering note: as ADR-0003 records, source comments citing "ADR-0004" (the chrome z-band
> clamp) refer to the roadmap-local series in `apps/docs/vtt/roadmap/ADR/`, not to this
> canonical series. This ADR takes the next free number here.

## Context

ADR-0003 established the floating panel system: every piece of chrome floats over the map, a
panel can be dragged, resized between 260px and 800px, docked to an edge or torn off into its
own OS window. What it did not establish was any notion of *density*.

The result was one fixed size for everything. `.context-panel__body` padded a flat
`var(--spacing-6)` — 24px — whether the panel was 260px or 800px wide. The title bar's type
was a literal `14px`. Dock tracks were 320/320/240px. Chat, dice, initiative, character and
player-panel between them carried roughly 150 literal `font-size` and `padding` values plus a
scattering of raw `--spacing-*` / `--text-*` references, none of which any setting could move.
And the repo contained no container queries at all, so a panel dragged to 800px on an ultrawide
rendered exactly the same single narrow column as one squeezed to 260px.

Two complaints follow directly. On a laptop, panels spend their vertical space on padding and
cannot fit a full turn order or a useful amount of chat scrollback. On a widescreen monitor a
wide panel is mostly empty gutter.

## Decisions

### 1. Three named layouts, chosen explicitly

`settings.panelLayout` is `'original' | 'compact' | 'widescreen'`, with a dropdown in
Settings → Display and `original` as the default.

Explicit rather than viewport-derived. An auto rule would have to guess from screen size, but
the useful signal — how wide *this* panel is, and how much the user wants on screen at once —
is not recoverable from the viewport. A DM on a 1080p laptop may well want Compact; one on an
ultrawide who keeps a single narrow chat panel open does not want Widescreen.

### 2. The reducedMotion mechanism, reused

A `UserSettings` field, a sync hook (`hooks/usePanelLayout.ts`) mirroring it onto
`<html data-panel-layout>`, and CSS keyed off that attribute. This is the shape
`useReducedMotionSync` already established, and it costs no new plumbing: `nexus-settings`
already round-trips the whole settings object through localStorage.

`original` *removes* the attribute rather than setting it, so the bare `:root` token block
stays the one that applies and the default path has no extra selector to match.

`WindowPortal` carries `data-panel-layout` into popped-out documents alongside `data-theme`.
Without that, tearing a panel off in Compact would silently hand you an Original one.

### 3. Two ladders and semantic aliases, not one flat set of tokens

`--panel-space-0..10` and `--panel-font-0..9` are the primitives; `--panel-pad-*`,
`--panel-gap*` and `--panel-text-*` are aliases onto them. This mirrors how `--spacing-N`
already underpins `--spacing-md` in the same file.

The ladders exist because of the retrofit. **Every Original ladder value equals a literal the
panel stylesheets already used**, which makes converting a sheet a 1:1 substitution that
provably cannot shift the Original layout. A purely semantic token set would have forced a
judgement call on every one of ~150 declarations, and each judgement call is a chance to move
Original by a few pixels.

The aliases exist because `--panel-pad-lg` reads better than `--panel-space-9` at the call
site. New code should prefer them; the ladders are for values that have no semantic name.

Where the old sheets used their own ad-hoc scale — 0.8 / 0.85 / 0.9 / 0.95 / 1.1 / 1.2rem,
13px — those snap to the nearest ladder step, moving Original by at most about 1.5px. That
normalization is the point, not a regression.

Decorative sizes stay literal. Dice glyphs, empty-state icons, hairlines and absolute
positioning offsets are not density and must not shrink with it.

### 4. Compact is refused on a coarse pointer

Compact takes icon buttons to 22px and controls to 26px, well under the 44px touch target
`FloatingPanel`'s drag handle deliberately honours. `resolvePanelLayout()` returns `original`
for `compact` when `(pointer: coarse)` matches.

We considered expanding the hit area with a pseudo-element instead. It does not work here: at
28px with a 4px gap, a 44px target overlaps its neighbour, and the later sibling steals the
previous button's edge. Refusing the layout is honest and has no failure mode.

### 5. Panel size is namespaced per layout; position is not

Panel size is persisted per panel id. Without namespacing, anyone who had ever dragged a
resize handle would switch layout and see nothing move, because the saved pixel size beats the
new default.

`useResizablePanel` takes a `storageId` and `FloatingPanel` appends the layout to it. Original
keeps the bare `nexus-ui-{id}-size` key, so existing installs are untouched and no migration
runs; the others get `--compact` / `--widescreen` slots and remember their own geometry.

Position and collapsed state are deliberately *not* namespaced. Where you put a panel is your
choice, not a property of the density.

The re-key effect is declared ahead of the persist effect and guarded by a flag, because on
the commit where the key changes `size` still holds the outgoing layout's value — persisting
it would stamp the old size onto the new slot and the new default would never apply.

Saved workspaces record their layout (schema v2) and restore it on apply, so a preset captured
in Widescreen does not drop 460px panels into Compact. v1 presets have no field and are
Original by definition.

### 6. Widescreen reflows by container query, not media query

`.panel`, `.dockedPanel` and `.poppedOutRoot` declare `container-name: panel`, and
`styles/panel-layouts.css` queries it. Media queries are the wrong tool: panel width is set by
the user, anywhere from 220px to 1100px, and is independent of screen size. A 400px panel on a
34" ultrawide should still be one column.

Every reflow rule is additionally gated on `:root[data-panel-layout='widescreen']`. Reflowing
whenever a panel happened to be wide would surprise someone who had just dragged a panel out
in the layout they already had; the layout is the opt-in.

`panel-layouts.css` is imported **outside the cascade layers and last**. An unlayered rule
beats every layered rule regardless of specificity, so that is the only position from which it
can override both the layered component sheets and the deliberately unlayered `chat.css`.

## Consequences

- Panel padding and panel type must use `--panel-*`. A literal or a raw `--spacing-*` in a
  panel stylesheet is invisible to the density setting and will look wrong in Compact.
- `PANEL_LAYOUT_GEOMETRY` in `hooks/usePanelLayout.ts` duplicates the width and dock numbers
  that `design-tokens.css` carries as `--panel-default-w` / `--dock-size-*`. JS needs them as
  numbers before the stylesheet has applied. `tests/unit/panelLayout.test.ts` parses the CSS
  and asserts the two agree.
- Adding a fourth layout means a `PanelLayout` member, a geometry entry, a token block and a
  dropdown option — no new mechanism.
- Widescreen currently reflows initiative, dice and chat. Other panels widen but stay single
  column; adding one is a rule in `panel-layouts.css`, not a code change.
- Compact is unavailable on touch devices. If touch support becomes a goal, that needs a
  touch-sized layout of its own rather than relaxing the guard.
