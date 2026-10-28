---
title: Source-of-truth audit
description: Where data, rules logic and contracts are duplicated across the monorepo, what has been consolidated, and the proposed order for the rest.
---

# Source-of-truth audit

Audited **2026-10-27** from tracked files: byte-identical files, content overlap
between JSON datasets, and repeated rules constants, helpers and type
definitions. Counts are from that scan, not estimates.

## Consolidated

| Item                                  | Before                                                                                                                                                         | Now                                                                                                                                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2024 SRD equipment                    | `packages/character-creator/src/data/equipment.json` and an identical committed copy in doc-api (213 entries, zero differences)                                | One file. doc-api's build copies it into `dist/data`, its image build copies it from the package, CI rebuilds doc-api when it changes, and the seeder's monorepo fallback path (which had an off-by-one) is fixed.             |
| Merged SRD spell list                 | A committed, generated `5e-SRD-Spells-Merged.json` (341 spells) with a script no npm script or CI job ran; it re-contained both source files                   | Deleted. `mergeSpellSources` computes it at load time from `2014/5e-SRD-Spells.json` and `2024/5e-SRD-spells.json`; the VTT server reads the 2024 file directly. The result is verified deep-equal to the old file.            |
| Item text in the Studio compendium    | 100 of 213 items had no `description`, so Campaign Studio showed "No description provided" for every tool                                                      | The converter derives a factual summary from the structured SRD fields when no prose exists.                                                                                                                                    |

## Remaining duplication, in suggested order

1. **Dice rolling: 13 definitions in 4 areas.** `apps/vtt/server/diceRoller.ts`,
   `apps/vtt/src/utils/dice.ts`, `apps/forge/src/utils/diceRoller.ts`, the
   creator's `diceService.ts`, plus `hoardRoller.ts` in dm-ui. This is the
   highest-risk item because behaviour (advantage, keep-highest, critical
   handling, seeding) can diverge between what the server rolls and what a
   client previews. Proposal: one tested parser/evaluator with an injectable
   random source in `@nexus/rules-5e`, used by the server as the authority.
2. **Character contracts.** `packages/character-contracts` and
   `packages/game-contracts/src/character.ts` both define a character, and
   `apps/vtt/server/repositories/base.ts`, `routes/api.ts` and
   `Dashboard/types.ts` define their own. They may be intentionally different
   (sheet versus actor); that needs a decision and a documented mapping
   between them, not a guess.
3. **Primitive types.** `AbilityName` is defined 6 times in 3 packages and
   `Edition` 4 times. Proposal: `rules-contracts` owns them and the others
   re-export.
4. **Rules constants.** The ability-modifier formula appears about 35 times
   (all currently identical) although `rules-5e` exports `getAbilityModifier`.
   Skill-to-ability maps exist 3 times, ability lists 6, and the proficiency
   bonus table, hit dice and caster slot tables once each in the creator and
   `rules-5e`. Proposal: `rules-5e` is the home; replace copies with imports and
   add a lint rule against re-deriving the formula.
5. **2014 equipment and classic magic items.** The only copies are in doc-api
   (`5e-srd-equipment-2014.json`, `5e-srd-magic-items.json`); the shared package
   has no 2014 equipment, so 2014 characters use 2024-year items. Proposal: move
   both into the shared package, then have doc-api consume them as above.
6. **One-Page Dungeon generator.** `apps/vtt/public/one-page-dungeon` and
   `apps/vtt/apps/generator-hub/public/one-page-dungeon` are two trees of 37
   files; all but `dungeon-bridge.js` and `index.html` are identical (a 2.4 MB
   `Dungeon.js` and fonts among them). Several generator font and name files are
   also repeated 3 to 10 times inside `generator-hub`. Proposal: one vendored copy
   with the two host-specific files layered over it at build time.
7. **Forge public assets.** `ammo.wasm.wasm` and the default dice theme JSON each
   exist twice under `apps/forge/public/assets`.
8. **Small items.** UUID helpers (3), rarity lists (3, in dm-ui and doc-processor),
   and a currency conversion table (dm-ui) that duplicates `rules-5e` coin math.

## Guard rails to add as each item is done

- A test that fails if a consolidated file reappears (for example any
  `equipment-2024.json` under doc-api).
- A check that every derived artifact is generated from its sources and is not
  committed (the merged spell file was reproducible, but nothing proved it).
- Lint rules that ban re-implementing helpers that have a canonical export.
