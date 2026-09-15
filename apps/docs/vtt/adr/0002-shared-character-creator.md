# ADR-0002 — One shared character creator, imported at build time

Status: **Accepted** (2026-09-15)

## Context

Nexus Forge and Nexus VTT each had their own character creation wizard.

- Forge's wizard (`apps/forge/src/components/CharacterCreationWizard`, ~9,800 lines across
  44 files) is the full 5e creator: 14 steps, both the 2014 and 2024 rulesets, species
  lineages, subclasses, feats, weapon mastery, spell selection and equipment.
- The VTT's wizard (`apps/vtt/src/components/CharacterCreationWizard.tsx`, ~1,290 lines) was a
  six-step approximation. Its stylesheet (`src/styles/character-creation-wizard.css`, 930
  lines) was never imported, and its selectors were spread across three other global
  stylesheets that partly contradicted each other.
- The only bridge between the two was a JSON export/import round trip through
  `characterImport/forgeAdapter.ts`, which silently dropped proficiencies, weapon mastery,
  origin feats, feat choices, trinkets, equipped armour and per-item inventory detail, and
  mis-slugged inventory entries because it keyed off `id`/`name` rather than Forge's
  `equipmentSlug`.

Module federation already existed (`apps/forge/vite.config.ts`) but exposed only
`./CharacterSheet` and `./dbService` — not the creator.

## Decision

Forge's wizard becomes **the single maintained creator**, extracted into a new workspace
package, `@nexus/character-creator`, that both apps import **at build time**.

**Why a workspace package rather than a federated remote:**

1. **Availability.** A federated remote makes VTT character creation fail whenever the Forge
   container is down, version-skewed or CORS-blocked. Character creation sits on the critical
   path for joining a session.
2. **Style containment.** The wizard's Tailwind layer includes global preflight resets.
   Loading it at runtime injects those into the whole host document. A build-time package lets
   the styles be compiled and scoped instead.
3. **One rules implementation.** The wizard's real dependency is ~140 files of rules data and
   calculators. Those belong in a shared, type-checked, testable unit rather than behind an
   opaque remote.

Forge continues to run as its own app and continues to federate its character sheet.

### Package boundary

The package owns the creator UI plus the rules data and calculators it needs. It owns **no**
persistence, account identity or multiplayer state. It exposes a typed completion contract:

```ts
onComplete(result: CharacterCreationResult): void | Promise<void>
```

`CharacterCreationResult` carries the calculated `character`, the raw `creationData` answers,
the `edition` and `createdAt`. A rejected promise surfaces the error inside the wizard and
keeps it open with the player's answers intact, so hosts own retry semantics.

Host bindings:

- **Forge** (`apps/forge/src/App.tsx`) writes the result to its own IndexedDB via `dbService`.
- **VTT** (`apps/vtt/src/components/SharedCharacterCreator.tsx`) converts to the
  `@nexus/character-contracts` model and persists via
  `characterStore.saveCreatedCharacter()` — account first, then store, then local cache.

### Styling boundary

The creator's palette lives in one source file
(`packages/character-creator/src/styles/creator-theme.source.css`) with two consumers:

- Forge `@import`s it globally, as before.
- A build step (`scripts/build-styles.mjs`) emits `dist/creator.css`, where every selector is
  scoped to `.nexus-character-creator`. The VTT imports that.

Scoping is required, not cosmetic: the creator and the VTT both define `--color-text-primary`
and `--color-border-primary`, with different meanings. Unscoped, they would collide.

Theme crosses the boundary explicitly: the host passes a `theme` prop, which the creator writes
to `data-theme` on its own root. The creator never reads host tokens.

Conversely, the VTT's `theme-solid.css` carried blanket `!important` element rules
(`.theme-solid button:not(.unstyled)`, universal `backdrop-filter: none`) that reached into the
creator's portal. Those now exclude the `.nexus-character-creator` subtree. **Any new blanket
element rule in VTT global CSS must carry the same guard.**

### Model conversion

`toNexusCharacter()` in the package is the **single** conversion into the VTT contract. Both the
live creator and the Forge JSON import path go through it, so a field preserved for one is
preserved for both. `@nexus/character-contracts` was widened to hold everything the creator
produces; anything deliberately not carried across is listed in `UNMAPPED_CREATOR_FIELDS` with
a reason.

## Consequences

- The VTT's own wizard and its styles are deleted; `character.css` drops 2221 → 1294 lines.
- Forge keeps ~38 one-line re-export shims at the old module paths, so the rest of Forge
  compiles unchanged against the moved rules modules.
- Both apps resolve the package through tsconfig `paths` + Vite aliases; the package ships
  TypeScript source, so there is no build step to keep in sync during development.
- The creator is lazy-loaded in both apps. In the VTT it is a separate ~2 MB rules chunk that
  is not in the initial bundle.
- Quick/manual entry and JSON import are unchanged and remain the fast paths.
- The VTT's "Character Forge" option on the player setup page now opens the creator in-app
  instead of linking out to a separately hosted site.
