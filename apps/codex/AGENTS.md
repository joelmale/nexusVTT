# Repository Guidelines

## Project Structure & Module Organization

- `services/doc-api` (Fastify + Prisma), `services/doc-processor` (BullMQ worker), `services/doc-websocket` (Express/WS), and `services/admin-ui` (Vite + React) are the main services. Keep service-specific code and configs scoped to each folder, including `prisma/` schemas and `.env*` files.
- Shared operational tooling lives in root-level `scripts/`. The [Codex developer docs](../docs/codex/index.md) cover service architecture and setup.

## Build, Test, and Development Commands

- Follow the [Codex development setup](../docs/codex/development-setup.md) for local dependencies, migrations, and workspace start commands. Run `npm run start:docs` from the repository root to preview the docs.
- Use the [homelab runbook](../docs/codex/operations/nexuscodex-homelab.md) for the integrated deployment and health checks.
- Service dev mode: `npm run dev` inside a service folder (watches TS, hot reloads). Build for production with `npm run build`; start compiled output via `npm start`.
- Admin UI: `npm run dev` for Vite dev server, `npm run build` for static assets, `npm run lint` for ESLint.

## Coding Style & Naming Conventions

- TypeScript throughout; stick to 2-space indentation, `camelCase` for variables/functions, `PascalCase` for classes/types, and `SCREAMING_SNAKE_CASE` for constants/env keys.
- Prefer explicit types and `async/await`; avoid `any` unless justified. Keep Fastify/Express handlers small and move logic into services/utilities.
- Use Prisma schema defaults per service; update migrations in the owning service only. Keep secrets in `.env` files (see `.env.example` in each service) and never commit real credentials.

## Testing Guidelines

- Codex service tests use Vitest. Unit tests live alongside service code, and the API integration suite uses its own Vitest configuration.
- From the root, run `npm run test:codex` for the Codex and Campaign Studio test group, or `npm run test:codex:integration` for the API integration suite with disposable backing services. Run `npm test` from a service workspace for targeted tests.
- Keep tests deterministic: seed data via Prisma where possible, and prefer factories/fixtures over ad-hoc objects.

## Commit & Pull Request Guidelines

- Commits: short, imperative subjects (e.g., “Add OCR retry logic”); group related changes and keep noise low (avoid formatting-only commits without purpose).
- PRs: include a concise summary, linked issues, and test evidence from the relevant workspace checks. Attach screenshots/GIFs for admin-ui changes. Note schema or environment changes clearly (e.g., migrations, new env vars).

## Security & Configuration Tips

- Use the Node.js version in the repository root’s `.nvmrc` and npm 11. Keep JWT secrets, DB URLs, Redis, and S3 endpoints in `.env`; sync sample values in `.env.example` when adding new config.
- For schema changes, run `npx prisma migrate dev` during development and `npx prisma migrate deploy` in CI/production; regenerate clients with `npm run prisma:generate` afterward in each affected service.
