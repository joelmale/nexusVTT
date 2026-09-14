# Nexus documentation application

This Docusaurus application is the single documentation source for the Nexus
monorepo. Content is divided into four independent documentation instances:

- `platform/` — monorepo policy, integrations, and migration history
- `vtt/` — Nexus VTT features, architecture, development, and operations
- `forge/` — Nexus Forge user guides
- `codex/` — Nexus Codex services, APIs, development, and operations

Run commands from the repository root:

```bash
npm run install:docs
npm run start:docs
npm run test:docs
```

`test:docs` type-checks the site and performs a production build with broken
links configured as fatal errors.

Do not create application-local documentation trees. Add content to the
appropriate directory here and update its sidebar when the page should appear
in primary navigation.
