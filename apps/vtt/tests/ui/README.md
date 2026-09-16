# `tests/ui` — browser UI suite

Playwright specs for panel layout, stacking, focus handling, docking and
workspaces. **No Docker, no PostgreSQL, no Redis, no WebSocket handshake.**

```bash
npm run test:ui                 # whole suite (~1 min)
npx playwright test --project=ui tests/ui/docking.spec.ts
```

## Why it exists separately from `tests/e2e`

`tests/e2e` is a durability/sync smoke suite: six containers, two browser
contexts, deliberate backend restarts, `workers: 1`. Panel management there is
only scaffolding to reach a chat box or an initiative tracker, which means UI
changes destabilise assertions that have nothing to do with the UI.

It is also the wrong tool for the job. These are the bugs that shipped despite
309 passing unit tests, because jsdom has no layout engine:

| Bug | Why unit tests could not see it |
| --- | --- |
| `WorkspaceMenu` clipped by the dock's `overflow: hidden` | No box model |
| `.layout-toolbar` missing `inert` while its child had it | Needs real tab order |
| Docked panel invisible on reload (DOM race) | Needs real commit ordering |
| Panels overlapping and swallowing clicks | Needs real hit-testing |
| Escape on the workspace menu also closing the top panel | Needs real event ordering |

## How a test gets into the game

`support/gameFixture.ts` stubs `**/api/**` and sets `window.__TEST_SEED__` via
`page.addInitScript`. `src/utils/testBridge.ts` (dev-gated, same `isDevMode()`
switch as the lobby dev tools) applies that seed to the Zustand stores *before*
the first React render, so `ProtectedRoute` sees a user and a session and never
attempts session recovery.

```ts
await gotoGame(page, { panels: ['chat'] });
```

## Assert layout directly

`support/layoutProbes.ts` wraps the browser-only questions. Prefer these over
inferring state from whether a click succeeded — an intercepted click surfaces
as a 15s timeout and a wall of retry logs, which is how the overlapping-panel
bug stayed hidden.

- `panelAtPoint(page, x, y)` — which panel is actually on top there
- `isTopmostAtCentre(locator)` — is this the real hit-test target
- `gameLayoutGrid(page)` / `canvasRect(page)` — resolved grid tracks, canvas box
- `tabbableInsideChrome(page)` — what Tab can genuinely reach

## Known failing

`panel-cycle-crash.spec.ts` is marked `test.fail()`. It reproduces a renderer
crash on rapid panel open/close that also reproduces on a clean `main`, so it
predates the panel work. When it is fixed those tests will "fail" by passing —
that is the signal to delete the annotation. The spec header records what has
been ruled out.

Because of that crash, specs that toggle panels pace themselves (~250ms). Drop
the pacing once it is fixed.
