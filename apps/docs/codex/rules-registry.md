# Rules registry

The rules registry is the Codex-owned, versioned store of D&D 5e rules entities
(spells, items and monsters) for both the 2014 and 2024 rulesets. It implements
Phase 4 of the
[private admin control plane plan](/platform/private-admin-control-plane).
Imported source documents and authored rules entities are related but
distinct. A document can supply provenance (`sourceDocumentId`), but only
reviewed, published revisions reach consumers.

## Contracts: `@nexus/rules-contracts`

`packages/rules-contracts` holds the Zod schemas and inferred TypeScript types.
Codex validation, the admin forms, and the VTT/Forge catalog adapters all share
it. Every data document carries an explicit `ruleset: '2014' | '2024'`, and each
entity type is a discriminated union on that field:

| Type    | Covers                                                                                                                                                                                                                                                            | 2014/2024 differences                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| spell   | level 0-9, school, casting time (with reaction/bonus-action trigger), range and area, V/S/M components with material text, cost (gp) and consumption, duration, concentration, ritual, classes, description, higher-level text                                     | none yet                                                              |
| item    | category, rarity, attunement and requirement, cost, weight, weapon (damage, versatile damage, properties, range, magic bonus), armor/shield (AC, Dex cap, Str requirement, stealth), charges, activation, spells cast, rules text                                  | weapon `mastery` is 2024 only                                         |
| monster | size, type/subtype/swarm, alignment, AC with source, HP average plus formula, speeds, abilities, saves, skills, damage vulnerabilities/resistances/immunities (with qualifiers), condition immunities, senses, languages, CR and XP, proficiency bonus, traits, actions, bonus actions, reactions, legendary actions, spellcasting | `initiative`, `habitats`, `treasure` and `gear` are 2024 only         |

Beyond basic shape, the contract checks these cross-field rules: CR↔XP (CR 0
may be 0 or 10 XP), proficiency bonus by CR, HP average equals the floor of the
formula's average, material details only when M is present, triggers only on
reaction/bonus-action spells, no ritual cantrips, concentration requires a
timed/special duration, weapon/armor statistics match the category, and
versatile weapons carry versatile damage. Objects are strict, so unknown keys
(for example a 2024 field on a 2014 entity) are rejected.

**Classes, species, backgrounds and features are out of scope.** They are
added (as new `RulesEntityType` enum values plus schemas) only once their
consumers exist.

`schemaVersion` is currently `1` for every type. Changing a contract
incompatibly requires a new schema version and a data migration of stored
revisions. The catalog skips (and reports) published rows that no longer parse
rather than failing whole responses.

Fixtures for both rulesets (valid and invalid) ship in
`@nexus/rules-contracts/dist/fixtures`.

## Persistence (doc-api Prisma)

Migration `20260924000000_add_rules_registry` is additive and idempotent-safe:
guarded `CREATE ... IF NOT EXISTS` and `DO` blocks.

- `rules_entities`: stable UUID, `entityType`, `slug`, `ruleset` (CHECK
  `2014|2024`), `schemaVersion`, `headRevisionNumber` (the concurrency
  token), `currentPublishedRevisionId`, `catalogVersion` (last catalog version
  that changed its published state), `archivedAt`. The combination
  `(entityType, ruleset, slug)` is unique.
- `rules_entity_revisions`: `revisionNumber` unique per entity, `status`
  (`draft | validated | published | superseded`), `data` JSONB, provenance
  (`sourceDocumentId`, `sourceLicense`), `createdBy`, `validatedBy/At`,
  `publishedBy/At`, `catalogVersion`, `supersededAt`,
  `restoredFromRevisionNumber` (on rollbacks).
- `rules_catalog_versions`: append-only log of monotonic catalog versions with
  the actor, action (`publish | rollback | archive | unarchive`) and changed
  entity IDs.

Immutability is enforced by the service and, where the migration is applied,
by the `rules_entity_revisions_guard` trigger. Revision content is
write-once. Only lifecycle columns change, along draft → validated →
published → superseded. Any revision that was ever published cannot be
deleted, and the catalog version log rejects `UPDATE`/`DELETE`. Test databases
built with `prisma db push` do not get the triggers.

## Revision and publication semantics

- **Copy-on-write drafts.** Every save appends a new revision. The previous
  open draft becomes `superseded`, and the current published revision is
  untouched, so the full edit history is diffable and nothing is overwritten.
- **Optimistic concurrency.** Every mutation of an existing entity must carry
  the head revision number (`expectedRevisionNumber` in the body or
  `If-Match: "<n>"`). Archive/unarchive accept it optionally. The entity
  row is locked (`SELECT ... FOR UPDATE`), and a mismatch returns
  `409 revision_conflict` with the current head revision. Nothing is ever
  last-write-wins.
- **Validate** runs the contract, then cross-references and uniqueness. Monster
  spellcasting, monster 2024 gear and item spells must resolve to a
  published, non-archived entity in the same ruleset. A reference that exists
  only in the other ruleset is reported as `ruleset_incompatible_reference`.
  No other live entity of the same type and ruleset may publish the same name.
  A passing draft becomes `validated`.
- **Publish** accepts only a `validated` head and re-runs validation under the
  lock, because references may have been archived since. In one transaction
  it supersedes the previous published revision, marks the head published,
  points the entity at it, and appends a new catalog version. Catalog
  versions are serialized with a transaction-scoped advisory lock.
- **Rollback** publishes a new revision that copies an older, previously
  published revision's data (`restoredFromRevisionNumber`). History is never
  rewritten. An open draft is superseded and remains in history.
- **Archive/unarchive** hides or restores the entity in the catalog. When it
  was published, this bumps the catalog version so consumers see a tombstone.
- Publication never touches active sessions (invariant 9). Consumers decide
  when to adopt a new catalog version.

## API contract

### Internal admin API (control-api → doc-api only)

Every mutation requires `X-Nexus-Actor` (401 `actor_required` otherwise), which
is recorded as `createdBy`/`validatedBy`/`publishedBy`. If
`RULES_ADMIN_SERVICE_TOKEN` is set, every admin route also requires
`X-Nexus-Service-Token`. Errors use
`{ error, code, issues?, current? }` (`RulesErrorResponse`).

| Method | Path                                                 | Purpose                                                            |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------ |
| GET    | `/api/admin/rules/entities`                          | List/filter (`type`, `ruleset`, `status`, `q`, `archived`, paging) |
| POST   | `/api/admin/rules/entities`                          | Create entity with draft revision 1 (409 `slug_conflict`)          |
| GET    | `/api/admin/rules/entities/:id`                      | Entity, head, current published, revision history (`ETag`)         |
| GET    | `/api/admin/rules/entities/:id/revisions/:n`         | One revision with data                                             |
| PUT    | `/api/admin/rules/entities/:id/draft`                | Append a draft revision (expected revision required)               |
| POST   | `/api/admin/rules/entities/:id/validate`             | Validate head; `{ valid, issues, entity }`                         |
| GET    | `/api/admin/rules/entities/:id/preview?revision=n`   | Normalized `CatalogEntity` as consumers would receive it           |
| POST   | `/api/admin/rules/entities/:id/publish`              | Publish validated head; `{ catalogVersion, entity }`               |
| POST   | `/api/admin/rules/entities/:id/rollback`             | `{ expectedRevisionNumber, targetRevisionNumber }`                 |
| GET    | `/api/admin/rules/entities/:id/diff?from=a&to=b`     | RFC 6902 operations between two revisions                          |
| POST   | `/api/admin/rules/entities/:id/archive`              | Archive (catalog tombstone)                                        |
| POST   | `/api/admin/rules/entities/:id/unarchive`            | Unarchive                                                          |

### Published catalog (read-only)

| Method | Path                                                          | Purpose                                                                                   |
| ------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/api/rules/catalog/manifest`                                 | `{ catalogVersion, publishedAt, etag, counts[ruleset][type] }`                            |
| GET    | `/api/rules/catalog/entities?type&ruleset&since=<version>`    | Published entities changed after `since`, plus `removed` tombstones and `skipped` rows |

Both catalog routes send weak ETags derived from the catalog version and
answer `If-None-Match` with `304`. Each read runs in one `REPEATABLE READ`
transaction, so the version always matches the rows returned.

## How adapters should consume it (later wave)

The VTT and Forge backends proxy the catalog through the normal authenticated
Nexus backend. Browsers and the control plane never read doc-api directly.
The recommended flow:

1. Start from the **bundled SRD** in `@nexus/character-creator` as the
   baseline, keyed by `(ruleset, entityType, slug)`.
2. Poll `GET /manifest` with `If-None-Match`. On a new `catalogVersion`, fetch
   `GET /entities?since=<last applied version>` and upsert each entity by
   stable `id` and `revisionId`. Drop the IDs in `removed`, and keep the
   cached or bundled copy for `skipped`. Record the applied `catalogVersion`
   only after the whole delta is stored.
3. **Overlay** published entities on the bundled SRD by slug within a ruleset.
   A published entity replaces the bundled one, and custom slugs add new
   content.
4. Persist the catalog version (and entity revision IDs where rules
   stability matters) on characters and campaigns when they are created.
   Never rewrite an active session because a newer version appeared.
5. If Codex or the proxy is unreachable, keep serving the last cached catalog,
   or the bundled SRD alone. Rules content is never a hard dependency of play.

## SRD import comparison

`npm run rules:srd-compare --workspace=nexus-codex-doc-api -- --database-url <url> [--reset] [--json-out file]`
imports the bundled SRD (2014 spells and monsters, 2024 spells, 2024 equipment)
through the real draft → validate → publish path. It then reports counts,
stable identifiers, schema failures, unresolved references and catalog/source
field mismatches. It refuses any database whose name lacks `test` or
`isolated`, never runs on startup, and supports `--offline` (contract check
only). Apply migrations to the isolated database first with
`npx prisma migrate deploy`.

Result on 2026-09-24 against an isolated Postgres 16:

| Source       | Records | Published | Not published                                                                                              |
| ------------ | ------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| spell/2014   | 319     | 319       | none                                                                                                       |
| spell/2024   | 339     | 338       | `glyph-of-warding` flagged concentration with an "until dispelled" duration (source defect)                 |
| item/2024    | 213     | 211       | duplicate `hooded-lantern` record; `fine-clothes` duplicates the name of `clothes-fine`                     |
| monster/2014 | 334     | 329       | CR/XP disagreements in source: ankheg, brass-dragon-wyrmling, deep-gnome-svirfneblin, dretch, riding-horse |

There were no unresolved spell references and no catalog/source field
mismatches. No 2014 items or 2024 monsters are bundled.
