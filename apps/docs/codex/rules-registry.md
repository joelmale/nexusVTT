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

## How adapters consume it

The VTT and Forge backends proxy the catalog through the normal authenticated
Nexus backend. Browsers and the control plane never read doc-api directly.

### Shared catalog client: `@nexus/rules-contracts` (`catalogClient.ts`)

`overlayCatalog()`, `RulesCatalogClient`, and the storage/transport adapters
are pure and framework-agnostic so both apps' frontends (and any future host)
can share one merge implementation instead of re-deriving it:

- **`overlayCatalog({ entityType, ruleset, bundled, keyOf, published, removed, fromCatalogEntity })`**
  overlays published entities on a bundled SRD array by slug within one
  `(entityType, ruleset)` pair: a published entity replaces the bundled item
  with the same slug, a new slug is appended as custom content, and a
  tombstoned slug in `removed` is hidden unless a live publish supersedes it.
  Pure and synchronous.
- **`RulesCatalogClient`** polls `GET /manifest` with `If-None-Match`. On a
  new `catalogVersion` it fetches `GET /entities?since=<last applied
  version>`, upserts entities by stable `id`, deletes and tombstones the
  `removed` ones (keeping enough of each tombstone -- `id`, `entityType`,
  `ruleset`, `slug` -- for `overlayCatalog` to hide the right bundled slug
  later), and leaves `skipped` rows exactly as cached. It never throws:
  `sync()` resolves `{ status: 'offline', ... }` with the previous cache
  untouched on any transport failure, so callers always have *something* to
  render.
- **Storage adapters** are injected: `createInMemoryCatalogStorage()` for
  tests, `createBrowserCatalogStorage(window.localStorage)` for the browser.
  The browser adapter treats corrupted JSON, a schema-invalid payload, or a
  quota-exceeded write as an empty cache rather than throwing --
  `parseStoredRulesCatalogState()` (Zod-validated) is what decides "valid."
- **Transport** is injected too (`RulesCatalogTransport`); a convenience
  `createHttpCatalogTransport({ baseUrl, fetchImpl })` implements it against
  the shape both the VTT and (eventual) Forge BFFs expose:
  `${baseUrl}/rules/catalog/manifest` and `${baseUrl}/rules/catalog/entities`.

### VTT: backend BFF + frontend wiring (built)

- **`apps/vtt/server/routes/rulesCatalog.routes.ts`**, mounted under `/api`
  in `bootstrap/httpApp.ts`, exposes `GET /api/rules/catalog/manifest` and
  `GET /api/rules/catalog/entities` to signed-in VTT sessions. It reuses the
  same `DOC_API_URL` the document routes already proxy through
  (`server/routes/documents.ts`).
  - **Guest access: allowed.** Character creation
    (`@nexus/character-creator`) already works for guests with zero server
    round trips today -- it only reads the bundled SRD. Rules-catalog content
    is the same category of read (public D&D reference data, not account or
    campaign data), so gating it behind a real account would just leave
    guests on stale bundled content for no integrity benefit. A session
    (guest or authenticated) is still required -- not fully anonymous --
    matching the rest of `/api`.
  - Upstream responses are validated with `CatalogManifestSchema` /
    `CatalogEntitiesResponseSchema` (`@nexus/rules-contracts`) before being
    cached or forwarded; a shape mismatch is treated as an upstream failure.
  - `RulesCatalogCache` (`server/services/rulesCatalogClient.ts`) caches the
    manifest and each fixed `type|ruleset|since` entities combination in
    memory, revalidating upstream with the cached ETag once its TTL
    (default 5s; `RULES_CATALOG_CACHE_TTL_MS`) expires, and answers a
    matching client `If-None-Match` with `304` straight from cache. This is
    never a generic proxy: only `type`, `ruleset`, and `since` are read from
    the request, and only these two upstream paths are ever requested.
  - Any upstream failure (timeout -- default 3s, `RULES_CATALOG_TIMEOUT_MS`;
    network error; non-2xx/304; contract-validation failure) answers
    `503 { error: 'rules_catalog_unavailable', useBundled: true }`. It never
    serves a stale cached body for a hard failure.
- **`apps/vtt/src/services/rulesCatalogClient.ts`** is the frontend's
  `RulesCatalogClient` instance: `createHttpCatalogTransport` pointed at the
  BFF above, `createBrowserCatalogStorage(window.localStorage)`, and a
  `getRulesCatalogVersion()` helper that races `sync()` against a 2.5s
  timeout and resolves `null` (meaning "bundled SRD only") on anything but a
  clean, positive `catalogVersion`. Never throws, never blocks its caller
  longer than the timeout.
- **`Character.rulesCatalogVersion`** (`@nexus/character-contracts`, optional
  `number | null`) records the version `getRulesCatalogVersion()` returned at
  creation time. `SharedCharacterCreator.tsx` sets it right before
  `saveCreatedCharacter()` -- the *host's* persistence step, per CLAUDE.md
  "Shared character creation": the character-creator package itself gains no
  new persistence or awareness of the catalog. An existing character is never
  rewritten because a newer catalog version later appears (invariant 9).

### Not yet built

- **Forge's own BFF.** Forge has no backend proxy to doc-api yet, so it
  cannot safely reach the published catalog directly (doc-api must stay
  private -- invariant 2). It can adopt the same `@nexus/rules-contracts`
  client once that BFF exists; nothing in the shared client is VTT-specific.
- **Overlaying published content into `@nexus/character-creator`'s rendered
  spell/item/monster lists.** Today `dataService.ts` computes
  `SPELL_DATABASE` and friends synchronously from bundled JSON at module load
  and has no prop for a host to inject overrides. Wiring
  `overlayCatalog()` into that path touches an ADR-governed, multi-consumer
  package (`apps/docs/vtt/adr/0002-shared-character-creator.md`) and needs
  its own design pass (likely new `CharacterCreator` props plus async-load
  handling in a currently-synchronous data path) rather than a Phase 4
  drive-by change.
- Recording `rulesCatalogVersion` on campaigns. Only the character path is
  wired; campaign creation would need the same treatment in whichever module
  already persists campaign metadata.

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
