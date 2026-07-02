# ADR-0010 — Asset service: evolve embedded static server vs. new standalone service

Status: **Proposed — DECIDED IN PACKET C0** (do not implement against this stub)

## Context (verified @ e29131b)
The current "static asset server" is embedded in `server/index.ts` (~lines 242, 1600–1718):
`ASSETS_PATH` env, `GET /manifest.json`, `GET /search`, `GET /category/:category`, express.static
mounts. Client contract: `src/services/assetManager.ts` (`getAssetsByCategory(category,page,limit)`
→ `{assets, hasMore}`). The Atlas backend must own base library + TMT (~16k files) + user assets.

## Options
A. **Extract to standalone service** beside doc-api (own container/stack in dockhand; VTT
   proxies or clients hit it directly per ADR-0012). Precedent: NexusCodex `DOC_API_URL` pattern.
B. **Evolve in place** inside server/index.ts, extract later once endpoints stabilize.
C. New service from scratch, greenfield code, migrate routes onto it.

## Decision drivers
Release-cadence independence · IO/memory isolation for 16k-file manifest + thumbnails ·
dockhand operational cost of another stack (deploy quirk: CI freeze → force-recreate via UI) ·
migration cost of 5 routes + assetManager back-compat · TMT/user-asset volume mounts (NAS).

Orchestrator lean (to validate in C0, not assume): **Option A**, keeping assetManager.ts's API
shape via thin back-compat for one release.

## Decision
_(pending C0 — record here, set Status: Accepted (Joel, date))_
