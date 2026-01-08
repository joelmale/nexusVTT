# Repository Guidelines

## Project Structure & Modules

- **Frontend Entry**: App entry in `src/main.tsx`; UI components split into `src/components` (organized by feature or type), `src/actions` (game actions), `src/hooks` (custom React hooks), `src/stores` (Zustand state management), `src/services` (API calls and utilities), and `src/utils` (helper functions).
- **Backend**: Runtime lives in `server/` (Express.js with WebSocket support, PostgreSQL database helpers), with build output in `dist/server`.
- **Assets**: Static assets in `public/` (images, icons, generators); dynamic assets in `src/assets`; processed assets in `static-assets/`.
- **Tests**: Unit tests in `tests/unit/**` (component and utility tests); integration tests in `tests/integration/**` (end-to-end flows, database interactions).
- **Documentation**: Developer docs in `docs/`, deployment guides in `DEPLOYMENT.md`, and local dev setup in `LOCAL-DEV-GUIDE.md`. Scripts in `scripts/` for asset management and setup.
- **Configuration**: TypeScript configs (`tsconfig.json`, `tsconfig.node.json`, `tsconfig.server.json`); ESLint (`eslint.config.js`); Prettier (`.prettierrc`); Vite config (`vite.config.ts`); Docker compose files in `docker/`.
- **Other**: Patches in `patches/`; GitHub workflows in `.github/workflows/`; Husky pre-commit hooks in `.husky/`.

## Build, Test, and Dev Commands

- **Installation**: `npm install` — install dependencies (requires Node 20.19.0+, npm 10.0.0+).
- **Development**:
  - `npm run dev` — start Vite dev server for client (hot reload).
  - `npm run server:dev` — start server in watch mode with tsx and dotenv.
  - `npm run start:all` — orchestrate client + server + Postgres via Docker.
- **Building**:
  - `npm run build` — build client (TypeScript + Vite).
  - `npm run build:server` — build server only.
  - `npm run build:all` — build both client and server.
  - `npm run preview` — preview built client.
  - `npm run server:start` — start production server from dist.
- **Linting & Type Checking**:
  - `npm run lint` — run ESLint with autofix (max 100 warnings).
  - `npm run type-check` — run TypeScript type checking.
- **Testing**:
  - `npm run test` — run all tests once.
  - `npm run test:unit` — run unit tests only.
  - `npm run test:integration` — run integration tests.
  - `npm run test:all` — run both unit and integration tests.
  - `npm run test:ci` — full CI pipeline: lint + type-check + unit + integration.
  - `npm run test:watch` — run tests in watch mode.
  - `npm run test:coverage` — run tests with coverage report.
  - **Running a Single Test**: `npm run test -- tests/unit/components/Example.test.tsx` (or `npx vitest run tests/unit/components/Example.test.tsx`).
- **Database**:
  - `npm run db:start` — start Postgres container.
  - `npm run db:stop` — stop Postgres container.
  - `npm run db:down` — stop and remove container.
  - `npm run db:reset` — reset database (down with volumes + up).
  - `npm run db:logs` — tail Postgres logs.
  - `npm run db:shell` — open psql shell.
- **Docker**:
  - `npm run docker:dev` — start dev environment with Docker Compose.
  - `npm run docker:dev:build` — build and start dev environment.
  - `npm run docker:dev:down` — stop dev environment.
- **Assets**:
  - `npm run organize-assets` — organize asset files.
  - `npm run update-assets` — update asset references.
  - `npm run generate-default-manifest` — generate asset manifest.
  - `npm run generate-thumbnails` — generate thumbnails.
  - `npm run generate-assets` — generate thumbnails and manifest.
  - `npm run optimize-images` — optimize images.
- **Other**:
  - `npm run analyze` — build with bundle analyzer.

## Code Style & Naming

- **Language**: TypeScript everywhere; strict mode enabled; avoid `any` (warned by ESLint).
- **React**: Prefer functional components with hooks; use React 19 features.
- **Imports**:
  - Use absolute imports with `@/` alias for `src/` (configured in `tsconfig.json` paths).
  - Group imports: React imports first, then third-party libraries, then local imports.
  - Sort imports alphabetically within groups.
  - Avoid default exports for components; use named exports.
  - Example:
    ```typescript
    import React, { useState } from 'react';
    import { Button } from 'lucide-react';
    import { useAuth } from '@/hooks/useAuth';
    import { CharacterCard } from '@/components/CharacterCard';
    ```
- **Formatting**:
  - Follow Prettier defaults with custom config: semicolons required, single quotes, trailing commas everywhere, print width 80, tab width 2.
  - Auto-formatted via `npm run lint` (lint-staged on pre-commit).
- **Types**:
  - Define explicit types for all props, state, and return values.
  - Use interfaces for object shapes; prefer `type` for unions/primitives.
  - Leverage TypeScript's strict mode for better type safety.
  - Example: `interface User { id: string; name: string; }`
- **Naming Conventions**:
  - Components: PascalCase (`CharacterLibrary`, `DiceRoller`).
  - Hooks: camelCase with `use` prefix (`useCharacterCreation`).
  - Stores: descriptive names per domain (`campaignStore`, `chatStore`).
  - Functions/Variables: camelCase (`getUserData`, `isLoggedIn`).
  - Files: kebab-case for components (`character-card.tsx`), camelCase for utilities (`assetManager.ts`).
  - Constants: UPPER_SNAKE_CASE (`MAX_PLAYERS = 8`).
  - Avoid abbreviations; use descriptive names.
- **Error Handling**:
  - Use try-catch blocks for async operations.
  - Throw specific error types or messages; avoid generic errors.
  - Log errors with appropriate levels (console.error for client, server logging).
  - Handle errors gracefully in UI (loading states, error boundaries).
  - Example:
    ```typescript
    try {
      const data = await fetchUser(id);
      return data;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      throw new Error('User fetch failed');
    }
    ```
- **Styling**:
  - Use glassmorphism with existing CSS variables (e.g., `--glass-bg`, `--glass-border`).
  - Keep styles scoped; prefer CSS modules or styled-components if needed.
  - Follow theme consistency; avoid hardcoded colors.
- **Zustand Stores**:
  - One store per domain (`src/stores/`); colocate related utilities.
  - Use immer for immutable updates.
- **Backend**:
  - Use Express with middleware (helmet, cors, compression).
  - WebSocket for real-time features.
  - PostgreSQL with pg library; use prepared statements.
- **Security**:
  - Validate inputs; use Helmet for security headers.
  - Store secrets in env vars; never commit credentials.
  - Use JWT for auth; validate tokens on each request.
- **Performance**:
  - Lazy load components/routes.
  - Optimize images/assets.
  - Use React.memo for expensive components.
  - Avoid unnecessary re-renders.

## Testing Guidelines

- **Framework**: Vitest with Testing Library for React components.
- **Structure**: Unit tests in `tests/unit/**`; integration in `tests/integration/**`.
- **Naming**: Test files as `<Component>.test.tsx`; describe blocks as "Component behavior".
- **Writing Tests**:
  - Focus on realistic user interactions (clicks, inputs).
  - Mock external dependencies (API calls, stores).
  - Use `screen` for queries; prefer `getByRole` over `getByTestId`.
  - Test happy paths and error cases.
  - Example:

    ```typescript
    import { render, screen, fireEvent } from '@testing-library/react';
    import { CharacterCard } from '@/components/CharacterCard';

    test('displays character name', () => {
      render(<CharacterCard name="Gandalf" />);
      expect(screen.getByText('Gandalf')).toBeInTheDocument();
    });
    ```

- **Coverage**: Aim for high coverage; run `npm run test:coverage`.
- **CI**: Run `npm run test:ci` before PRs (includes lint, types, tests).
- **Running Tests**: All tests with `npm run test`; watch mode with `npm run test:watch`; single file with `npm run test -- path/to/test.tsx`.

## Commit & Pull Request Practices

- **Commits**: Follow simplified Conventional Commits: `feat: add dark mode toggle`, `fix: resolve dice roll bug`, `docs: update API guide`, `chore: update deps`.
- **Focus**: Small, focused commits; describe intent and changes clearly.
- **PRs**: Include summary, testing notes, screenshots/GIFs for UI, linked issues. Scope to one feature/fix; update docs if behavior changes.
- **Reviews**: Ensure CI passes; provide constructive feedback.
