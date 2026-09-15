# @nexus/character-creator

The single maintained D&D 5e character creation experience, shared by **Nexus Forge** and
**Nexus VTT**.

Both apps import this package at build time (tsconfig `paths` + Vite aliases). It is
deliberately *not* a federated remote: see
[ADR-0002](../../apps/docs/vtt/adr/0002-shared-character-creator.md).

## What this package owns

- The 14-step creation wizard (2014 and 2024 rulesets).
- The 5e rules data: species, classes, subclasses, backgrounds, feats, spells, equipment.
- The character calculators (`calculateCharacterStats`) and the rules engine.
- Its own scoped stylesheet.

## What it does not own

Persistence, account identity, ownership and multiplayer state. The creator computes a
character and hands it to the host application.

## Usage

```tsx
import {
  CharacterCreationWizard,
  type CharacterCreationResult,
} from '@nexus/character-creator';
import '@nexus/character-creator/styles.css';

<CharacterCreationWizard
  isOpen={isOpen}
  edition="2014"
  theme={resolvedHostTheme}      // written to data-theme on the creator root
  onCancel={() => setIsOpen(false)}
  onComplete={async (result: CharacterCreationResult) => {
    await saveSomewhere(result.character); // throwing keeps the wizard open
    setIsOpen(false);
  }}
/>;
```

`CharacterCreationResult` carries:

| field          | meaning                                                      |
| -------------- | ------------------------------------------------------------ |
| `character`    | the fully calculated sheet, in this package's model           |
| `creationData` | the raw wizard answers, for auditing or replaying a creation  |
| `edition`      | `'2014'` or `'2024'`                                          |
| `createdAt`    | ISO timestamp                                                 |

`onComplete` may be async. A rejection is surfaced inside the wizard and the wizard stays open
with the player's answers intact, so the host owns retry semantics. The wizard also refuses
concurrent or repeated submissions, so a double click cannot create two characters.

## Converting to the VTT contract

`toNexusCharacter()` is the **single** conversion into the `@nexus/character-contracts`
`Character` model. Both the live creator and the Forge JSON import path use it, so a field
preserved for one is preserved for both.

```ts
import { createdCharacterToNexus } from '@nexus/character-creator';

const character = createdCharacterToNexus(result.character, { playerId });
```

Fields deliberately not carried across are listed in `UNMAPPED_CREATOR_FIELDS`, each with a
reason. Adding a creator field without deciding what happens to it should fail review.

## Styling

`src/styles/creator-theme.source.css` is the single source for the creator's palette and its
`.bg-theme-*` / `.text-accent-*` helper classes.

- **Forge** `@import`s that source file globally (its app-wide theme, unchanged).
- **The VTT** imports `@nexus/character-creator/styles.css`, which is `dist/creator.css` —
  the same source with every selector scoped to `.nexus-character-creator`.

Scoping matters: the creator and the VTT both define `--color-text-primary` and
`--color-border-primary` with different meanings, so an unscoped import would collide.

Rebuild the scoped stylesheet after editing the source:

```bash
npm run build --workspace=@nexus/character-creator
```

Tailwind utility classes come from each host app's own Tailwind build; both apps declare
`@source` pointing at this package so those utilities are generated.

## Tests

Tests live beside their source and run from Forge's Vitest project:

```bash
npm run test --workspace=nexus-forge -- --run
```

Conversion and data-preservation tests live in the VTT, which is the consumer of the adapter:

```bash
npm run test:unit --workspace=nexus-vtt
```
