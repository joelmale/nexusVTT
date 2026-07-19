# Nexus VTT Architecture

Nexus VTT is a TypeScript monorepo with three runtime boundaries: the React
web application, the Express/WebSocket API, and the asset-service workspace.
PostgreSQL stores accounts, campaigns, sessions, and durable game data. The
host remains authoritative for live tabletop interactions, while the server
validates transport messages, maintains room state, and persists snapshots.

## Repository boundaries

```text
nexusVTT/
├── src/                         # React web application
│   ├── components/              # Feature UI and colocated CSS
│   ├── data/                    # Static rules/catalog data
│   ├── hooks/                   # Reusable UI orchestration
│   ├── services/                # Browser and network adapters
│   ├── stores/                  # Zustand domain state
│   ├── types/                   # Web-domain types
│   └── utils/                   # Pure, domain-neutral helpers
├── server/
│   ├── routes/                  # HTTP route registration
│   ├── socket/                  # WebSocket validation and dispatch
│   ├── repositories/            # PostgreSQL access
│   └── services/                # Server use cases and external adapters
├── services/asset-service/      # Independent workspace and runtime
├── shared/                      # Runtime-validated cross-boundary contracts
├── tests/integration/           # Cross-process and database tests
└── scripts/                     # Deterministic build/asset tooling
```

New UI work should be feature-oriented. A feature directory owns its
components, styles, hooks, and feature-only types. Promote code to a top-level
`hooks`, `services`, `stores`, or `shared` directory only after it has multiple
consumers.

## Dependency direction

The intended frontend dependency flow is:

```text
components → hooks/stores → services → shared contracts
```

- Services must not import Zustand stores. Runtime composition belongs in a
  small bootstrap module such as `gameStateSyncRuntime.ts`.
- Stores may depend on service interfaces, but cross-store reads should use a
  narrow context adapter instead of importing another complete store.
- `shared/` must not import from `src/`, `server/`, or a workspace package.
- The server and asset service validate unknown JSON before exposing typed
  values to application code.
- HTTP endpoints live in `server/routes`; `server/index.ts` owns process and
  room lifecycle rather than endpoint implementation.

## State and synchronization

Zustand stores own client state by domain. `gameStore` coordinates the active
session and scene state, while event mutation logic is isolated in
`gameEventHandlers.ts`. `characterStore`, `documentStore`, and initiative state
remain separate domains.

Live updates use a validated transport envelope. The host sends either a full
snapshot or a JSON patch chained to a content hash. The server validates the
envelope, checks the base hash, commits the authoritative room state, then
acknowledges the sender and broadcasts a patch to peers. Invalid or stale
messages request a full resynchronization.

## Asset ownership

`@3d-dice/dice-box` is the source of truth for runtime dice assets. The
postinstall sync script copies its published assets into
`public/assets/dice-box`, compares JSON semantically, and validates every theme
configuration, referenced texture, mesh, collider, and face map. Do not hand
edit generated mesh JSON. Add project-owned themes in a separate theme
directory and keep all file references relative to that directory.

Static character rules live in `src/data/character`; `dataManager.ts` contains
behavior only. Generated assets and diagnostic reports are ignored rather than
committed.

## Testing and file size

- Colocate focused component tests with the component when practical.
- Keep shared utility tests in `tests/unit` and cross-boundary tests in
  `tests/integration`.
- A UI or service file approaching 500 lines should be reviewed for extraction.
  Large generated datasets and generated mesh files are explicit exceptions.
- Every boundary parser needs valid and invalid fixture coverage.

Run `npm run test:ci` before merging. CI rejects static import cycles, verifies
that dice assets match the installed package, and tests the asset-service
workspace.
