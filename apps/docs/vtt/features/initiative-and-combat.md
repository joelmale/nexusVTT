# Initiative and combat

The initiative subsystem tracks combatants, turn order, rounds, hit points,
conditions, death saves, and a round-scoped event history. Its authoritative
client state lives in a dedicated Zustand store rather than in `gameStore`.

## Tracker behavior

An `InitiativeEntry` can represent a player, NPC, or monster and may link to a
character and placed token. The tracker can:

- add, remove, reorder, and manually edit combatants;
- roll initiative locally with `Math.random()` and optionally auto-sort;
- start, pause, resume, advance, reverse, and end combat;
- apply damage to temporary HP before current HP, heal up to max HP, and set
  temporary HP without stacking it;
- add timed standard conditions and decrement their duration on the next turn;
- record death saves, delayed/readied state, and combat-log events.

Starting combat optionally sorts the list, selects its first entry, and creates
round one. Wrapping past the final entry starts a new round. Ending combat
clears active, ready, and delayed flags but keeps the entries.

## Persistence model

`initiativeStore` persists a browser copy under `nexus-initiative-tracker`.
`buildInitiativeSnapshot` also selects the serializable initiative fields for
`buildGameStateProjection`. Host canonical uploads therefore commit initiative
alongside scenes and characters in PostgreSQL, and authoritative snapshots or
patches project it back into the dedicated store.

## Current realtime boundary

The server registers durable `combat/add-character` and `combat/sync-hp`
events. Character-card and NPC-token flows emit `combat/add-character` with a
stat snapshot, and peers add an entry even when they do not have the source
character locally.

The general `InitiativeTracker` add/edit/turn controls do not emit those combat
events directly. In addition, `characterSyncService.syncStats`, called after
local HP changes, is currently an empty outbound hook. Those operations become
durable when the host's canonical game-state sync runs; they should not be
described as a complete per-action realtime protocol.

There is also an authorization shape mismatch to preserve in reviews:
`CombatHandler` checks top-level `data.type` and `data.ownerId`, while current
producers put the combatant type under `data.entry.type` and do not send
`ownerId`. The intended player/NPC authorization is therefore not reliably
enforced by that handler today.

## Source map

- Model and standard conditions: `src/types/initiative.ts`
- Store: `src/stores/initiativeStore.ts`
- UI: `src/components/InitiativeTracker.tsx`
- Character/token integration: `src/components/CharacterCard.tsx`,
  `src/components/Tokens/NPCStatsPrompt.tsx`,
  `src/services/characterSyncService.ts`
- Persistence and incoming events: `src/services/gameStateProjection.ts`,
  `src/stores/gameEventHandlers.ts`,
  `server/socket/handlers/CombatHandler.ts`
