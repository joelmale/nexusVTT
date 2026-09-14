# Tokens

Tokens have two related records. A `Token` is a reusable library asset; a
`PlacedToken` is one instance of that asset on a scene. Keep those identities
separate when adding properties or protocol events.

## Asset and instance data

The base token stores its image, size, category, tags, description, optional
stats, and public/custom metadata. The placed instance stores world position,
rotation, scale, layer, visibility, owner, conditions, dead/initiative flags,
and per-instance name, size, light, aura, and stat overrides.

Token sizes map to grid cells in `TOKEN_SIZE_GRID_MAPPING`: tiny is half a
cell; small and medium are one; large, huge, and gargantuan occupy two, three,
and four. `TokenRenderer` combines the base size, current grid size, and placed
scale to determine pixels.

`TokenPanel` searches and filters the libraries. Creation and configuration
surfaces support uploaded or asset-backed images. `tokenAssetManager` loads the
bundled manifest, retains legacy browser customisations, and can upload custom
tokens to the asset service for authenticated users.

## Placement and interaction

Placement follows the contract in ADR-0003:

```text
Token asset -> createPlacedToken -> placeToken -> token/place
```

Creation is unversioned because a new entity cannot collide with an existing
entity version. Movement is optimistic: the client changes local state, sends
`token/move` with `expectedVersion` and `updateId`, and rolls back if no
confirmation arrives. For move, update, and delete events that supply
`expectedVersion`, the server uses the PostgreSQL-backed
`room_entity_versions` compare-and-swap in the same transaction as the ordered
event. The room's in-memory version map is only a cache.

On the client, hosts can interact with every token and a player can interact
with a token whose `placedBy` matches their user ID. Hidden tokens are omitted
from player rendering. The context menu exposes visibility (host only),
initiative flag, 45-degree rotation, edit, and delete actions.

Do not overstate that client rule as server authorization. The current
`EntitySyncHandler` enforces host-online restrictions and entity versions but
does not validate `placedBy` for token mutations. A malicious connected client
is therefore not constrained by the renderer's ownership check.

## Rendering and persistence

Tokens currently render as SVG groups within the master scene SVG. Each
`TokenRenderer` subscribes to only its own render fields; the parent subscribes
to a stable ID list. A token move should not re-render sibling tokens, the
background, grid, or drawing layer.

Placed tokens are part of each `Scene`, so local scene autosave and the host's
canonical game-state projection include them. Realtime entity events provide
low-latency optimistic updates; the PostgreSQL scene snapshot remains the
recovery authority.

## Source map

- Models and factories: `src/types/token.ts`
- Libraries: `src/services/tokenAssets.ts`, `src/components/Tokens/`
- Placement and rendering: `src/hooks/useDockToCanvasDrag.ts`,
  `src/components/Scene/TokenDropZone.tsx`,
  `src/components/Scene/TokenRenderer.tsx`
- State and sync: `src/stores/gameStore.ts`,
  `server/socket/handlers/EntitySyncHandler.ts`
- Isolation tests: `src/stores/scene/sliceIsolation.test.ts`,
  `src/components/Scene/renderIsolation.test.tsx`
