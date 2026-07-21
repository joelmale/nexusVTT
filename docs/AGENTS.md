# Agent Guidelines for Nexus VTT

## Build/Lint/Test Commands

- **Build**: `npm run build` (TypeScript + Vite)
- **Lint**: `npm run lint` (ESLint with zero warnings)
- **Type Check**: `npm run type-check` (TypeScript strict mode)
- **All Tests**: `npm run test` (Vitest)
- **Unit Tests**: `npm run test:unit`
- **Integration Tests**: `npm run test:integration`
- **E2E Tests**: `npm run test:e2e` (Playwright)
- **Soak Tests**: `npm run test:soak:managed` or `npm run test:soak:chaos`
- **Single Test**: `vitest run <path-to-test-file>`
- **Test Watch**: `npm run test:watch`
- **Test Coverage**: `npm run test:coverage` (repository thresholds)
- **Layout Tests**: `npm run test:layout`

## Code Style Guidelines

- **Language**: TypeScript (strict mode enabled)
- **Framework**: React (react-jsx transform)
- **Imports**: `@/` for src/, additional aliases: `@/components`, `@/stores`, `@/types`, `@/utils`, `@/services`
- **Formatting**: Prettier (semi: true, trailingComma: "all", singleQuote: true, printWidth: 80, tabWidth: 2)
- **Editor**: 2-space indentation, LF line endings, UTF-8, trim trailing whitespace, insert final newline
- **Linting**: ESLint + TypeScript recommended + React hooks + React refresh
- **Naming**: camelCase vars/functions, PascalCase components/classes, UPPER_SNAKE_CASE constants
- **Types**: Strict typing required, interfaces for objects, `@typescript-eslint/no-explicit-any`: warn
- **Error Handling**: try/catch blocks with console.error logging
- **Unused Vars**: Error level, ignore args prefixed with `_`
- **Commits**: Conventional commits, max 72 characters

## Additional Rules

- No Cursor rules (.cursor/ or .cursorrules not found)
- No Copilot rules (.github/copilot-instructions.md not found)

## Realtime Durability Rules

- Treat PostgreSQL—not in-memory rooms or Redis—as the durable authority.
- Canonical snapshot writes compare-and-swap `gameState`, `syncToken`, and
  `stateVersion` in one transaction; ACK and broadcast only after commit.
- On a stale writer, return the authoritative snapshot/token/version and rebase
  the browser. Never let conflict recovery automatically overwrite the winner.
- Treat an identical full snapshot on reconnect as a version-neutral commit;
  advancing only the version would desynchronize replicas without a peer patch.
- Redis carries ephemeral fanout, presence, and host leases. Express sessions
  and ordered event history remain in PostgreSQL.
- Run `npm run test:e2e` for realtime changes. Its managed stack hard-kills a
  backend immediately after an ACK and verifies exact multi-client recovery.
- Run the conflict-enabled soak suite for changes to ordering, reconnects,
  Redis fanout, entity versions, or canonical state. PostgreSQL—not a local
  map—must serialize versioned entity acceptance across replicas.
- Keep `monitoring/` alert rules and
  `docs/operations/multiplayer-observability.md` synchronized with exported
  multiplayer metrics and SLO threshold changes.
