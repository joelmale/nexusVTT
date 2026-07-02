# ADR-0006 — CSS strategy: design tokens + CSS Modules for net-new; no Tailwind migration

Status: **Accepted** (Joel, 2026-07-02)

## Context
35 global CSS files (~15K lines across the biggest), BEM-ish global classes, mature design-token
system (`design-tokens.css`), Tailwind v4 configured but ~unused (~80 utility classNames total).

## Decision
Net-new components (floating panels, icon dock, context menus, Atlas, fog tools) use
**CSS Modules** (`Component.module.css`) consuming `var(--token)` values. No wholesale Tailwind
adoption — tokens already cover what utilities would add; the actual disease is global-scope
bleed, which Modules cure. Existing global files are NOT mass-migrated; they modularize
opportunistically when a packet touches them, and dead ones are deleted (A10).

## Consequences
- First Module lands in A6a and sets the precedent.
- Tailwind config remains for the few existing usages; no new utility-class code.
- The three giant files (character.css 2221, scenes.css 2054, layout-consolidated.css 1640)
  shrink by attrition, not by rewrite.
