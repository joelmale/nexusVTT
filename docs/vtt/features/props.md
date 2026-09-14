# Props

Props are reusable scene objects such as furniture, decorations, treasure,
containers, doors, traps, lights, and effects. Like tokens, they separate a
library `Prop` from a scene-specific `PlacedProp`.

## Data model

The base asset stores its image, category, nominal size, tags, description,
optional stats, interaction flag, and optional light properties. The placed
record stores world position, rotation, scale, optional width/height in grid
cells, layer, visibility, DM-only and revealed flags, state overrides, and
creator metadata.

`createPlacedProp` starts a prop on the `props` layer, visible to players, at
rotation zero and scale one. `PropRenderer` currently calculates size from the
placed width/height, defaulting each to one grid cell; the base `Prop.size`
mapping is not consulted by that renderer.

## Placement and interaction

Props can be dragged from the dock or placed through the scene drop path.
`prop/place` is unversioned. Moves are optimistic and use `expectedVersion`;
the store also defines an optimistic update helper. Delete and interact can
take the server's versioned path when the payload supplies `expectedVersion`.
The normal removal and toolbar update paths currently rely on canonical
snapshot sync rather than emitting `prop/delete` or `prop/update` directly.

The selected-prop toolbar supports rotation, scale, background/props/overlay
layer selection, player visibility, DM-only notes, removal, and interactive
state. Interactive props accept `open`, `close`, `lock`, and `unlock`.
Containers open on double-click: hosts can edit their contents, while players
can inspect an open, unlocked container.

Hosts can interact with all props; the client allows a player to move a prop
they placed. Hidden props are not rendered for players. As with tokens, this is
not complete server-side ownership enforcement: `EntitySyncHandler` checks
host presence and SQL entity versions but does not compare `placedBy`.

## Rendering and persistence

Props currently render as SVG groups in the master scene SVG. Per-prop narrow
selectors isolate movement from the background, grid, drawings, and other
props. Light radii and interaction/visibility badges are derived during
rendering.

Placed props and container contents are nested in each scene. They are included
in browser scene persistence and in the host's canonical PostgreSQL game-state
projection. The ordered entity stream supplies low-latency room updates and
transactional version conflict detection.

## Source map

- Models and factory: `src/types/prop.ts`
- Libraries and creation: `src/services/propAssets.ts`,
  `src/components/Props/PropPanel.tsx`,
  `src/components/Props/PropCreationPanel.tsx`
- Rendering and controls: `src/components/Scene/PropRenderer.tsx`,
  `src/components/Props/PropToolbar.tsx`,
  `src/components/Props/ContainerModal.tsx`
- State and sync: `src/stores/gameStore.ts`,
  `src/stores/scene/propsSlice.ts`,
  `server/socket/handlers/EntitySyncHandler.ts`
