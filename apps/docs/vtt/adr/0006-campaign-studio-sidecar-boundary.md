# ADR 0006: Establish Campaign Studio as a VTT sidecar

- Status: Accepted
- Date: 2026-09-25

## Context

Campaign Studio prepares narrative and mechanical objects before a live game.
Its first functional workflow publishes the Glass Harbor session plan and
activates that pinned revision in Nexus VTT. The current interface lives in
`apps/codex/services/dm-ui`, but repository location must not make NexusCodex
the owner of campaign data or live game state.

Without a shared contract, the prototype UI, HTTP API, PostgreSQL records, and
VTT command handlers could each invent a different representation of session
plans, references, and scenes. TypeScript alone cannot validate untrusted JSON
from an API, database migration, import, or offline cache.

## Decision

Campaign Studio is a DM-focused VTT sidecar. The VTT backend owns canonical
campaign preparation data, authorization, publication, activation records,
and live game state. NexusCodex remains the document owner, Forge remains the
reusable mechanical-definition author, and the asset service remains the
binary asset owner.

Shared preparation schemas live initially in `@nexus/game-contracts`. Data is
accepted across process and persistence boundaries only after parsing it from
`unknown` with those Zod schemas.

Authored objects and live objects remain separate:

- campaign entries and scene templates are versioned authored objects;
- a ready session plan pins every referenced revision;
- activation binds one immutable plan revision to a VTT session;
- encounters and actors become mutable runtime objects only through existing
  idempotent VTT commands.

The Glass Harbor Session 12 fixture is the first reference workflow. A valid
fixture contains a pinned scene, encounter, note, and player handout. Broken
reference fixtures remain structurally valid so publication can report missing
dependencies separately from malformed JSON.

Campaign identity is the VTT PostgreSQL campaign UUID, carried in Studio routes
as `/campaigns/:campaignId/*` and passed explicitly to preparation status,
publication, and activation operations. Display names are non-unique labels and
must never be used to discover, create, or associate canonical campaign data.
The Ashes of Veyra fixture is instead addressed in the separate
`/demo/ashes-of-veyra/*` namespace; compatibility redirects do not turn its
slug into a server campaign identity.

## Consequences

Campaign Studio can evolve independently from its temporary UI location while
sharing one vocabulary with the VTT. API and repository work has a runtime-
validated target, and publishing can distinguish invalid payloads from valid
objects whose dependencies are unavailable or unauthorized.

This introduces explicit schema versions and revisions on preparation objects.
Writers must perform expected-revision checks, and schema migrations must be
reviewed before older offline drafts or persisted revisions are accepted.

## Addendum (2026-10-28): Ratified Authoring Primitives (CS-77, CS-78, CS-79, CS-80)

1. **Client-Bundle Search Indexing (`CS-77`)**: Rather than round-tripping to a
   dedicated server `/prep/search` route for every keystroke in an open campaign,
   Campaign Studio indexes the loaded `CampaignFixtureBundle` in memory
   (`searchCampaign.ts`), composing entities, secrets, inbox notes, items, and
   homebrew monsters. Server search is reserved for compendium lookups.
2. **MentionToken Serialization (`CS-78`)**: Prose fields support markdown
   `@[Label](ref:id)` tokens authored through `MentionTextarea.tsx`. On persistence,
   tokens are mapped to `CampaignObjectRef` objects and wrapped in a standard
   Lexical JSON envelope.
3. **Workspace Location (`CS-79`)**: `@nexuscodex/dm-ui` remains situated at
   `apps/codex/services/dm-ui` to preserve Docker/Caddy homelab routing, with shared
   runtime and authoring contracts maintained in `packages/game-contracts`.
4. **Realtime Boundaries (`CS-80`)**: Authoring persistence relies on transactional
   compare-and-swap (HTTP 409 conflict detection). Real-time co-DM WebSocket fanout
   is scoped to Phase 5.
