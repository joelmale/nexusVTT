# NexusForge

## Project Overview

This project is a single-page, fully responsive React/TypeScript application for creating, managing, and viewing D&D 5e character sheets. It is designed to be **100% client-side**, using IndexedDB for storage, which means no backend or user accounts are required. All data stays on the user's device.

The application features:
- A step-by-step character creation wizard and personality-based generator.
- An interactive character sheet with clickable rolls.
- **Monster Library**: Browse, search, and manage standard (SRD) and custom monsters.
- **Encounter Builder**: Create and manage combat encounters.
- **Decorative UI**: Custom "Boarders" system for immersive fantasy UI elements.
- Realistic 3D dice rolling animations using WebGL.
- The ability to import and export character data as JSON files for backup and sharing.
- A responsive design that works on desktop and mobile devices.

## Building and Running

### Prerequisites

- Node.js 18+ and npm
- A modern web browser with WebGL support

### Key Commands

The following commands are available in `package.json`:

- **`npm run dev`**: Starts the Vite development server, typically available at `http://localhost:3000`.
- **`npm run build`**: Compiles the TypeScript code and builds the application for production into the `dist` directory.
- **`npm run preview`**: Serves the production build locally for testing.
- **`npm run lint`**: Lints the codebase using ESLint to enforce code quality.
- **`npm run test`**: Runs the unit tests using Vitest.
- **`npm run docker:build`**: Builds the Docker image.
- **`npm run docker:run`**: Runs the application in a Docker container.

### Docker Deployment

The project includes a `Dockerfile` and `docker-compose.yml` for easy deployment using Docker and Nginx. See `DEPLOYMENT.md` for detailed instructions.

## Development Conventions

- **Technology Stack**: The project is built with React 18, TypeScript, and Vite.
- **Styling**: Styling is done using Tailwind CSS (v4) for a utility-first approach, supplemented by a custom SVG border system in `src/boarders`.
- **State Management**: State is managed globally using React Context and Providers (`src/context`). Key contexts include `CharacterContext`, `DiceContext`, `MonsterContext`, and `ThemeContext`. Custom hooks in `src/hooks` expose this state to components.
- **Data Storage**: All data (characters, custom monsters, encounters) is stored in the browser's IndexedDB via `src/services/dbService.ts`. This service handles database migrations and schema updates.
- **3D Dice**: The 3D dice rolling feature is implemented using the `@3d-dice/dice-box` library. The main component for this is `src/components/DiceSystem/DiceBox3D.tsx`.
- **Testing**: Unit and component tests are written using Vitest and React Testing Library (`src/test`).
- **Code Structure**: 
    - `src/context`: Global state providers.
    - `src/hooks`: Custom hooks for accessing state and logic.
    - `src/services`: Business logic and data persistence (DB, API wrappers).
    - `src/components`: UI components, organized by feature (e.g., `CharacterSheet`, `MonsterLibrary`).
    - `src/boarders`: Decorative SVG border components.

## Key Files

- **`src/AppWithProviders.tsx`**: The root component that wraps `App` with all necessary Context Providers.
- **`src/App.tsx`**: The main application layout and routing logic (tabs between Characters and Monster Library).
- **`src/services/dbService.ts`**: The IndexedDB abstraction layer for all data persistence.
- **`src/context/CharacterContext.tsx`**: Manages the state of player characters.
- **`src/context/MonsterContext.tsx`**: Manages the state of monsters and encounters.
- **`src/components/CharacterSheet/CharacterSheet.tsx`**: The main view for interacting with a character.
- **`src/components/MonsterLibrary/MonsterLibrary.tsx`**: The interface for browsing and managing monsters.
- **`src/components/EncounterView/EncounterView.tsx`**: The interface for running combat encounters.
- **`vite.config.ts`**: The configuration file for the Vite build tool.