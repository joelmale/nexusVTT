# Repository Guidelines

## Project Structure & Modules

- **Frontend Entry**: App entry in `src/main.tsx`; UI components split into `src/components` (organized by feature or type), `src/actions` (game actions), `src/hooks` (custom React hooks), `src/stores` (Zustand state management), `src/services` (API calls and utilities), and `src/utils` (helper functions).
- **Backend**: Runtime lives in `server/` (Express.js with WebSocket support, PostgreSQL database helpers), with build output in `dist/server`.
- **Shared Types**: Shared types between frontend and asset server in `shared/types.ts`.
- **Tests**: Unit tests in `tests/unit/**` (component and utility tests); integration tests in `tests/integration/**` (end-to-end flows, database interactions).
- **Documentation**: Developer docs in `docs/`, deployment guides in `DEPLOYMENT.md`, and local dev setup in `LOCAL-DEV-GUIDE.md`. Scripts in `scripts/` for asset management and setup.
- **Configuration**: TypeScript configs (`tsconfig.json`, `tsconfig.node.json`, `tsconfig.server.json`); ESLint (`eslint.config.js`); Prettier (`.prettierrc`); Vite config (`vite.config.ts`); Docker compose files in `docker/`.
- **Other**: Patches in `patches/`; GitHub workflows in `.github/workflows/`; Husky pre-commit hooks in `.husky/`; Docker configurations for production deployment.

## Build, Test, and Dev Commands

- **Installation**: `npm install` — install dependencies (requires Node 26.5.0+, npm 11.0.0+).
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

````
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
- **Advanced Patterns**:
  - Implement hybrid state management with IndexedDB persistence.
  - Use optimistic updates for better UX.
  - Implement conflict resolution strategies.
  - Use lazy loading for heavy 3D dependencies.
  - Implement service workers for PWA functionality.

## Testing Guidelines

- **Framework**: Vitest with Testing Library for React components.
- **Structure**: Unit tests in `tests/unit/**`; integration in `tests/integration/**`.
- **Naming**: Test files as `<Component>.test.tsx`; describe blocks as "Component behavior".
- **Writing Tests**:
  - Focus on realistic user interactions (clicks, inputs).
  - Mock external dependencies (API calls, stores, WebSocket, IndexedDB).
  - Use `screen` for queries; prefer `getByRole` over `getByTestId`.
  - Test happy paths and error cases.
  - Use `waitFor` for async operations.
  - Test accessibility with `getByRole`.
  - Example:

    ```typescript
    import { render, screen, fireEvent, waitFor } from '@testing-library/react';
    import { CharacterCard } from '@/components/CharacterCard';

    test('displays character name and handles clicks', async () => {
      render(<CharacterCard name="Gandalf" onClick={jest.fn()} />);
      expect(screen.getByText('Gandalf')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Gandalf'));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
    ```

- **Coverage**: Aim for high coverage; run `npm run test:coverage`.
- **CI**: Run `npm run test:ci` before PRs (includes lint, types, tests).
- **Running Tests**:
  - All tests: `npm run test`
  - Unit tests: `npm run test:unit`
  - Integration tests: `npm run test:integration`
  - Watch mode: `npm run test:watch`
  - Single file: `npm run test -- tests/unit/components/Example.test.tsx`
- **Test Setup**:
  - Use `tests/setup.ts` for global test configuration.
  - Mock WebSocket, IndexedDB, and other external dependencies.
  - Use `fake-indexeddb` for IndexedDB testing.
  - Mock service workers for PWA testing.
  - Use `jsdom` environment for browser APIs.

## Advanced Patterns

- **Hybrid State Management**: Implement local-first IndexedDB persistence with real-time multiplayer synchronization. Use `src/services/hybridStateManager.ts` for core state management.
- **Optimistic Updates**: Improve UX by applying changes immediately while syncing with server. Use `src/actions/gameActions.ts` for action creators with optimistic flags.
- **Conflict Resolution**: Implement strategies for handling concurrent edits. Use `src/types/hybrid.ts` for conflict resolution types.
- **Lazy Loading**: Optimize performance by lazy loading heavy dependencies like 3D libraries and PDF viewers.
- **Service Workers**: Implement PWA functionality with caching strategies for offline use. Configure in `vite.config.ts` with VitePWA plugin.
- **Asset Management**: Use sophisticated asset system with generators and themes. Manage through `src/services/assetFavorites.ts` and `src/services/tokenAssets.ts`.
- **OAuth Integration**: Implement Google and Discord OAuth flows. Configure in `server/auth.ts` and environment variables.
- **WebSocket Communication**: Real-time multiplayer features with WebSocket. Handle in `src/services/storageWorkerClient.ts` and server-side WebSocket handlers.
- **IndexedDB Persistence**: Local-first data storage with IndexedDB. Use `src/services/indexedDBAdapter.ts` for storage operations.
- **Performance Optimization**: Implement code splitting, lazy loading, and bundle analysis. Configure in `vite.config.ts` with manual chunks and rollup plugins.

## Configuration Files

- **Vite Config**: `vite.config.ts` - Main build configuration with PWA, aliases, and optimization.
- **TypeScript Configs**:
  - `tsconfig.json` - Frontend TypeScript configuration
  - `tsconfig.server.json` - Server-side TypeScript configuration
  - `tsconfig.node.json` - Node.js specific configuration
- **ESLint Config**: `eslint.config.js` - Linting rules with TypeScript support
- **Prettier Config**: `.prettierrc` - Code formatting rules
- **Vitest Config**: `vitest.config.ts` - Testing framework configuration with coverage thresholds
- **Docker Compose**: `docker/docker-compose.yml` - Production deployment configuration
- **Docker Dev**: `docker/docker-compose.dev.yml` - Development environment setup
- **Docker Test**: `docker/docker-compose.test.yml` - Integration testing environment
- **Environment**: `.env` - Environment variables for development and production

## Database & Server Setup

- **PostgreSQL**: Use PostgreSQL 16+ for data persistence. Configure in Docker compose files.
- **Redis**: Use Redis for sessions and pub/sub. Configure in production Docker setup.
- **Schema**: Database schema in `server/schema.sql` with migrations in `server/migrations/`.
- **Server**: Express.js backend with WebSocket support in `server/index.ts`.
- **Authentication**: OAuth2 authentication with Google and Discord providers.
- **API Routes**: RESTful API endpoints in `server/routes/` directory.
- **WebSocket Handlers**: Real-time communication in server WebSocket implementation.

## Asset Management

- **Asset Types**: Maps, tokens, props, dice themes, and generator assets.
- **Asset Organization**: Static assets in `public/`, processed assets in `static-assets/`.
- **Asset Generation**: Scripts for generating thumbnails and manifests.
- **Asset Themes**: Configurable themes for dice and other visual elements.
- **Asset Search**: Search and categorization functionality.
- **Asset Favorites**: User-specific favorite assets management.

## Testing Infrastructure

- **Unit Tests**: Component and utility tests in `tests/unit/`.
- **Integration Tests**: End-to-end flows in `tests/integration/`.
- **Test Setup**: Global test configuration in `tests/setup.ts`.
- **Mocking**: Comprehensive mocking for WebSocket, IndexedDB, and external dependencies.
- **Coverage**: Code coverage reporting with V8 provider and multiple formats.
- **CI Pipeline**: Automated testing in GitHub Actions workflows.
- **Test Data**: Mock data and fixtures for consistent testing.

## Development Workflow

- **Local Development**: Use `npm run start:all` for full stack development.
- **Frontend Development**: Use `npm run dev` for hot module replacement.
- **Backend Development**: Use `npm run server:dev` for server-side development.
- **Database Management**: Use Docker Compose for PostgreSQL management.
- **Asset Processing**: Use scripts for asset organization and optimization.
- **Testing**: Use `npm run test:ci` for complete CI pipeline validation.
- **Building**: Use `npm run build:all` for production builds.

## Deployment & Production

- **Docker Swarm**: Production deployment with Docker Swarm orchestration.
- **NFS Storage**: Persistent storage using NFS shares for data durability.
- **Health Checks**: Container health checks for reliability.
- **Load Balancing**: Multiple replicas with VIP endpoint mode.
- **Environment Variables**: Secure configuration management.
- **Security**: HTTPS enforcement, CORS configuration, and security headers.
- **Monitoring**: Container monitoring and logging setup.

## Security & Best Practices

- **Input Validation**: Validate all user inputs server-side.
- **Authentication**: JWT-based authentication with OAuth providers.
- **Authorization**: Role-based permissions with fine-grained access control.
- **Data Protection**: Encrypt sensitive data and use secure connections.
- **Session Management**: Secure session handling with Redis storage.
- **Dependency Security**: Regular security scanning and dependency updates.
- **Environment Security**: Never commit secrets or credentials to repository.
- **CORS Configuration**: Proper cross-origin resource sharing setup.
- **Helmet Security**: Security headers with Express Helmet middleware.

## Performance Optimization

- **Bundle Analysis**: Use bundle analyzer to identify optimization opportunities.
- **Code Splitting**: Implement dynamic imports for better loading performance.
- **Image Optimization**: Optimize images for web delivery with appropriate formats.
- **Caching Strategies**: Implement service worker caching for offline functionality.
- **Database Optimization**: Use prepared statements and connection pooling.
- **API Optimization**: Implement efficient data fetching and pagination.
- **Frontend Optimization**: Use React.memo, lazy loading, and performance profiling.
- **Asset Optimization**: Optimize static assets for faster loading times.

## Troubleshooting & Debugging

- **Development Server**: Check port conflicts and use `npm run start:all`.
- **Database Issues**: Verify Docker is running and PostgreSQL is accessible.
- **Build Errors**: Check TypeScript configuration and dependency versions.
- **Testing Issues**: Verify test setup and mock configurations.
- **Performance Issues**: Use browser dev tools and bundle analyzer.
- **Authentication Issues**: Check OAuth provider configurations and environment variables.
- **WebSocket Issues**: Verify server connectivity and message handling.
- **Asset Issues**: Check asset generation scripts and file permissions.

## Contributing Guidelines

- **Feature Development**: Create feature branches from main branch.
- **Code Review**: All changes require peer review before merging.
- **Testing**: Include comprehensive tests for all new features.
- **Documentation**: Update documentation for API changes and new features.
- **Breaking Changes**: Communicate breaking changes with migration guides.
- **Performance**: Consider performance implications of new features.
- **Security**: Follow security best practices for all contributions.
- **Compatibility**: Ensure cross-browser and cross-device compatibility.

## Version Management

- **Semantic Versioning**: Follow SemVer for version numbering.
- **Changelog**: Maintain detailed changelog for all releases.
- **Release Process**: Automated release process with GitHub Actions.
- **Dependency Updates**: Regular dependency updates with security scanning.
- **Migration Guides**: Provide migration guides for major version updates.
- **Backwards Compatibility**: Maintain backwards compatibility where possible.
- **Deprecation Policy**: Clear deprecation policy with migration timelines.

## Tools & Utilities

- **Development Tools**: Use browser dev tools, VS Code extensions, and debugging tools.
- **Asset Tools**: Use asset generation and optimization scripts.
- **Database Tools**: Use PostgreSQL CLI tools and database management utilities.
- **Testing Tools**: Use Vitest, Testing Library, and coverage reporting tools.
- **Build Tools**: Use Vite, TypeScript, and bundling tools.
- **Docker Tools**: Use Docker CLI and Docker Compose for container management.
- **Git Tools**: Use Git CLI and GitHub for version control.
- **Performance Tools**: Use bundle analyzer, Lighthouse, and performance profiling tools.

## Common Issues & Solutions

- **Port Conflicts**: Use `npm run start:all` for automatic port resolution.
- **Database Connection**: Verify Docker is running and PostgreSQL is accessible.
- **Build Failures**: Check TypeScript configuration and dependency versions.
- **Test Failures**: Verify test setup and mock configurations.
- **Authentication Errors**: Check OAuth provider configurations and environment variables.
- **WebSocket Disconnections**: Verify server connectivity and network configuration.
- **Asset Loading Issues**: Check asset generation scripts and file permissions.
- **Performance Problems**: Use profiling tools to identify bottlenecks.

## Future Enhancements

## Future Enhancements

- **Real-time Collaboration**: Enhanced real-time multiplayer features.
- **Advanced Analytics**: User behavior and performance analytics.
- **Mobile App**: Native mobile applications for iOS and Android.
- **Advanced AI**: AI-powered game master assistance and content generation.
- **Virtual Reality**: VR support for immersive gaming experiences.
- **Cloud Integration**: Cloud storage and synchronization services.
- **Plugin System**: Extensible plugin architecture for custom features.
- **Advanced Security**: Enhanced security features and compliance certifications.
- **CI/CD**:
  - All PRs must pass lint, type-check, and tests.
  - Coverage thresholds: 20% lines, 18% functions, 16% branches, 20% statements.
  - Integration tests run with Docker Compose.
  - Security scans run in CI pipeline.
- **Documentation**: Update relevant docs when changing APIs or behavior.
- **Testing Requirements**: All new features must include unit tests; integration tests required for database/API changes.
- **Code Review Process**:
  - Pull requests require at least one approving review before merge
  - Use draft PRs for work-in-progress changes
  - Squash and merge preferred for clean commit history
  - Automated checks must pass before merge
- **Release Process**:
  - Automated releases triggered by GitHub Actions
  - Version bumping handled by semantic-release
  - Changelog automatically generated from commit messages
  - Release artifacts include Docker images and npm packages
- **Environment Management**:
  - Development: Local Docker Compose setup
  - Staging: Separate Docker Swarm cluster
  - Production: Production Docker Swarm with NFS storage
  - Environment variables managed through Docker secrets
- **Documentation**: Update relevant docs when changing APIs or behavior.
- **Testing Requirements**: All new features must include unit tests; integration tests required for database/API changes.
- **Code Review Process**:
  - Pull requests require at least one approving review before merge
  - Use draft PRs for work-in-progress changes
  - Squash and merge preferred for clean commit history
  - Automated checks must pass before merge
- **Release Process**:
  - Automated releases triggered by GitHub Actions
  - Version bumping handled by semantic-release
  - Changelog automatically generated from commit messages
  - Release artifacts include Docker images and npm packages
- **Environment Management**:
  - Development: Local Docker Compose setup
  - Staging: Separate Docker Swarm cluster
  - Production: Production Docker Swarm with NFS storage
  - Environment variables managed through Docker secrets
- **Code Review Process**:
  - Pull requests require at least one approving review before merge
  - Use draft PRs for work-in-progress changes
  - Squash and merge preferred for clean commit history
  - Automated checks must pass before merge
- **Release Process**:
  - Automated releases triggered by GitHub Actions
  - Version bumping handled by semantic-release
  - Changelog automatically generated from commit messages
  - Release artifacts include Docker images and npm packages
- **Environment Management**:
  - Development: Local Docker Compose setup
  - Staging: Separate Docker Swarm cluster
  - Production: Production Docker Swarm with NFS storage
  - Environment variables managed through Docker secrets
````
