# @nexus/character-creator

The shared D&D 5e creation package used by Nexus Forge and Nexus VTT. Both hosts
import its TypeScript source at build time. Keep one creator, calculator surface
and VTT converter; see [ADR-0002](../../apps/docs/vtt/adr/0002-shared-character-creator.md).

The maintained [engineering guide](../../apps/docs/platform/integrations/character-creation.md)
covers public props, result types, draft/evaluation services, host integration,
styling and contributor checks. The
[review record](../../apps/docs/platform/integrations/character-creation-review.md)
distinguishes the current candidate from released/deployed behavior.

## Current implementation status

Reviewed 2026-10-24 against `edd07ca9` plus local changes. The candidate adds a
four-screen guided presentation, draft APIs, recommendation/evaluation services
and storage helpers. These are not evidence of a deployed release or completed
class/edition certification.

- `CharacterCreator` selects guided/full; Forge currently uses individual modal
  exports and VTT uses this selector. Presentations still own separate local
  state, so switching modes does not transfer all edits.
- Actual modal submission calls `calculateCharacterStats()` through
  `useCreationSubmission()`. It does not yet use the exported draft evaluator or
  enforce its issues as final validation.
- Hosts own character persistence, identity, ownership and session state. The
  candidate package also exports optional browser `Storage` helpers; VTT wires
  them for partial draft resume, while standalone Forge has no draft wiring.
- Save rejection keeps mounted answers available and displays an error. The
  submission guard blocks concurrent calls; it creates a new character UUID per
  attempt, so it does not establish durable idempotency or duplicate-free retries.
- `CERTIFIED_SUPPORT_MANIFEST` contains candidate assertions. Its booleans and
  service tests do not replace independent rules or real-host verification.

Do not treat draft migration, provenance, reconciliation, loadout equality,
accessibility or rollout gating as complete. Details and recovery limits are in
the engineering guide.

## Minimal host integration

```tsx
import { useState } from 'react';
import {
  CharacterCreator,
  type CharacterCreationResult,
  type CreatedCharacter,
} from '@nexus/character-creator';
import '@nexus/character-creator/styles.css';

interface HostCharacterCreationProps {
  saveCharacter: (character: CreatedCharacter) => Promise<void>;
}

export function HostCharacterCreation({
  saveCharacter,
}: HostCharacterCreationProps) {
  const [isOpen, setIsOpen] = useState(true);

  async function complete(result: CharacterCreationResult): Promise<void> {
    await saveCharacter(result.character);
    setIsOpen(false);
  }

  return (
    <CharacterCreator
      isOpen={isOpen}
      edition="2024"
      initialMode="full"
      allowModeSwitch={false}
      theme="dark-colorful"
      onCancel={() => setIsOpen(false)}
      onComplete={complete}
    />
  );
}
```

`CharacterCreationResult` carries `character`, `creationData`, `edition`,
`createdAt` and optional candidate `combatGuidance`. The current UI submission
does not set that optional guidance field. Await host persistence before closing;
throw/reject to surface a save failure inside the modal.

For the VTT character model, use the shared conversion:

```ts
import { createdCharacterToNexus } from '@nexus/character-creator';

const character = createdCharacterToNexus(result.character, { playerId });
```

The live VTT and Forge JSON import use the same underlying `toNexusCharacter()`.
Review conversion tests and `UNMAPPED_CREATOR_FIELDS` when changing fields.

## Styling and commands

`src/styles/creator-theme.source.css` is the creator palette source. Forge imports
it globally as its app theme; the package build emits `dist/creator.css` scoped to
`.nexus-character-creator` for VTT. Hosts generate the existing utility classes
from package source. Guard blanket VTT global rules against entering this subtree.

Run from the repository root:

```bash
npm run build --workspace=@nexus/character-creator
npm run type-check --workspace=@nexus/character-creator
npm run test:character-creator
npm run test --workspace=nexus-forge -- --run
npm run test:unit --workspace=nexus-vtt
```

The creator's `build` regenerates scoped CSS; its `test` script owns a separate
Vitest project with colocated source tests. Host tests cover conversion,
persistence and bindings. See the engineering guide for required content-change
tests and broader host/docs validation commands, and the review record for actual
results rather than assuming this candidate passes.
