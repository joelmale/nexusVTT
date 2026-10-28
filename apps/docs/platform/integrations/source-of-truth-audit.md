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

Re-validated against the tree on **2026-10-28** (after the primitive-type,
modifier and dungeon consolidations, while other work was landing in parallel).
Corrections to the first version of this list are marked.

1. **Dice rolling.** _Done._ Parsing, validation, rolling, keep-highest/lowest,
   advantage and critical handling are one engine in `@nexus/rules-5e`
   (`dice.ts`, injectable random source, crypto default). The VTT server and
   client, `/roll`, the creator (including the rules-engine resolvers), Forge,
   the initiative store, the server initiative roll and dm-ui's `hoardRoller`
   call it. The 3D dice box in Forge still supplies its own physics results by
   design. Behaviour changes: the server rejects trailing junk such as `2d6xyz`,
   sums every constant, rejects subtracted dice, and takes a critical from the
   kept d20 under advantage.
2. **Character contracts.** Still accurate, with one addition.
   `character-contracts` (`Character`, `ForgeCharacter`) and
   `game-contracts/src/character.ts` (`CharacterRecord`) both define a
   character, and `apps/vtt/server/repositories/base.ts`, `server/routes/api.ts`
   and `Dashboard/types.ts` each define a `CharacterRecord`. **Added:** the
   creator has a third model, `Character` in `types/dnd.ts`, which is converted
   by `toNexusCharacter()`. They may be intentionally different (sheet versus
   actor versus wizard draft); that needs a decision and a documented mapping,
   not a guess.
3. **Rules constants.** Modifier formula: done, except the four codex services
   (admin-ui, dm-ui, doc-api, doc-processor), which do not depend on the
   contracts package; adding it also means touching their Dockerfiles and CI
   path filters. **Corrected:** skill-to-ability maps are still 3 (Forge
   `CharacterEditForm`, creator `rulesEngine/types/derived.ts`, creator
   `dataService.ts`); the proficiency-bonus rule exists 3 times
   (`gameConstants.json` via `dataService`, `rules-5e` `getProficiencyBonus`,
   `character-contracts` `calculateProficiencyBonus`), not 2; caster slot tables
   are 2 (`rules-5e` `FULL_CASTER_SLOTS`, creator `data/spellSlots.ts`); hit dice
   are 1 (`coreSchedules.ts`). The "6 ability lists" figure no longer holds: the
   upper-case ones are done except dm-ui `homebrewModel.ts` and Forge
   `PaperAbilityScoresPanel.tsx`; the lower-case ones are the SRD spelling (see
   below).
4. **Edition spelling.** **Added:** `Edition` is canonical in
   `character-contracts`, but `RulesEdition` (`rules-5e`) and `Ruleset`
   (`rules-contracts`, a zod enum) still spell the same two values, and about 30
   inline `'2014' | '2024'` unions remain across Forge, VTT, the creator and
   dm-ui. Replace the inline ones with `Edition`; decide whether `Ruleset` stays
   as the wire name.
5. **2014 equipment and classic magic items.** Still accurate. The only copies
   are `apps/codex/services/doc-api/src/data/5e-srd-equipment-2014.json` and
   `5e-srd-magic-items.json`; the creator package has only the 2024
   `equipment.json`, so 2014 characters use 2024-year items. Proposal: move both
   into the shared package, then have doc-api consume them as 2024 equipment
   already is.
6. **Forge public assets.** **Corrected:** not two files but seven. The whole
   default dice theme directory (`default.json`, `theme.config.json`, two
   diffuse maps, normal map, specular map) exists under both
   `public/assets/themes/default` and `public/assets/dice-box/themes/default`,
   and `ammo.wasm.wasm` under both `assets/ammo` and `assets/dice-box/ammo`.
7. **Small items.** UUID helpers: 3, still accurate (dm-ui `lib/utils.ts`,
   dm-ui `sessionSpineGenerator.ts`, creator `diceService.ts`). Rarity lists: 3,
   accurate (dm-ui `fixture-registry/types.ts`, dm-ui `srd-items-api.ts`,
   doc-processor `validation.ts`). **Corrected:** the dm-ui currency table
   (`GP_PER_UNIT` in `srd-items-api.ts`) does _not_ duplicate `rules-5e`; there
   is no coin math in `rules-5e`. It is a single copy, so it is only a candidate
   for moving there, not a duplicate.

Consolidated claims above were re-checked and still hold: no
`equipment-2024.json` or `5e-SRD-Spells-Merged.json` in the tree, the doc-api
`sharedSourceOfTruth` test exists, `apps/vtt/public/one-page-dungeon` is gone,
and the only modifier formula outside the codex services is the canonical one.

## Guard rails

- Done: tests fail if the doc-api equipment copy, the old dungeon tree, or an
  inline modifier formula (outside the codex services) reappears.
- Still to add: a check that every derived artifact is generated from its
  sources and is not committed, and lint rules that ban re-implementing helpers
  that have a canonical export.

## Not consolidated on purpose

- **Lower-case ability keys** (`str`, `dex`, ...) in SRD data, admin-ui and rules-contracts are the SRD's own spelling, not a second copy of `AbilityKey`.
- **`AbilityName` in `types/tools.ts`** is the long form (`Strength`) used for tool descriptions.
- **Generator font files** repeated across the hub's generators are vendored per generator and loaded by relative URL; sharing them needs a build step, so they stay.

## Local book text

`packages/character-creator/local-content/*.json` is gitignored and merged over the bundled spell data at load time. See its README. It is never committed and is absent from CI-built images.
