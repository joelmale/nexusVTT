# NexusCodex Setup

This document is intentionally short. The older integrated Compose and Prisma
instructions were retired because they no longer match this repository.

## Current Status

NexusCodex is deployed as part of the Dockhand-managed homelab stack. Nexus VTT
talks to it through private Docker networking:

```text
browser -> Nexus VTT frontend -> Nexus VTT backend -> doc-api
                                           \--------> doc-websocket
```

The VTT backend authenticates the user and proxies document routes. Do not
publish `doc-api` directly while `AUTH_DISABLED=true`.

## Canonical Runbook

Use [NexusCodex Homelab Deployment](operations/nexuscodex-homelab.md) for live
operations, validation, OAuth recovery notes, rollback details, and the current
browser file-transfer limitation.

## Related Architecture

Use [NexusCodex Integration](NEXUSCODEX_INTEGRATION.md) for the high-level
integration shape and known incomplete paths.

## Local Development

Local document-service development is not currently represented by a maintained
Compose file in this repository. Prefer running Nexus VTT normally with:

```bash
npm run start:all
```

Then point `DOC_API_URL` at a separately running NexusCodex API when working on
document integration.
