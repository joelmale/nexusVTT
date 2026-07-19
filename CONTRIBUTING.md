# Contributing to Nexus VTT

Thank you for your interest in contributing to Nexus VTT! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 26.5.x and npm 11.x
- Docker Desktop (must be installed and running)

### Setup

1.  **Fork and Clone**
    Fork the repository and clone it to your local machine.

2.  **Install Dependencies**

    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env.local` file in the project root and add the database connection string:

    ```
    DATABASE_URL="postgres://nexus:password@localhost:5432/nexus"
    ```

4.  **Start Development Database**
    In a separate terminal, run the following command to start the PostgreSQL container:

    ```bash
    docker compose -f docker/docker-compose.dev.yml up -d postgres-dev
    ```

5.  **Run the Application**
    Once the database is running, use this command to start the frontend and backend servers:
    ```bash
    npm run start:all
    ```

## Project Structure

- `src/` - React application organized by UI, state, services, and domains
- `server/routes/` - HTTP endpoint registration
- `server/socket/` - Validated WebSocket transport and dispatch
- `server/repositories/` - PostgreSQL access
- `services/asset-service/` - npm workspace for asset APIs
- `shared/` - Runtime-validated contracts used across processes
- `tests/integration/` - Database and cross-process behavior

See [docs/architecture.md](docs/architecture.md) for dependency rules and the
target feature organization.

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow the existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic

### Component Guidelines

- Use functional components with hooks
- Keep components focused and single-purpose
- Use TypeScript interfaces for props
- Follow the glassmorphism design system
- Colocate component-only CSS, hooks, and focused unit tests with the feature

### State Management

- Use Zustand for global state
- Keep state updates immutable (use Immer)
- Organize state by feature domains
- Do not import a store from a service; inject a narrow runtime interface

### Git Workflow

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes with clear, descriptive commits
3. Test your changes thoroughly
4. Push to your fork and create a pull request

## Commit Messages

This project uses a simplified version of the [Conventional Commits](https://www.conventionalcommits.org/) specification. The format is enforced by a pre-commit hook.

The format is:
`<type>: <A short summary of the change>`

Where `<type>` must be one of the following:

- `feat`: A new feature
- `fix`: A bug fix
- `improvement`: An improvement to an existing feature
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, etc.)
- `test`: Adding or fixing tests
- `ci`: Changes to our CI configuration and scripts
- `chore`: Routine tasks or maintenance

**Example:**

```
feat: Add user login via OAuth

- Add passport.js for authentication.
- Create new /auth/google and /auth/discord routes.
- Update welcome page with login buttons.
```

## Reporting Issues

When reporting bugs, please include:

- Steps to reproduce the issue
- Expected vs actual behavior
- Browser and OS information
- Console errors (if any)

## Feature Requests

For new features:

- Describe the problem you're trying to solve
- Explain your proposed solution
- Consider how it fits with the project's goals of being lightweight and focused

## MVCR (Minimally Viable Capability Requirement)

Current focus areas for contributions:

- [ ] Session management improvements
- [ ] Dice roller enhancements
- [ ] UI/UX improvements with glassmorphism
- [ ] Real-time synchronization robustness
- [ ] Mobile responsiveness

Future planned features:

- [ ] Scene management with battle maps
- [ ] Token system
- [ ] Initiative tracker
- [ ] Drawing tools

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment for all contributors

## Questions?

Feel free to open an issue for any questions about contributing!
