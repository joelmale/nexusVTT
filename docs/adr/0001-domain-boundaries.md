# ADR 0001: Enforce runtime and domain boundaries

- Status: Accepted
- Date: 2026-07-18

## Context

The repository grew from a client-only prototype into a web application, API,
WebSocket server, database-backed platform, and asset service. Direct imports
between stores and services created cycles, cross-process JSON was trusted as
typed data, and process setup files accumulated unrelated route logic.

## Decision

The web app, API, asset service, and shared contracts are explicit boundaries.
Cross-boundary data starts as `unknown` and is parsed by a shared runtime
validator. Frontend services are store-agnostic; bootstrap modules inject the
narrow state capabilities they need. HTTP routes, socket dispatch, repository
access, and process lifecycle remain separate server concerns.

Feature-specific UI, styles, hooks, and types are colocated. Static data is
separate from behavior. New dependencies must follow the direction documented
in `docs/architecture.md`.

## Consequences

The code has more small composition modules and explicit interfaces, but fewer
cycles and safer runtime boundaries. Domain code can be tested without loading
the full application store. Future extraction into deployable packages does
not require rewriting business logic.
