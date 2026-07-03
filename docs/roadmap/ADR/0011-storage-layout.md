# ADR-0011 — Asset storage layout on the NAS volume

Status: **Accepted** (Joel, 2026-07-03)

## Context (verified @ e522c00)
The asset service stores: base library (35 files today, in-repo `static-assets/`), TMT corpus
(~16k originals + WebP derivatives, release-synced by hash-diff), user uploads (C2), and a
staging workspace for B3 syncs. TMT folder trees are known to contain duplicate images under
different names/paths — dedupe matters at this scale.

## Options

**A. Content-addressed store (recommended)**
```
/assets-data/
  blobs/<sha256[0:2]>/<sha256>.<ext>          # originals, dedupe-free by construction
  derivatives/v<specver>/<sha256[0:2]>/<sha256>.webp
  users/<userId>/<assetId>.<ext>              # user uploads (quota accounting = du per dir)
  staging/<release-tag>/                      # B0 acquisition + B3 diff workspace
  manifests/manifest-v2.json                  # ids → blob paths + metadata (the only browse index)
```
- ✅ B3 hash-diff sync is trivial (the address IS the hash); TMT duplicates collapse for free;
  derivative keying (sha256+specver, per B2) falls out naturally; rsync/backup-friendly
  (append-mostly, no renames on re-categorization — taxonomy changes touch only the manifest).
- ❌ Not human-browsable on the NAS. Mitigation: B2 can emit an optional generated symlink tree
  (`/browse/<category>/<name> → blob`) — cosmetic, rebuildable, never authoritative.

**B. Category tree** (`/library/<category>/...`, mirroring today's layout)
- ✅ Browsable; matches existing express.static habits.
- ❌ Re-categorization = file moves (sync churn, backup churn); duplicates persist; hash-diff
  needs a separate index anyway.

## Quota defaults for C2 (edit freely)
Per-user: **200 MB**, max file **10 MB**, types **png / webp / jpg**, max ~500 assets/user.
Enforced service-side at upload; stored by generated id, never client filename (path-traversal
safety, already in the C2 brief).

## Orchestrator recommendation: **A**, with the generated browse-tree only if you actually
browse the NAS by hand (tell me — it's a B2 flag, not architecture).

## Decision
**Option A** (Content-addressed store) is selected. Additionally, the optional generated browse-tree (symlink tree) capability will be implemented for reversibility and hand-browsability on the NAS.
