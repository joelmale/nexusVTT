# Dockhand MCP Tools & Deployment Cheatsheet

This reference details the Dockhand MCP tool calls required for homelab maintenance.

---

## 1. Stack Inspection & Environment Management

### Fetch Stack Status
```json
{
  "ServerName": "dockhand",
  "ToolName": "get_stack_compose",
  "Arguments": {
    "stack_id": "nexus-vtt2"
  }
}
```

### Safe Raw .env Retrieval
```json
{
  "ServerName": "dockhand",
  "ToolName": "get_stack_env_raw",
  "Arguments": {
    "stack_id": "nexus-vtt2"
  }
}
```

### Safe Raw .env Update
> [!CAUTION]
> Never pass an isolated key-value object to `update_stack_env_raw`. Always prepend/append to the full merged text from `get_stack_env_raw`.

```json
{
  "ServerName": "dockhand",
  "ToolName": "update_stack_env_raw",
  "Arguments": {
    "stack_id": "nexus-vtt2",
    "content": "EXISTING_KEY=val\nNEW_KEY=val\n"
  }
}
```

---

## 2. Container Health & Log Diagnostics

### Check Container Status
```json
{
  "ServerName": "dockhand",
  "ToolName": "get_container",
  "Arguments": {
    "container_id": "nexus-vtt2-frontend-1"
  }
}
```

### Tail Container Logs
```json
{
  "ServerName": "dockhand",
  "ToolName": "get_container_logs",
  "Arguments": {
    "container_id": "nexus-vtt2-server-1",
    "tail": 100
  }
}
```

### Execute Diagnostics Command Inside Container
```json
{
  "ServerName": "dockhand",
  "ToolName": "exec_container",
  "Arguments": {
    "container_id": "nexus-vtt2-server-1",
    "command": ["npm", "run", "type-check"]
  }
}
```

---

## 3. Homelab Network Isolation Audit

Verify that the following rules hold true in `compose.yaml`:
1. `doc-api` is attached to `codex-net` without exposing `ports: ["3000:3000"]` to the host.
2. `postgres` and `redis` are attached to `backend-net` and internal only.
3. The only exposed container on public ingress is `frontend` (ports `80`/`443` or mapped port `8080`).
