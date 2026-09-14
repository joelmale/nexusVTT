# Scene layer stack

The scene combines SVG and Canvas 2D because the layers have different update
and interaction needs. SVG remains a good fit for structured, sparse elements;
Canvas handles dense paint operations that would otherwise create large SVG
trees. All layers must preserve the same world coordinates and camera transform.

## Current implementation

`SceneCanvas` owns a master SVG and a camera-transformed `<g>`. Its paint order
is the effective order for content inside that SVG:

1. `SceneBackground` — SVG image.
2. `SceneGrid` — SVG square lines or hex polygons.
3. `CanvasInkLayer` — Canvas 2D embedded with `foreignObject` for committed
   pencil, line, rectangle, circle, and polygon drawings.
4. `DrawingRenderer` — remaining SVG drawing types and overlays.
5. `TokenRenderer` — SVG groups.
6. `PropRenderer` — SVG groups.
7. `FogLayer` — Canvas 2D embedded with `foreignObject`.
8. SVG tool previews and selection UI.

Remote cursors and ordinary UI panels are mounted outside the transformed
content tree. `CanvasInkLayer` and `FogLayer` apply the viewport-centred camera
formula inside their 2D contexts so their world geometry matches SVG.

ADR-0005 records a target in which tokens and props move to plain DOM under one
camera root. That part is not implemented: current token and prop renderers
return SVG `<g>` elements. Contributors must distinguish the accepted target
from the present tree when diagnosing stacking or hit testing.

## Rendering and interaction boundaries

- Background and grid have narrow selectors and remain static across entity
  moves.
- Basic committed ink shares cached `Path2D` objects between Canvas painting
  and JavaScript hit testing. Its gesture preview remains SVG.
- Tokens and props keep native SVG pointer targets and per-entity selectors.
- Fog has no pointer handlers; a host-only SVG capture layer creates reveals.
- Canvas-anchored feedback must remain in the scene positioning loop. Do not
  use top-layer popovers for health bars or floating combat text that must move
  synchronously with a scene entity.
- Static menus, panels, modals, tooltips, and dice live in DOM overlay bands.

## Z-index scale

`src/utils/z-scale.ts` mirrors the CSS custom properties in
`src/styles/design-tokens.css`. Use `Z.BAND` or `zVar('BAND')` in TypeScript and
`var(--z-band)` in CSS. Each main band reserves nearby values for local order.

| Band                       |   Value | Intended content                |
| -------------------------- | ------: | ------------------------------- |
| `BACKGROUND`               |       0 | scene background                |
| `GRID`                     |      10 | grid                            |
| `DRAWING`                  |      20 | drawings and ink                |
| `TOKEN`                    |      30 | tokens and props                |
| `SELECTION`                |      35 | selection affordances           |
| `FOG`                      |      40 | fog cover                       |
| `CURSORS`                  |      50 | remote cursors                  |
| `TOOL_UI`                  |      60 | scene tools and docked controls |
| `PANEL` / `POPOVER`        | 70 / 75 | floating panels and menus       |
| `MODAL_BACKDROP` / `MODAL` | 79 / 80 | modal surfaces                  |
| `TOOLTIP`                  |      85 | tooltips                        |
| `DICE_3D`                  |      90 | 3D dice overlay                 |
| `DRAG_GHOST`               |      95 | drag previews                   |
| `TOP_MODAL`                |     100 | highest exceptional modal       |

DOM z-index cannot reorder ordinary SVG children across one another; SVG paint
order still controls the content tree above. The scale becomes authoritative
where layers establish CSS stacking contexts or live in the DOM overlay shell.
Do not add raw z-index values outside the scale definitions.

## Source map

- Decisions: `apps/docs/vtt/roadmap/ADR/0004-z-scale.md`,
  `apps/docs/vtt/roadmap/ADR/0005-layer-tech-split.md`
- Composition: `src/components/Scene/SceneCanvas.tsx`
- Scale: `src/utils/z-scale.ts`, `src/styles/design-tokens.css`
- Isolation tests: `src/components/Scene/renderIsolation.test.tsx`
