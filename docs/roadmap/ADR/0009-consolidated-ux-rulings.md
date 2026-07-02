# ADR-0009 — Consolidated UX/feature rulings (fog, hit-testing, menus, fetch policy)

Status: **Accepted** (Joel, 2026-07-02)

## Decisions
1. **Fog phasing**: paintable fog first (conceal-all + reveal shapes, DM-authored, A9);
   token-vision fog deferred pending product decision. Both live on one canvas layer at Z.FOG.
   Note: no `'mask'` drawing type exists in the codebase (stale docs) — fog is a net-new model.
2. **Canvas ink hit-testing**: JS `Path2D.isPointInPath/isPointInStroke` with zoom-scaled
   tolerance (A8b). No invisible DOM/SVG twin layer.
3. **Token context menu coexists with TokenPanel**: menu owns ~6 frequent actions; "Edit…"
   opens the full panel as escape hatch. Sunset the panel tab only if usage data says so.
4. **Atlas fetch policy**: lazy — no federated fetch until the dock first opens; local bundled
   sources are instant; NexusCodex/asset-service round-trips are user-demand-driven.

## Consequences
Each ruling is baked into its packet's brief (A9, A8b, A7, C3/C4). Supersede individually with
new ADRs if reality disagrees; do not silently drift.
