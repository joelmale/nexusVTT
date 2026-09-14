# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds React/TypeScript code: `components/` for UI, `hooks/` for shared logic, `context/` for providers, `services/` for data access (IndexedDB, dice, equipment), `utils/` for calculators/helpers, and `data/` for JSON/TS rules content. Entry is `src/main.tsx` rendering `AppWithProviders`.
- `public/` contains static assets (dice textures, sounds, themes); `docs/` has user-facing guides; `scripts/` carries Docker/build helpers. Build output lives in `dist/`.

## Build, Test, and Development Commands
```bash
npm run dev        # Start Vite dev server
npm run build      # Production bundle (use build:dev for faster debug bundle)
npm run preview    # Preview the production build locally
npm run lint       # ESLint over TS/TSX
npm test           # Vitest unit/UI tests (jsdom)
npm run test:ui    # Vitest UI runner
npm run size-limit # Bundle size guard
```
Docker helpers: `npm run docker:build`, `docker:run`, `docker:logs`, `docker:restart`, `docker:stop`.

## Coding Style & Naming Conventions
- TypeScript + React 18 with Vite; prefer functional components and hooks.
- ESLint (typescript-eslint, react-hooks, react-refresh) enforces quality: no console in prod code, exhaustive deps required, unused vars flagged unless prefixed with `_`.
- Formatting follows the existing style (2-space indent, no mandatory semicolons). Use PascalCase for components/files, camelCase for utilities, SCREAMING_SNAKE_CASE for constants. Hooks must start with `use...`; tests mirror source path with `.test.ts`/`.test.tsx`.

## Testing Guidelines
- Vitest with `jsdom` and Testing Library (`@testing-library/react`/`user-event`). Setup file: `src/test/setup.ts`.
- Coverage thresholds (global): statements 80%, branches 75%, functions 80%, lines 80%; reports emit text/json/html/lcov. Aim to keep new code at/above these gates.
- Prefer behavior-focused tests near the feature under test; mock browser APIs sparingly to keep IndexedDB/dice flows realistic.

## Commit & Pull Request Guidelines
- Follow the observed Conventional Commit style (`feat: ...`, `fix: ...`, `chore: ...`). Keep commits scoped and descriptive.
- PRs should include: brief summary of intent, key changes, and test evidence (`npm test`/`npm run lint`). Add screenshots/GIFs for UI-facing changes and link related issues.
- Avoid committing build artifacts (`dist/`) or local data exports; keep JSON data additions validated and minimal.
