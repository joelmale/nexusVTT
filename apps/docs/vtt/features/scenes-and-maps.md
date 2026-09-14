# Scenes and maps

A scene is the durable container for one tabletop view. It owns the background
map, grid and lighting settings, drawings, placed tokens, placed props, and fog
state. The shared active-scene ID determines which scene the room displays;
camera, active tool, and selection live beside the scene array in `SceneState`.

## Scene lifecycle

`gameStore` creates UUID-backed scenes, makes the first scene active, resets the
camera when changing scenes, and supports update, delete, reorder, duplicate,
and bulk visibility changes. `ScenePill`, `SceneTabs`, `ScenePanel`, and
`SceneManagement` expose different parts of that lifecycle.

The scene model records:

- name and description;
- `private`, `shared`, or `public` visibility;
- an `isEditable` lock flag and creator metadata;
- optional background-image geometry;
- per-scene grid, lighting, drawings, tokens, props, and fog.

Players' scene tabs include only shared and public scenes. Hosts see all
scenes. Scene mutations sent through `SceneHandler` are host/co-host only.
`visibility`, `isEditable`, and `showToPlayers` are primarily client rendering
and interaction controls; they are not row-level database access controls.
`SceneGrid` does not currently inspect `showToPlayers`, and `isEditable` is not
a general server mutation guard. Preserve those gaps in security and UX reviews.

## Background maps

`backgroundImage` stores a URL, natural width and height, world offset, and
scale. New maps are normally centred around world origin by using negative
half-width and half-height offsets. `SceneBackground` renders the image as SVG.

The editing surfaces can select bundled or generated base maps, load assets,
convert a CORS-readable image URL to WebP, or use the older browser-local file
path. A base map that publishes grid dimensions can set the scene cell size
automatically. Generated dungeon maps are scaled down and their separate grid
is disabled because the image already contains one.

The legacy file-upload path in `SceneEditor` stores a blob in IndexedDB and
puts a `nexus-image://...` reference in the scene. `SceneBackground` currently
passes that reference directly to SVG instead of resolving it through
`sceneImageStore`. Consequently, this path must not be described as portable
to another browser or reliably reloadable. Asset-service URLs and embedded
data URLs have different portability and payload-size trade-offs.

## Persistence and realtime

Scene create, update, and delete paths save locally through
`drawingPersistenceService` and the IndexedDB-backed linear-flow storage; scene
entity actions also schedule local autosave. The host publishes the canonical
projection through the game-state sync engine. The server commits scenes,
characters, initiative, sync token, and version together to PostgreSQL before
acknowledging or sending a peer patch. `reorderScenes` and `duplicateScene`
currently mutate local state without directly scheduling either persistence
path, so callers must not assume every scene helper has identical durability.

The server still accepts durable `scene/create`, `scene/update`,
`scene/delete`, `scene/reorder`, and `scene/change` events. In the normal UI,
most lifecycle actions rely on the canonical snapshot path; `scene/update` is
also used directly by grid alignment. `camera/update` is a separate transient,
host-only event used by players who enabled Follow DM.

## Source map

- Model and store: `src/types/game.ts`, `src/stores/gameStore.ts`
- Editing and navigation: `src/components/Scene/ScenePanel.tsx`,
  `src/components/Scene/SceneEditor.tsx`,
  `src/components/Scene/SceneTabs.tsx`,
  `src/components/Scene/SceneManagement.tsx`
- Background rendering: `src/components/Scene/SceneBackground.tsx`
- Maps and images: `src/components/Scene/BaseMapBrowser.tsx`,
  `src/services/baseMapAssets.ts`, `src/utils/sceneUtils.ts`
- Durable projection: `src/services/gameStateProjection.ts`,
  `server/repositories/SessionRepository.ts`
