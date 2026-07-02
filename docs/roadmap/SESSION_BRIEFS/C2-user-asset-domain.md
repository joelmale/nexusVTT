# C2 — User-asset domain (upload / ownership / quotas)

track: C · risk: Med · gate: none · depends_on: [C0 (auth ADR), C1] · unblocks: [] (feeds Atlas "My Assets" later)
budget_cap: 150k tokens (T2 ~90k / T3 ~35k)

## Objective
Add the user-asset domain to the asset service: authenticated upload (per ADR-0012), ownership
records, per-user quota, listing/deletion. Replaces the current localStorage-only custom tokens
(`nexus-custom-tokens`) as the durable home for user uploads — migration of existing localStorage
customs is IN scope as an import path, not an automatic migration.

## Ground truth (verified @ e29131b, 2026-07-02 — ADRs supersede)
- Current user-asset reality: custom tokens live in localStorage key `nexus-custom-tokens` (see `src/services/tokenAssets.ts`); server also statically mounts `tokens/custom` (`server/index.ts` ~1693) — reconcile these two paths during design.
- Auth: per ADR-0012 (signed-upload precedent: `POST /api/documents` returns a signed upload URL — `src/services/documentService.ts`).
- Ownership: users table exists in PostgreSQL (`server/schema.sql`: users with UUID id, provider google|discord|guest). Asset ownership rows can live in the VTT DB or the asset service's own store — per ADR-0011; do not create a second users table.
- Storage: user-asset tree per ADR-0011; derivatives (thumbnails) generated on upload reusing B2's derivative code if landed (soft dependency — if B2 not landed, generate inline and converge later; note in handoff).

## Drift check
```bash
cat docs/roadmap/ADR/0012-asset-service-auth.md | head -20   # MUST be Accepted
rg -n "nexus-custom-tokens" src/services/tokenAssets.ts | head -3
rg -n "tokens/custom" server/index.ts | head -2
psql $DATABASE_URL -c '\d users' 2>/dev/null | head -8 || echo "verify users schema via server/schema.sql"
```

## Delegation plan
- T2 #1: upload flow (auth per ADR, size/type validation — png/webp/jpg, ≤N MB per ADR-0011 quota table), ownership + quota enforcement, list/delete endpoints.
- T2 #2: client integration — `tokenAssets.ts` gains an upload-to-service path + import-from-localStorage action (user-triggered, with per-item results UI in existing token panel).
- T3: security review (auth bypass attempts, quota evasion via concurrent uploads, path traversal in filenames — service must store by generated id, never client filename).

## Exit criteria
- Upload → appears in owner's listing with thumbnail; second user cannot see/delete it (two-account test with guest users).
- Quota: exceeding rejects with a clear error surfaced in UI.
- Import: localStorage customs migrate on demand; originals untouched on partial failure.
- Path traversal test (`../../evil.png` filename) stored safely. type-check / lint / tests pass.

## Rollback
Additive endpoints + client path behind existing UI; branch revert. Uploaded files remain on volume (note cleanup command in handoff).

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
