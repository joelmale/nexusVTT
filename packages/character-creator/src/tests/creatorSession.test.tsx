import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { CharacterCreator } from '../components/CharacterCreator';
import type { CreationDraft } from '../types/draft';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';

describe('canonical creation session presentations', () => {
  it.each(['full', 'guided'] as const)(
    'opens the one creator for mode %s and keeps identity and authored loadout',
    (mode) => {
      const draft = creationDataToDraft(REFERENCE_BUILDS.F24.creationData);
      const changed = vi.fn();
      render(
        <CharacterCreator
          isOpen
          initialMode={mode}
          initialDraft={draft}
          edition="2024"
          onCancel={vi.fn()}
          onComplete={vi.fn()}
          onDraftChange={changed}
        />,
      );
      expect(
        screen.queryByRole('button', { name: 'Use guided creation' }),
      ).toBeNull();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      const current = changed.mock.lastCall?.[0] as CreationDraft;
      expect(current.characterId).toBe(draft.characterId);
      expect(current.name).toBe(draft.name);
      expect(current.loadout).toEqual(draft.loadout);
    },
  );
});
