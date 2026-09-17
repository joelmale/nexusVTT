# CSS ownership

`main.css` is the single application stylesheet entry point. It imports the
global reset, design tokens, layout primitives, shared utilities, and legacy
feature styles in a deterministic order. Runtime stylesheet injection is not
used.

Styles that serve one component are colocated with that component, for example
`CharacterPanel.css`, `Tooltip.css`, and `Generator/GeneratorPanel.css`. Files
in this directory are reserved for tokens, application-wide layout, themes, or
styles shared by several features.

When adding styles:

1. Use an existing design token before adding a literal color, spacing, or
   elevation value.
1a. **Panel padding and panel type use the `--panel-*` tokens**, never a
   literal and never a raw `--spacing-*` / `--text-*`. Those are the only
   values the Panel Layout setting can move: anything else stays at Original
   size inside a Compact frame. Prefer the semantic aliases
   (`--panel-pad-md`, `--panel-gap`, `--panel-text-body`) and fall back to the
   `--panel-space-N` / `--panel-font-N` ladders when there is no semantic name.
   Sizes that are not density - icon glyphs, avatars with their own token,
   hairlines, absolute offsets - stay literal. See ADR-0004.
2. Keep component selectors scoped under a feature class.
3. Import component-owned CSS from the component and global CSS from
   `main.css` only.
4. Respect reduced-motion, keyboard focus, and high-contrast preferences.
5. Remove superseded rules in the same change; do not add another override
   layer to compensate for stale CSS.

The active shared files are `design-tokens.css`, `reset.css`, `critical.css`,
`layout-consolidated.css`, `toolbar-unified.css`, `settings-optimized.css`, and
the remaining feature-level styles imported by `main.css`.

## Import order is load-bearing at the tail of `main.css`

`chat.css` and then `panel-layouts.css` are imported outside the cascade layers,
in that order, and must stay last. An unlayered rule beats every layered rule
regardless of specificity, so that is the only position from which
`panel-layouts.css` can override both the layered component sheets and
`chat.css`. Moving either into a layer silently disables the Widescreen
reflow.
