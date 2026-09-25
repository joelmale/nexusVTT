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

## Consequences

Campaign Studio can evolve independently from its temporary UI location while
sharing one vocabulary with the VTT. API and repository work has a runtime-
validated target, and publishing can distinguish invalid payloads from valid
objects whose dependencies are unavailable or unauthorized.

This introduces explicit schema versions and revisions on preparation objects.
Writers must perform expected-revision checks, and schema migrations must be
reviewed before older offline drafts or persisted revisions are accepted.
