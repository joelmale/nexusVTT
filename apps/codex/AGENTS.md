# Repository Guidelines

## Project Structure & Module Organization
- `services/doc-api` (Fastify + Prisma), `services/doc-processor` (BullMQ worker), `services/doc-websocket` (Express/WS), and `services/admin-ui` (Vite + React) are the main services. Keep service-specific code and configs scoped to each folder, including `prisma/` schemas and `.env*` files.
- Shared operational tooling lives at the repo root: `docker-compose*.yml` for local stacks, `run-tests.sh` and `test-stack.sh` for orchestration, `scripts/` for helper utilities, and `docs/` + `dev_docs/` for reference material.

## Build, Test, and Development Commands
- Start full stack locally: `docker compose up -d`; stop with `docker compose down`. For docs, run `./scripts/docs.sh` (served on :3003).
- Test runner (multi-service): `./run-tests.sh unit|integration|all` — installs missing deps, spins up test infra for integration, runs Jest across services, and tears down when needed.
- Service dev mode: `npm run dev` inside a service folder (watches TS, hot reloads). Build for production with `npm run build`; start compiled output via `npm start`.
- Admin UI: `npm run dev` for Vite dev server, `npm run build` for static assets, `npm run lint` for ESLint.

## Coding Style & Naming Conventions
- TypeScript throughout; stick to 2-space indentation, `camelCase` for variables/functions, `PascalCase` for classes/types, and `SCREAMING_SNAKE_CASE` for constants/env keys.
- Prefer explicit types and `async/await`; avoid `any` unless justified. Keep Fastify/Express handlers small and move logic into services/utilities.
- Use Prisma schema defaults per service; update migrations in the owning service only. Keep secrets in `.env` files (see `.env.example` in each service) and never commit real credentials.

## Testing Guidelines
- Jest is the primary framework. Unit tests live alongside services (e.g., `services/doc-processor/src/services/__tests__`), and integration suites for the API live in `services/doc-api/src/__tests__/*.integration.test.ts`.
- Run targeted suites with `npm test`, coverage with `npm run test:coverage`, and API integration with `npm run test:integration` (requires backing services; `docker-compose.test.yml` is provided).
- Keep tests deterministic: seed data via Prisma where possible, and prefer factories/fixtures over ad-hoc objects.

## Commit & Pull Request Guidelines
- Commits: short, imperative subjects (e.g., “Add OCR retry logic”); group related changes and keep noise low (avoid formatting-only commits without purpose).
- PRs: include a concise summary, linked issues, and test evidence (`./run-tests.sh unit|integration|all` output). Attach screenshots/GIFs for admin-ui changes. Note schema or environment changes clearly (e.g., migrations, new env vars).

## Security & Configuration Tips
- Node 22+ and npm 10+ are required (see `package.json` engines). Keep JWT secrets, DB URLs, Redis, S3, and Elastic endpoints in `.env`; sync sample values in `.env.example` when adding new config.
- For schema changes, run `npx prisma migrate dev` during development and `npx prisma migrate deploy` in CI/production; regenerate clients with `npm run prisma:generate` afterward in each affected service.
