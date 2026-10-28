---
title: Source-of-truth audit
description: Where data, rules logic and contracts are duplicated across the monorepo, what has been consolidated, and the proposed order for the rest.
---

# Source-of-truth audit

Audited **2026-10-27** from tracked files: byte-identical files, content overlap
between JSON datasets, and repeated rules constants, helpers and type
definitions. Counts are from that scan, not estimates.

## Consolidated

| Item                               | Before                                                                                                                                                                                    | Now                                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2024 SRD equipment                 | `packages/character-creator/src/data/equipment.json` and an identical committed copy in doc-api (213 entries, zero differences)                                                           | One file. doc-api's build copies it into `dist/data`, its image build copies it from the package, CI rebuilds doc-api when it changes, and the seeder's monorepo fallback path (which had an off-by-one) is fixed.       |
| Merged SRD spell list              | A committed, generated `5e-SRD-Spells-Merged.json` (341 spells) with a script no npm script or CI job ran; it re-contained both source files                                              | Deleted. `mergeSpellSources` computes it at load time from `2014/5e-SRD-Spells.json` and `2024/5e-SRD-spells.json`; the VTT server reads the 2024 file directly. The result is verified deep-equal to the old file.      |
| Item text in the Studio compendium | 100 of 213 items had no `description`, so Campaign Studio showed "No description provided" for every tool                                                                                 | The converter derives a factual summary from the structured SRD fields when no prose exists.                                                                                                                             |
| Primitive types                    | `AbilityKey` in `character-contracts`, plus separate `Edition`, `Ability`, `ForgeEdition`, `ForgeAbility` types and six literal ability lists, five of them in the creator, VTT and Forge | `character-contracts` exports `ABILITY_KEYS`, `AbilityKey`, `EDITIONS` and `Edition` (it has no dependencies, so every package can import it). The creator, game-contracts zod schemas, VTT and Forge derive from those. |
| Ability modifier formula           | `Math.floor((score - 10) / 2)` written out about 35 times                                                                                                                                 | One implementation, `calculateAbilityModifier` in `character-contracts`; `rules-5e`'s `getAbilityModifier` delegates to it. 27 copies in Forge, VTT and the creator were replaced, and a test fails if one reappears.    |
| One-Page Dungeon generator         | Two trees of 37 files; the one under `apps/vtt/public` was last touched in the monorepo move and nothing served it                                                                        | Deleted. The generator hub's copy (the one mounted at `/generator-hub/`) is the only one; a test fails if the old tree returns.                                                                                          |

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
3. **Rules constants.** The modifier formula is done. Skill-to-ability maps exist 3 times, ability lists 6, and the proficiency
   bonus table, hit dice and caster slot tables once each in the creator and
   `rules-5e`. Proposal: `rules-5e` is the home; replace copies with imports.
   The four codex services (admin-ui, dm-ui, doc-api, doc-processor) still carry
   their own modifier copy because none of them depends on the contracts
   package; adding that dependency also means touching their Dockerfiles and CI
   path filters, so it is its own step.
4. **2014 equipment and classic magic items.** The only copies are in doc-api
   (`5e-srd-equipment-2014.json`, `5e-srd-magic-items.json`); the shared package
   has no 2014 equipment, so 2014 characters use 2024-year items. Proposal: move
   both into the shared package, then have doc-api consume them as above.
5. **Forge public assets.** `ammo.wasm.wasm` and the default dice theme JSON each
   exist twice under `apps/forge/public/assets`.
6. **Small items.** UUID helpers (3), rarity lists (3, in dm-ui and doc-processor),
   and a currency conversion table (dm-ui) that duplicates `rules-5e` coin math.

## Guard rails to add as each item is done

- A test that fails if a consolidated file reappears (for example any
  `equipment-2024.json` under doc-api).
- A check that every derived artifact is generated from its sources and is not
  committed (the merged spell file was reproducible, but nothing proved it).
- Lint rules that ban re-implementing helpers that have a canonical export.

## Not consolidated on purpose

- **Lower-case ability keys** (`str`, `dex`, ...) in SRD data, admin-ui and rules-contracts are the SRD's own spelling, not a second copy of `AbilityKey`.
- **`AbilityName` in `types/tools.ts`** is the long form (`Strength`) used for tool descriptions.
- **Generator font files** repeated across the hub's generators are vendored per generator and loaded by relative URL; sharing them needs a build step, so they stay.

## Local book text

`packages/character-creator/local-content/*.json` is gitignored and merged over the bundled spell data at load time. See its README. It is never committed and is absent from CI-built images.
