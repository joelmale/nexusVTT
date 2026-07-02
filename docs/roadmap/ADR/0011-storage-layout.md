# ADR-0011 — Asset storage layout on the NAS volume

Status: **Proposed — DECIDED IN PACKET C0** (do not implement against this stub)

## Context
The asset service stores: base library (current `static-assets/`), TMT corpus (~16k originals +
WebP derivatives), user uploads (unbounded growth), and a staging/diff workspace for release
syncs (B3). Today assets live in-repo at `static-assets/` mounted via `ASSETS_PATH` env.

## Options
A. **Content-addressed**: `/blobs/<sha256-prefix>/<sha256>` + manifest maps ids→blobs.
   Dedupe free, tombstones trivial, but not human-browsable on the NAS.
B. **Category tree**: `/library/<category>/...` mirroring today's layout. Browsable, matches
   existing express.static mounts, but rename/re-categorize churn on sync.
C. Hybrid: content-addressed blobs + a generated human-readable symlink/index tree.

## Decision drivers
B3 hash-diff sync ergonomics · derivative keying (sha256 + spec version, B2) · NAS backup/rsync
behavior · express.static compatibility · quota accounting for user assets (C2) ·
who browses the NAS directly and how often (ask Joel).

Must also decide: derivatives beside originals vs. separate `/derivatives` tree; staging area
shape (`/staging/<release-tag>/` with current/incoming/diff); user-asset partitioning
(`/users/<userId>/`); quota numbers for C2.

## Decision
_(pending C0 — record here, set Status: Accepted (Joel, date))_
