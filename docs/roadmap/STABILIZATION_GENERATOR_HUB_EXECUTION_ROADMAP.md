# Nexus VTT Stabilization and Generator Hub Execution Roadmap

> Status: planned  
> Roadmap owner: orchestrator/integrator  
> Last model-matrix review: 2026-09-10  
> Scope: security stabilization, storage ownership, Dungeon Generator Hub,
> multiplayer completion, and document-route completion

## 1. Purpose

This roadmap stabilizes NexusVTT's security and durability boundaries, extracts
the Dungeon generator into an independently deployable application within the
existing monorepo, and completes unfinished multiplayer and document workflows.

It is designed to be executed across multiple AI coding sessions using Codex,
Claude Code, or Google Antigravity. Work assignments refer to capability tiers,
not vendor-specific model names. The dated model matrix in section 4 is the only
place where those tiers map to currently available models.

This file is separate from the completed A/B/C roadmap in `ROADMAP.md` and its
historical `SESSION_STATE.md`. Do not rewrite or discard that history. The
orchestrator updates only the status ledger in this document while this roadmap
is active.

## 2. Accepted decisions and non-negotiable boundaries

- The Generator Hub stays in this GitHub repository at `apps/generator-hub/`.
- The Hub has its own build, tests, development server, Docker image, health
  check, and deployment configuration.
- Dungeon is the only generator migrated in the first Hub milestone.
- Generator Hub owns generation, preview, standalone export, and its own draft
  persistence.
- Nexus owns authentication, authorization, asset persistence, Base Map library
  records, scene state, and multiplayer synchronization.
- The Hub never receives Nexus credentials, calls the private asset service,
  reads Nexus IndexedDB, or mutates Nexus scene state.
- The Dungeon generator's native SVG is the preferred transient master. Nexus
  stores a validated WebP derivative and thumbnail, not SVG or base64.
- PostgreSQL remains the serialization and durability boundary for canonical
  game state. Redis remains ephemeral coordination.
- No durable ACK, peer patch, or authoritative projection update occurs before
  the corresponding PostgreSQL transaction commits.
- High-risk identity, authorization, file-processing, and durability changes
  are implemented serially and independently reviewed.

## 3. Execution governance

### 3.1 Durable instructions versus task prompts

Keep only repository-wide invariants in `AGENTS.md` and `CLAUDE.md`, including:

- Durable-state and ACK rules.
- Authentication and authorization requirements.
- The Generator Hub ownership boundary.
- The prohibition against base64 in synchronized scene state.
- Required reliability gates.
- Shared-file ownership and destructive-action rules.

Do not copy this full roadmap or permanent role personas into those files.
Detailed work instructions belong in the current agent prompt and this roadmap.
This limits the tokens loaded into unrelated sessions.

### 3.2 Temporary roles

Roles are short-lived assignments created for one checkpoint. Do not keep every
role active throughout the roadmap.

| Role                           | Responsibility                                                                                           | Default tier                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Orchestrator/Integrator        | Select checkpoint, enforce dependencies, assign files, integrate changes, run final gates, update status | T1; promote to T2 for cross-system or security milestones |
| Security and Realtime Engineer | Authentication, authorization, WebSocket ordering, combat permissions, asset boundary                    | T2                                                        |
| Generator Hub Engineer         | Hub scaffold, vendor adapter, protocol, IndexedDB drafts, host integration                               | T1; T2 for boundary/security work                         |
| Test and Tooling Engineer      | Focused tests, CI, Docker, lint/config changes, test-log analysis                                        | T0; promote to T1 for diagnosis                           |
| Independent Reviewer           | Review a completed diff against invariants without editing it                                            | T1; T2 for security and durability                        |
| Architecture Adjudicator       | Resolve a genuine unresolved contract or architecture decision                                           | T3 only after a T2 attempt cannot settle it               |

### 3.3 Quota-conscious delegation rules

1. Delegate only work that is independently bounded and expected to save time
   or materially improve review quality.
2. Use at most two implementation agents concurrently.
3. Give each agent only the current checkpoint, relevant paths, invariants,
   acceptance tests, and explicit non-goals. Do not send the entire roadmap.
4. Give each shared file one owner. Important shared files include:
   - `server/index.ts`
   - `package.json` and `package-lock.json`
   - Root TypeScript, Vite, Vitest, and ESLint configuration
   - `.github/workflows/**`
   - `shared/generator/**`
   - `DungeonGenerator.tsx` and `GeneratorPanel.tsx`
5. Subagents and teammates must not create further agents unless the
   orchestrator explicitly authorizes it.
6. Use targeted tests during implementation. Run full unit, integration, and
   soak gates at milestone boundaries.
7. Escalate by tier instead of restarting the task:

   ```text
   T0 -> T1 -> T2 -> T3
   ```

   Supply the promoted agent with the diff, failing test, error output, and
   unresolved question rather than the complete conversation.

8. Use high/deep reasoning only for identity, authorization, transaction
   ordering, untrusted content, or persistent failure diagnosis.
9. Require a concise handoff containing files changed, behavior changed, tests
   and results, assumptions, and unresolved risks.
10. Only the orchestrator integrates work and edits this roadmap's status
    ledger.

### 3.4 Parallel and serial work

Safe parallelism:

- Test-database safety and CI work may run alongside public DTO work if their
  file sets do not overlap.
- Nexus IndexedDB repair may run alongside Generator Hub development.
- Session 3 document work may run alongside Generator Hub work after Session 1.
- Read-only review and unrelated test execution may run beside implementation.

Required serialization:

- WebSocket identity before host authorization.
- Shared generator protocol before Hub and Nexus consumers.
- Vendor SVG/font evaluation before the SVG-to-WebP backend pipeline.
- Asset hardening before generated-map upload.
- Multiplayer relay before HP synchronization.
- Co-host PostgreSQL commit before live role mutation or broadcast.
- Successful Hub rollout before deletion of the old Dungeon integration.

## 4. Cross-platform model capability matrix

### 4.1 Selection policy

Use the lowest tier likely to complete the checkpoint correctly. Model and plan
availability varies by account, host, and subscription, so verify the model
picker at the start of a session. If the named model is unavailable, choose the
closest available model in the same row based on the row's workload definition.

Product quotas are not directly comparable across vendors. Do not infer IDE or
subscription consumption from public API token prices. Check the platform's
usage display and record any meaningful quota limitation in the checkpoint
notes.

### 4.2 Matrix

| Tier            | Intended work                                                                                               | Codex                       | Claude Code                | Gemini in Antigravity IDE                      |
| --------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------- | ---------------------------------------------- |
| T0 — economical | File discovery, deterministic edits, documentation, formatting, targeted test execution, simple fixtures    | GPT-5.6 Luna, low/medium    | Claude Haiku 4.5 (`haiku`) | Gemini 3.8 Flash, Low                          |
| T1 — balanced   | Normal feature work, contained refactors, test design, Hub UI and tooling, ordinary diagnosis               | GPT-5.6 Terra, medium/high  | Claude Sonnet 5 (`sonnet`) | Gemini 3.8 Flash, Medium                       |
| T2 — advanced | Security, realtime ordering, difficult debugging, cross-package contracts, migration and transaction design, **architectural decisions within established boundaries**  | GPT-5.6 Sol, high/xhigh     | Claude Opus 5 (`opus`)     | Gemini 3.8 Flash, High or Gemini 3.1 Pro, High |
| T2+ — stuck case | When T2 + 2 turns of structured iteration don't resolve an architectural question | - | Use Opus 5 + forced decomposition (split problem, isolate unknowns, iterate separately) | Escalate to org review before considering frontier models |  -  |
| T3 — escalation | Unresolved high-risk decisions after documented T2 failure | GPT-6 Astra, high/xhigh/max | Claude Opus 5 (T2 + structured iteration) | Gemini 3.1 Pro, High with planning/boost mode  |

The aliases in the Claude column are preferred for interactive Claude Code work
because they can track the provider-supported current model. Pin a full model ID
when reproducibility matters. Antigravity model availability depends on plan;
use its model selector and usage view as the source of truth for the installed
version.

### 4.3 Sources and refresh procedure

Official sources checked on 2026-09-10:

- [OpenAI model catalog](https://developers.openai.com/api/docs/models)
- [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [Claude Code model configuration](https://code.claude.com/docs/en/model-config)
- [Claude model overview](https://platform.claude.com/docs/en/models/overview)
- [Claude Code cost guidance](https://code.claude.com/docs/en/costs)
- [Google Antigravity model list](https://antigravity.google/docs/models)
- [Google Antigravity model/effort guidance](https://codelabs.developers.google.com/gemini-mcp-agy)

At the beginning of each major session:

1. Check the relevant platform's current model picker.
2. Check the official model page for active/deprecated status.
3. Update only this matrix and the `Last model-matrix review` date when names
   change.
4. Do not rewrite task assignments; they remain expressed as T0-T3.

## 5. Status ledger

Status values: `planned`, `active`, `blocked`, `complete`, `superseded`.

| Checkpoint                                | Status  | Depends on   | Recommended tier        | Commit/evidence | Notes                                |
| ----------------------------------------- | ------- | ------------ | ----------------------- | --------------- | ------------------------------------ |
| S0 — baseline and generator containment   | complete | —            | T1                      | 4a9ec66         | Containment implemented and verified |
| S1.1 — public user DTO                    | complete| S0           | T1                      | c3a3742         |                                      |
| S1.2 — test-database safety               | complete| S0           | T0                      | c3a3742         | Required before DB integration tests |
| S1.3 — CI and publishing correctness      | complete| S1.2         | T1                      | c3a3742         |                                      |
| S1.4 — XSS and asset boundaries           | complete| S0           | T2                      | c3a3742         | Required before Hub upload           |
| S1.5 — WebSocket identity                 | complete| S1.2         | T2                      | c3a3742         | Finalized WebSocket identity         |
| S1.6 — host authorization                 | complete| S1.5         | T2 + independent review | c3a3742         | Finalized Host authorization         |
| S2A — IndexedDB ownership                 | complete| S0           | T1                      | c3a3742         | Independent of Hub                   |
| S2B.1 — Hub scaffold and protocol         | complete| S0           | T1                      | c3a3742         |                                      |
| S2B.2 — vendor adapter and standalone Hub | complete| S2B.1        | T1                      | c3a3742         | Includes font decision gate          |
| S2B.3 — secure Nexus/Hub boundary         | complete| S2B.2        | T2                      | c3a3742         | Integrated VITE_GENERATOR_HUB_URL    |
| S2B.4 — generated-map upload pipeline     | complete| S1.4, S2B.2  | T2 + independent review | c3a3742         | Implemented asset-service POST       |
| S2B.5 — Nexus importer and library        | complete| S2B.3, S2B.4 | T1                      | c3a3742         | Implemented BaseMapImporter logic    |
| S2B.6 — rollout and legacy cleanup        | complete| S2B.5        | T1                      | c3a3742         | Removed old path             |
| S3.1 — authorized event relay             | complete| S1.5, S1.6   | T2                      | 3258ced         |                                      |
| S3.2 — HP synchronization                 | planned | S3.1         | T2                      | —               |                                      |
| S3.3 — durable co-host grants             | planned | S1.5, S1.6   | T2                      | —               |                                      |
| S3.4 — document route and scoping         | planned | S1.2         | T1                      | —               | May run alongside Session 2          |
| S4 — backlog planning                     | planned | Sessions 1-3 | T1/T2                   | —               | Outline only                         |

## 6. Session 0 — baseline and containment

### S0.1 Preserve the working tree

- Record `git status` and the current branch.
- Do not reset, discard, overwrite, or broadly format unrelated changes.
- Use a `codex/` branch or an isolated worktree per stream when the active tool
  supports it. Otherwise partition files and keep one owner per file.
- Reconfirm roadmap line references before editing because code will drift over
  the lifetime of this plan.

### S0.2 Capture the baseline

Run and record:

```bash
npm run lint
npm run type-check
npm run test:unit
npm run test:asset-service
```

Do not run destructive database integration tests until S1.2 is complete.

### S0.3 Contain the Dungeon import defect

- Remove the automatic procedural generation trigger from the Dungeon panel.
- Stop converting procedural JSON into `generatedMap`.
- Reject anything that is not a validated image artifact.
- Clear the active artifact when switching generators.
- Disable Add to Scene unless a valid artifact belongs to the active generator.
- Retain the old working export assets until the Hub feature flag passes rollout
  and rollback testing.

Exit gate: opening or switching generator tabs cannot apply JSON or stale output
to a scene.

## 7. Session 1 — security and deployment stabilization

### S1.1 Public user DTO

Problem: raw user/profile responses may expose password-related database fields.

Work:

- Create `server/utils/publicUser.ts`.
- Define explicit allowlists for `toPublicUser`, `toPublicProfile`, and
  `toAuthResponse`.
- Remove raw `req.user` fallbacks and return 404 for a missing profile.
- Consolidate hand-built mappings without widening their response shapes.

Tests:

- Assert the exact frozen output key list.
- Assert password hash, salt, and iteration fields never appear.
- Prove a new database column cannot silently widen the response.

### S1.2 Test-database safety

Problem: integration tests can load a normal `.env` and truncate a non-test
database.

Work:

- Create `tests/integration/assertTestDatabase.ts`.
- Require both `RUN_DB_INTEGRATION_TESTS=true` and a database name matching
  `/(^|[_-])test(db)?$/i`.
- Repeat the assertion in `beforeAll` before initialization or truncation.
- Configure `docker/docker-compose.test.yml` explicitly.

Tests cover accepted test names, rejected production-like names, and the case
where the opt-in flag is set against an unsafe database.

### S1.3 CI and image-publishing correctness

- Add `--exit-code-from test`, unconditional teardown, and a timeout to the
  Docker test job.
- Ensure every image-publishing path depends on successful CI.
- Prefer a single downstream publish job or a reusable CI workflow over loosely
  coupled `workflow_run`, branch, and tag paths.
- Remove direct branch/tag paths that can bypass tests.
- Require source SHA, tested SHA, checkout SHA, and image metadata SHA to match.
- Manual publication must run the same gates or target a previously verified
  SHA.

Acceptance:

- A deliberately failing test makes the Docker job red.
- Failed CI cannot publish `latest`.
- An untested release tag cannot publish.
- Published image metadata names the tested commit.

### S1.4 Chat XSS and asset-write boundaries

Markdown:

- Add DOMPurify at the final HTML boundary.
- Allow only `http`, `https`, and `mailto` link protocols.
- Escape quotes in attributes and delete the obsolete sanitizer.
- Add an explicit nginx `script-src` without `unsafe-inline`.
- Ensure location-level `add_header` directives do not erase the CSP.

Token assets:

- Extract and reuse `requireAuthenticatedNonGuest`.
- Derive user identity from the authenticated session.
- Store under a per-user directory with content-hash naming.
- Apply a route-specific request limit.
- Guests retain local token behavior without a multiplayer-safe URL.

Asset-service secret:

- Exit when the secret is absent or empty.
- Reject known placeholders such as `dev-secret` and `change-me`.
- Remove committed server-side fallback secrets.
- Make Compose require an environment-provided secret.
- Keep `.env.example` non-functional and document local secret generation.
- Compare using `timingSafeEqual` after a length check.

Tests cover link injection, unsafe protocols, missing/placeholder/wrong secrets,
valid authentication, user-ID mismatch, guests, and auth-before-body-buffering.

### S1.5 WebSocket identity

- Correct the session type to `passport?: { user?: string }`.
- Create `server/socket/resolveSocketIdentity.ts`.
- Authenticated and guest session identities take precedence; query identity is
  ignored.
- A stale authenticated session becomes a new anonymous identity.
- Anonymous callers cannot claim an existing user ID.
- Ensure guest/anonymous database records exist before FK-backed work.
- Carry the resolved identity on the connection object.

Tests cover authenticated impersonation, missing query identity, deleted users,
guest impersonation, and anonymous collision.

- [x] **S1.4 — XSS & Asset Guard:** Implemented `dompurify` and strict origin separation. (Check: `npm run test:unit`)
- [x] **S1.5 — WebSocket identity:** Resolve Guest/Anonymous correctly; fix session type.
- [x] **S1.6 — Host authorization:** Move `Room` hydration strictly *after* authorization. (Check: `npm run test:e2e` soak)

### S1.6 Host authorization and reconnection ordering

This checkpoint follows S1.5 and must not be edited concurrently with it.

- Add `server/socket/campaignAuthorization.ts`.
- Campaign-host authorization requires `campaign.dmId === userId`; do not use
  the broader past-player helper.
- Authorize before reading campaign scenes or mutating session/host state.
- Reject anonymous reconnects to existing campaigns.
- Preserve campaign/session consistency checks.

Required order:

```text
resolve target
-> authorize
-> prepare replay
-> register distributed connection
-> commit database changes
-> hydrate room
-> acknowledge and broadcast
```

Unauthorized reconnect sends an error, closes with 4403, performs no database
mutation, and does not enter a reconnect loop on the client.

Tests:

- Owner succeeds; unrelated user and past player fail.
- Failed reconnect leaves `sessions.primaryHostId` and `hosts.isPrimary`
  unchanged.
- Guest-owner reconnect, anonymous new-room creation, hibernation recovery, and
  active-room-code reuse continue to work.

### Session 1 exit gate

```bash
npm run lint
npm run type-check
npm run test
docker compose -f docker/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test
```

Manual checks cover authenticated identity, non-owner rejection, guest hosting,
and fail-closed asset-service startup.

## 8. Session 2A — Nexus IndexedDB ownership

This track is independent of the Generator Hub.

### S2A.1 Unified owner

Create `src/services/nexusDb.ts` containing database/version constants, store
descriptors, idempotent upgrade logic, `openNexusDB()`,
`repairMissingStores()`, `onversionchange`, and an actionable `onblocked` path.

Replace database-deletion repair with versioned repair. Never destroy maps or
game-state snapshots to recreate a store.

### S2A.2 Legacy Dungeon draft policy

The Hub may be hosted on another origin and cannot read Nexus IndexedDB.
Therefore:

- Preserve maps and game state.
- Retire `tempStorage` after Nexus stops using it.
- Treat the old in-progress generator record as disposable and document that
  retirement.
- Do not claim a direct Hub migration.

If preserving old drafts later becomes a requirement, add an explicit
Nexus-to-Hub handoff protocol before dropping the store.

Tests cover fresh creation, v5-to-v6 preservation, store repair, concurrent
tabs, and deterministic draft retirement.

## 9. Session 2B — Dungeon Generator Hub

### S2B.1 Ownership boundary and artifact contract

Create:

```text
apps/generator-hub/
shared/generator/
src/services/generatorHostClient.ts
```

Generator Hub owns the One Page Dungeon runtime, parameters, vendor adapter,
preview, `NexusGeneratorHub` drafts, standalone download, and normalization.
Nexus owns authentication, campaign/scene selection, upload, library records,
placement, grid settings, sync, and notifications.

Enforce a rule forbidding Hub imports from Nexus stores, components, actions,
or services.

The protocol has two stages.

Hub export:

```ts
type GeneratorExportPayload =
  | {
      kind: 'svg-master';
      blob: Blob;
      mimeType: 'image/svg+xml';
    }
  | {
      kind: 'raster';
      blob: Blob;
      mimeType: 'image/webp' | 'image/png';
      width: number;
      height: number;
    };

interface GeneratorExportArtifact {
  protocolVersion: string;
  exportId: string;
  importId: string;
  source: 'dungeon';
  generatorVersion: string;
  payload: GeneratorExportPayload;
  byteLength: number;
  grid: {
    columns?: number;
    rows?: number;
    cellSize?: number;
    bakedIntoImage: boolean;
  };
}
```

Stored asset returned by Nexus:

```ts
interface StoredGeneratedMap {
  importId: string;
  assetId: string;
  sceneUrl: string;
  thumbnailUrl: string;
  mimeType: 'image/webp';
  width: number;
  height: number;
  byteLength: number;
  contentHash: string;
}
```

The server response is authoritative for stored URLs, MIME, dimensions, hash,
and size.

Messages:

- `generator/ready`
- `host/configure`
- `generator/export-request`
- `generator/export-ready`
- `generator/export-error`
- `host/import-result`
- `host/import-cancelled`

Runtime validation is mandatory.

### S2B.2 Workspace and protocol scaffold

- Create the Hub package, TypeScript/Vite/Vitest configuration, tests, and
  health endpoint.
- Add shared protocol constants, validators, and state-machine tests.
- Add root Hub dev/build/type-check/test scripts.
- Update workspaces, `build:all`, `type-check`, `test:ci`, ESLint overrides,
  import-cycle checks, and CI.
- Give `package.json`, lockfile, and root-config edits to one owner.

### S2B.3 Vendor adapter and standalone workflow

- Package One Page Dungeon under the Hub while keeping the legacy Nexus assets
  until rollout.
- Remove the dead `window.Oc` interception path.
- Drive native SVG export through `?export=svg` and intercept the
  `image/svg+xml` Blob through the live `window.saveAs` hook.
- Never convert the Blob to a data URL.
- Add preview, standalone download, Hub draft persistence, and recovery.
- Document vendor provenance, license, and attribution.

Font decision gate:

1. Generate representative SVG output.
2. Inspect whether fonts are embedded, local, or externally referenced.
3. Rasterize in the target server environment.
4. Compare text and grid fidelity.
5. Continue with `svg-master` only when server output is faithful. Otherwise
   have the Hub emit the `raster` WebP variant.

Do not begin S2B.5 with this branch unresolved.

### S2B.4 Secure Nexus/Hub boundary

There are two boundaries:

```text
Nexus <-> Generator Hub
Generator Hub <-> One Page Dungeon vendor frame
```

For Nexus and Hub:

- Deploy the Hub cross-origin from Nexus.
- Use exact configured origins and validate `event.source`.
- Validate protocol version and complete payload shape.
- Establish a per-mount nonce and expire it on navigation/unmount.
- Correlate and expire `exportId` and `importId`; reject stale/replayed output.
- Implement handshake timeout and cancellation.
- Hub replies only to its configured parent and exact target origin.
- Configure `frame-ancestors` for approved Nexus origins while preserving
  direct standalone navigation.

For the internal vendor frame:

- Keep vendor messages internal to the Hub.
- Validate the expected source window and origin.
- Do not expose `DUNGEON_PNG_GENERATED` to Nexus.
- Document and test the iframe sandbox choice.

Feature/configuration flags:

```text
VITE_GENERATOR_HUB_ENABLED
VITE_GENERATOR_HUB_URL
VITE_GENERATOR_HUB_ORIGIN
```

Rollback disables new Hub imports while preserving existing asset URLs.

### S2B.5 Purpose-specific generated-map upload

The browser never receives `ASSET_SERVICE_SECRET`.

Create a Nexus server endpoint such as `POST /api/generated-maps`. It:

- Uses the authenticated Nexus session.
- Derives user ID server-side and rejects guests.
- Validates campaign/scene access where applicable.
- Accepts multipart input and an idempotent `importId`.
- Forwards internally to an asset-service generated-map endpoint with the
  shared secret.

Create a separate internal route such as
`POST /user/:userId/generated-map`; do not broaden the generic image route.

SVG admission policy before `sharp`:

- Limit compressed bytes and parsed XML/text size.
- Reject `DOCTYPE`, entities, scripts, event attributes, and `foreignObject`.
- Reject external `href`, images, fonts, and remote `url(...)` references.
- Cap width, height, viewBox, density, total pixels, processing time, and
  concurrency.
- Validate actual contents rather than extension or claimed MIME.

Deterministic output policy:

- Maximum edge initially 4096px plus a maximum total-pixel limit.
- Derive size from grid dimensions at 64-100 pixels per cell.
- Prefer lossless WebP for flat maps; otherwise use near-lossless or quality
  85-92.
- Generate a roughly 512px `contain` thumbnail.
- Define alpha/background behavior and report any downscaling.
- Store `scene.webp` and `thumbnail.webp`; discard transient SVG.
- Use content-addressed or idempotency-aware naming.

Tests cover valid conversion, entity/script/external-reference rejection,
dimension bombs, deterministic dimensions, text/grid legibility, and duplicate
retry behavior.

### S2B.6 Nexus importer and library integration

Extract the base-map scene-import logic from `ScenePanel.tsx` into a shared
Nexus importer. Fix the existing case where grid `enabled` is assigned only
when `gridSize` exists.

Import sequence:

```text
validate artifact
-> show dimensions/file/grid confirmation
-> upload with importId
-> receive authoritative StoredGeneratedMap
-> create or update the asset-backed library record idempotently
-> perform one scene-background update
-> wait for authoritative synchronization ACK
-> report success to the Hub
-> clear the Hub draft
```

Failure behavior:

- Preserve the draft and `importId`.
- Retry without duplicating assets or library entries.
- Do not update scene state before upload succeeds.
- Do not clear temporary state before scene commit is acknowledged.
- Track orphan assets for later cleanup if a scene commit never succeeds.

Library records contain asset ID, scene/thumbnail URLs, dimensions, generator
version, content hash, and grid metadata. They contain no duplicate base64.

Guest behavior for the initial release:

- Guests may generate, preview, and download in standalone mode.
- Add to Scene prompts for sign-in.
- Guest data URLs never enter canonical scene state, peer patches, PostgreSQL,
  or the Base Map library.

### S2B.7 Rollout and legacy cleanup

After feature-flag rollout and rollback testing, delete:

- `src/hooks/useProceduralGeneration.ts`
- `src/services/mapGeneratorServiceClient.ts`
- `src/workers/mapGenerator.worker.ts`
- `src/types/generatorWorker.ts`
- `src/components/Generator/DungeonRenderer.tsx`
- Obsolete Dungeon bridge branches and direct vendor-message handlers

Update `DungeonGenerator.tsx`, `GeneratorPanel.tsx`,
`GeneratorFloatingControls.tsx`, PWA rules/tests, Docker configuration,
deployment docs, and image-publishing workflows. Remove the legacy packaged
generator only after the Hub deployment is confirmed.

### Session 2 exit gate

- Hub works directly with Nexus stopped.
- Dungeon generates, previews, downloads, and restores an interrupted draft.
- Nexus embeds the Hub through the validated protocol.
- Wrong origin/source/nonce/version/MIME and stale exports are rejected.
- Imported maps retain true dimensions, centered framing, and grid behavior.
- The library entry is asset-backed.
- Synchronized state contains a URL, not SVG or base64.
- A second multiplayer client renders the map.
- Retrying an `importId` creates no duplicate asset.
- Feature-flag rollback preserves existing maps.
- The old worker and JSON-as-image path are gone.
- Nexus v6 storage repair preserves maps and game state.

## 10. Session 3 — multiplayer and document completion

Session 3 may run alongside Session 2 after Session 1 completes.

### S3.1 Authorized event relay

- Warn in development when `SocketManager` receives an unhandled event name.
- Relay `camera/update`, `combat/add-character`, and `combat/sync-hp`.
- Keep camera events transient; do not add them to the durable journal.
- Allow camera updates only from host/co-host.
- Allow NPC additions only from host/co-host.
- Allow player-character additions from the owner, host, or co-host.
- Allow HP changes from host/co-host for any combatant and from a player only
  for a character they own.
- Treat `sourceClientId` as loop prevention, not authorization.
- Apply camera changes only when `followDM` is enabled and never pull the
  host's own camera.

Tests prove unauthorized events are rejected, ownership is enforced, host NPC
updates work, and camera events are not journaled/replayed.

### S3.2 Character HP synchronization

Prerequisites are S3.1 and setting `characterId` in
`addCharacterToCombat`.

Authority:

- PC `Character.hitPoints` is authoritative.
- NPC initiative HP is authoritative when no Character exists.
- Token HP is a derived display mirror.

Propagation:

```text
initiative mutation
-> authoritative character or NPC update
-> token mirror
-> combat/sync-hp
```

Remote application never re-emits. Prevent loops with source-client checks, a
re-entrancy guard, and equality short-circuiting. Add maximum-HP propagation and
ship behind the existing feature-flag mechanism.

### S3.3 Durable co-host grants

Do not use fire-and-forget persistence for authorization changes.

Required order:

```text
validate authority
-> commit PostgreSQL add/remove
-> update room role
-> update Redis presence
-> ACK and broadcast
```

On database failure, do not mutate or broadcast the live role.

- Remove dead duplicate handlers.
- Add `sessionId` to `Room`.
- Persist add/remove through `SessionRepository`.
- Restore grants during room recovery.
- Consult persisted grants for returning users.
- Keep offline co-hosts out of presence without deleting their grant.

Tests cover restart, revocation, failed writes, returning co-hosts, and kicking
a co-host.

### S3.4 Document routes and retrieval scope

- Change the structured-data route from `/api/:id/structured-data` to
  `/api/documents/:id/structured-data` and add route-shadowing tests.
- Resolve allowed campaign IDs server-side for Ask and semantic search.
- Intersect requested scope with authorized scope.
- Return 403 for an explicitly unauthorized requested scope.
- Return an empty result for an empty allowed scope.
- Never call downstream retrieval without a scope.
- Do not return an answer produced from unauthorized chunks merely because its
  citations were filtered afterward.

Track personal uncampaigned-document retrieval separately; it requires an
upstream document-ID filter.

### Session 3 exit gate

- Follow DM works only for eligible clients.
- HP converges without relay loops or cross-player writes.
- Co-host grants survive restart and failed persistence creates no temporary
  authority.
- Structured-data routing works without shadowing unrelated API routes.
- Ask and semantic search cannot access unauthorized content.

## 11. Session 4 — planning backlog

Plan these only after Sessions 1-3 settle the relevant contracts.

### S4.1 Remaining generators

Migrate world, cave, city, and dwelling individually behind the established
protocol. Each receives its own vendor investigation, adapter, format decision,
security review, standalone test, and Nexus import test. Do not assign all four
to one agent or one checkpoint.

### S4.2 Cleanup

After consumer searches, evaluate removal of the unused hybrid state manager,
obsolete skipped IndexedDB test, nonexistent `test:layout` documentation, stale
Vitest exclusions, and hardcoded module-federation remote. Reconcile repository
instruction documents afterward.

### S4.3 Coverage

- Add explicit coverage includes.
- Remove obsolete configuration.
- Decide whether server coverage remains excluded.
- Run coverage at milestone boundaries rather than every small checkpoint.
- Raise thresholds only from a measured baseline.

### S4.4 Reusable encounter packs

Design a versioned encounter template containing token placements, initiative
presets, linked handouts, preview metadata, and fresh IDs on instantiation after
asset and storage ownership is settled.

### S4.5 Product decisions

Decide whether to complete or hide the sounds panel, spell tab, voice/WebRTC
actions, and development-only administration sections.

## 12. Verification strategy

Run focused unit tests after every checkpoint.

At milestone boundaries:

```bash
npm run lint
npm run type-check
npm run test
```

After S1.2:

```bash
docker compose -f docker/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test
```

After relevant realtime/server milestones:

```bash
npm run test:e2e
npm run test:soak:chaos
```

Manual acceptance:

- Guest creates and reconnects to a room.
- Authenticated owner reconnects to a cold room.
- Non-owner reconnect is rejected without database mutation.
- Two browser tabs survive the IndexedDB version transition.
- Generator Hub works while Nexus is stopped.
- Dungeon SVG/font output passes the chosen rasterization path.
- Dungeon import retains framing and grid alignment.
- A second player renders the same generated map.
- Synchronized state contains an asset URL.
- Repeated import with the same `importId` does not duplicate assets.
- Hub rollback preserves previously imported maps.
- Asset service rejects missing and placeholder secrets.

## 13. Vendor-neutral prompts

### 13.1 Orchestrator prompt

```text
You are the integration owner for the current NexusVTT roadmap checkpoint.

Read the repository instructions, this roadmap's status ledger, and only the
current checkpoint. Revalidate referenced code before acting because paths and
line numbers may have changed.

Select one mergeable checkpoint. Delegate only independent, bounded work when
the expected benefit exceeds context and coordination cost. Use no more than
two implementation agents concurrently. Agents may not spawn further agents
unless explicitly authorized.

Assign one owner to every shared file. Do not permit concurrent edits to
server/index.ts, package.json, package-lock.json, root configuration, workflows,
shared protocol files, or generator host components.

Use the lowest capability tier likely to complete each assignment. Promote an
existing task with its diff and failure evidence instead of restarting it on a
stronger model.

Require each worker to report files changed, tests and exact results,
assumptions, and unresolved risks. Integrate the work, inspect the complete
diff, run checkpoint gates, and update the status ledger. Do not mark the
checkpoint complete while required verification remains unresolved.
```

### 13.2 Implementation-agent prompt

```text
Implement only the assigned NexusVTT checkpoint.

Objective:
[one concrete outcome]

Allowed files:
[explicit paths]

Do not modify:
[shared or out-of-scope paths]

Required invariants:
[security, durability, protocol, and ownership rules]

Acceptance tests:
[commands and behavioral assertions]

Inspect named files before editing. Expand scope only for a demonstrated
dependency, and report that dependency before changing an unassigned shared
file. Preserve unrelated working-tree changes.

Return a concise handoff with files changed, behavior implemented, tests and
exact results, assumptions, and remaining risks or blockers.
```

### 13.3 Independent-review prompt

```text
Review the supplied NexusVTT diff against the checkpoint acceptance criteria.
Do not implement changes.

Focus on authorization bypasses, mutation before durable commit, incorrect ACK
or broadcast ordering, untrusted message/file handling, package-boundary
violations, retry/idempotency failures, missing negative tests, and regressions
in guest, reconnect, or multiplayer behavior.

Report only actionable findings ordered by severity with exact paths and line
references. State explicitly when no blocking finding remains.
```

## 14. Checkpoint handoff format

Append the following information to the applicable status-ledger row and the
session's final report:

```markdown
### Checkpoint handoff

- Checkpoint:
- Branch/commit:
- Status:
- Files changed:
- Behavior completed:
- Tests and exact results:
- Decisions made:
- Assumptions:
- Remaining risks:
- Manual verification remaining:
- Recommended next checkpoint:
```
