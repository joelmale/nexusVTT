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

Reviewed 2026-10-27 at `6d187098`. See the
[engineering guide](../../apps/docs/platform/integrations/character-creation.md)
for evidence and file references; this summary only states what is true now.

- `CharacterCreator` owns one session shared by the guided (four-screen and quiz)
  and full presentations, so draft data, identity and loadout carry across mode
  switches. A few four-screen selections (playstyle card, explicit class and
  species, name field) are local and do not.
- Both presentations submit through `evaluateDraft()` and
  `toCharacterCreationResult()`, which throw on invalid or changed drafts. The
  character ID is the draft's `characterId`, and a failed save retries the same
  cached result.
- Hosts own persistence, identity and recovery (Forge: IndexedDB; VTT: account,
  storage worker and session handoff). The package's raw `Storage` draft helpers
  remain exported but are not used by either host and skip some validation.
- Every `level1Certified` flag in `CERTIFIED_SUPPORT_MANIFEST` is `false`; the
  export is an inventory of implemented, tested classes, not a certification.
  Real-device and assistive-technology acceptance was waived by the owner and is
  not passed.
- No host context props (allowed sources, starting level) exist; `allowedSources`
  is set through `initialDraft`.

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
`createdAt`, and optional `combatGuidance`, `creationAttemptId`, `draftId` and
`draftRevision`. Await host persistence before closing; throw/reject to surface a
save failure inside the modal and keep the creator open.

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
