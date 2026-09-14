# Dice

Online dice rolls are server-authoritative. The client sends an expression and
options; the server validates and rolls it with Node cryptographic randomness,
then publishes one ordered result to every participant, including the sender.
Offline mode falls back to a local roll.

## Supported expressions

`server/diceRoller.ts` accepts one or more `XdY` pools, including a missing
count such as `d20`, plus one signed integer modifier. Examples include
`2d6+3`, `3d4,6d20`, and `1d20+2d6+1d4+3`.

Validation limits an expression to 100 characters, each pool to 1-100 dice,
each die to 2-1000 sides, and the total request to 100 dice. The current parser
extracts the first signed modifier after removing dice terms; it is not a full
dice-notation evaluator.

Advantage and disadvantage generate a second result set for every pool, then
choose the higher or lower aggregate before adding the modifier. Critical
success/failure is marked only for a single d20, based on the first result set.

## Online flow

```text
DiceRoller
  -> event { name: "dice/roll-request", expression, options }
  -> DiceHandler validates and calls createServerDiceRoll
  -> ordered event { name: "dice/roll-result", roll }
  -> every client adds the result to diceRolls
  -> DiceBox3D animates the supplied values
```

The event journal commit precedes the acknowledgement and broadcast. Retry by
event ID is idempotent. The client keeps at most 50 rolls in `gameStore`.

`DiceBox3D` expands each result to dice-box notation and passes predetermined
values to `@3d-dice/dice-box`. Animation, sound, theme, and disappearance time
are presentation settings; they do not determine the roll.

## Privacy and chat caveats

Only hosts can request `isPrivate`; the server silently clears that flag for a
player. A private result is nevertheless broadcast to every room socket and
stored by every receiving client. `DiceRoller` filters private entries out of
the non-host history UI, so this is presentation privacy, not transport-level
secrecy.

While online, `DiceRoller` also sends a chat message built from a provisional
client roll before the authoritative result arrives. That chat payload can
therefore disagree with the server result. Treat `dice/roll-result` as the
canonical outcome, not chat `diceData`.

## Source map and tests

- Server roll and validation: `server/diceRoller.ts`
- Request handler: `server/socket/handlers/DiceHandler.ts`
- Client controls and history: `src/components/DiceRoller.tsx`
- Animation: `src/components/DiceBox3D.tsx`
- Incoming state: `src/stores/gameEventHandlers.ts`
- Tests: `tests/unit/server/socket/DiceHandler.test.ts`,
  `tests/unit/components/DiceRoller.test.tsx`, `tests/unit/utils/dice.test.ts`
