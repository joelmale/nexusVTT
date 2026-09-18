# ADR-0005 — VTT admin panel stays dev-only scaffolding; Codex owns rules management

Status: **Accepted** (2026-09-17)

## Context

`apps/vtt/src/components/AdminPage.tsx`, `apps/vtt/src/utils/dataManager.ts` and
`apps/vtt/src/utils/codeGenerator.ts` are a browser-only CRUD editor for the bundled SRD data
(weapons, armor, tools, spells, equipment, features, classes, races, backgrounds,
personalities) that ships with the VTT. It reads and writes that data in memory and can emit
regenerated TypeScript source for it. It has no server, no auth beyond the route gate, and no
persistence beyond whatever the browser session holds.

The modernization plan originally called for deleting these three files outright. Deleting them
buys nothing: the route is already gated behind `process.env.NODE_ENV === 'development'` in
`apps/vtt/src/main.tsx`, so none of this code reaches a production bundle. Meanwhile
`apps/codex/services/admin-ui` exists as a real, deployed admin service and is the intended home
for authoritative rules and content editing going forward.

## Decision

The VTT keeps its dev-only SRD editor, frozen in place:

- `AdminPage.tsx`, `dataManager.ts` and `codeGenerator.ts` are not deleted.
- Each file now carries a header comment stating it is dev-only scaffolding, that it is excluded
  from production by the `NODE_ENV` gate in `main.tsx`, and that no new features should be added
  to it.
- Codex (`apps/codex/services/admin-ui`) is the authoritative home for rules and content
  management. New admin/editing functionality belongs there, not in the VTT.
- The `/admin` route and its `NODE_ENV` gate in `main.tsx` are unchanged.

## Consequences

- No behavior change for any user; the route was already unreachable in production.
- Future rules-editing features are built in Codex's admin UI, not layered onto this frozen VTT
  panel.
- If the VTT panel ever bit-rots against a data shape change, the fix is to delete it then,
  not to keep it in sync — it is frozen, not maintained.
