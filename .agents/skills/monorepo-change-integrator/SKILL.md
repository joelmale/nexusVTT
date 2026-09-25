---
name: monorepo-change-integrator
description: >-
  Keep Nexus monorepo changes deployable when they add or change npm workspaces,
  package dependencies, Docker images, Compose services, environment variables,
  routes, or CI targets. Use while implementing cross-product changes or fixing
  integration drift; do not use for isolated code changes with no build or
  deployment contract impact.
---

# Monorepo Change Integrator

Treat package manifests, container builds, deployment configuration, and CI as
one delivery contract. Prefer the repository's executable checks and central
affected-target metadata over copied workspace or image lists.

## Workflow

1. Identify the affected products, deployable services, and internal workspace
   dependencies before editing integration files.
2. Update each owning `package.json` and the root lockfile. Internal imports must
   be declared by the consuming workspace, even if a clean root install happens
   to make them available.
3. For a Docker build, include every transitive internal workspace manifest in
   the install layer and use `npm run build:workspace-deps -- --workspace <name>`
   before building the target workspace. Do not maintain a separate handwritten
   build order.
4. When a service, image, Dockerfile, or security scope changes, update
   `.github/ci/affected-targets.json`. CI workflows should consume that graph
   rather than introduce another path or image matrix.
5. When adding or renaming an environment variable, search Compose files,
   example env files, runtime validation, workflows, and deployment docs. Keep
   secrets out of committed examples and preserve existing deployment values.
6. When changing gateway routes, ports, networks, or health checks, update both
   the Compose contract and the relevant operational documentation.
7. Run the narrow checks first, then the builds or tests for every affected
   product. At minimum run:

   ```text
   npm run check:workspace-lock
   npm run check:docker-build-contracts
   npm run test:affected-targets
   ```

   Also validate changed workflow YAML and run `docker compose config` for each
   changed Compose file when its required environment is available.

8. Deliver integration changes through a pull request. Keep the aggregate
   required check stable so branch protection does not depend on dynamic job
   names. Direct pushes are reserved for an explicitly authorized emergency.

## Review Boundary

Before declaring the change ready, inspect the final diff for duplicated
workspace lists, untracked environment requirements, skipped image targets, and
documentation that now contradicts runtime behavior. If a contract cannot be
validated automatically, state the manual deployment check required in the PR.
