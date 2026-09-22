---
name: homelab-dockhand-deployer
description: >-
  Encapsulates deployment, updates, and maintenance workflows for the Nexus homelab stack (nexus-vtt2)
  managed through Dockhand MCP. Enforces critical safety rules: atomic .env merging to prevent variable wiping,
  database migration sequencing, unified frontend gateway routing, network isolation for doc-api, and post-deploy health verification.
---

# Homelab Dockhand Deployer

Safely orchestrates Docker Compose deployments and updates to the `nexus-vtt2` homelab stack using the Dockhand MCP server.

## When to Use

Activate this skill when:
- Deploying or updating the `nexus-vtt2` stack or individual containers via Dockhand.
- Updating environment variables (`.env`) on the homelab host.
- Staging or building production multi-stage Docker images (`frontend.Dockerfile`, server builds).
- Running post-deployment health checks and verifying network isolation.

---

## Critical Safety Rules (MUST FOLLOW)

1. **NEVER Wipe the Raw `.env`**:
   - Dockhand replaces the entire `.env` file upon update.
   - You **MUST** call `get_stack_env_raw(stack_id)` first, parse its existing `content`, merge your variable changes into that content, and only then call `update_stack_env_raw`.
2. **Database Migration Sequencing**:
   - Before restarting backend replicas, verify that required SQL migrations have been executed in PostgreSQL:
     1. `2026-01-05-add-campaign-roomcode.sql`
     2. `2026-07-19-event-journal.sql`
     3. `2026-07-19-game-state.sql`
     4. `2026-07-19-entity-version.sql`
3. **Private `doc-api` Boundary**:
   - If `AUTH_DISABLED=true`, `doc-api` must remain strictly internal on the Docker network (`codex-net`) and must never be exposed to public host ports.
4. **Unified Frontend Gateway Routing**:
   - All static SPAs (`/`, `/forge/`, `/codex-dm/`, `/codex-admin/`) are served directly from disk by the unified `frontend` Nginx gateway.
   - Do not spin up separate `nexus-forge`, `dm-ui`, or `admin-ui` Nginx containers.

---

## Deployment & Verification Workflow

For detailed MCP tool calls, see [dockhand-mcp-cheatsheet.md](./references/dockhand-mcp-cheatsheet.md).

### Step 1: Inspect Stack State
```json
{
  "ServerName": "dockhand",
  "ToolName": "list_stacks",
  "Arguments": {}
}
```
Locate the stack ID for `nexus-vtt2`.

### Step 2: Merge Environment Variables
```javascript
// Pseudocode for safe .env merge
const rawEnv = await dockhand.get_stack_env_raw({ stack_id });
const currentContent = rawEnv.content;
const mergedContent = mergeEnv(currentContent, {
  VITE_BASE_URL: '/',
  // New or updated variables
});
await dockhand.update_stack_env_raw({ stack_id, content: mergedContent });
```

### Step 3: Deploy / Redeploy Stack
Deploy or restart the stack containers with new compose definitions or image tags:
```json
{
  "ServerName": "dockhand",
  "ToolName": "deploy_stack",
  "Arguments": { "stack_id": "nexus-vtt2" }
}
```

### Step 4: Verification Probes
Always verify both probes before declaring success:
- **Frontend Gateway Probe**:
  `GET http://<host>:<port>/health` -> Expect HTTP 200 `OK`.
- **Backend & Realtime Coordinator Probe**:
  `GET http://<host>:<port>/api/system/health` -> Expect HTTP 200 with database and Redis connection statuses reported healthy.
