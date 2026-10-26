import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { CharacterCreator } from '../components/CharacterCreator';
import PersonalityWizard from '../components/guided/PersonalityWizard';
import {
  CreationSessionContext,
  useCreationSession,
} from '../hooks/useCreationSession';
import type { CreationDraft } from '../types/draft';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';

describe('canonical creation session presentations', () => {
  it('keeps identity and authored loadout when switching from full to guided creation', () => {
    const draft = creationDataToDraft(REFERENCE_BUILDS.F24.creationData);
    const changed = vi.fn();
    render(
      <CharacterCreator
        isOpen
        initialMode="full"
        initialDraft={draft}
        edition="2024"
        onCancel={vi.fn()}
        onComplete={vi.fn()}
        onDraftChange={changed}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Use guided creation' }),
    );
    expect(screen.getByText('How do you want to play?')).toBeInTheDocument();
    const current = changed.mock.lastCall?.[0] as CreationDraft;
    expect(current.characterId).toBe(draft.characterId);
    expect(current.name).toBe(draft.name);
    expect(current.loadout).toEqual(draft.loadout);
  });

  it('recovers quiz answers and position without regenerating the character', () => {
    const initial = creationDataToDraft(REFERENCE_BUILDS.F24.creationData);
    const changed = vi.fn();
    function Quiz({
      draft,
      step = 0,
    }: {
      draft: CreationDraft;
      step?: number;
    }) {
      const session = useCreationSession({
        initialDraft: draft,
        edition: '2024',
        onDraftChange: changed,
      });
      return (
        <CreationSessionContext.Provider value={session}>
          <PersonalityWizard
            isOpen
            edition="2024"
            initialPresentation={{ mode: 'guided', guidedFlow: 'quiz', step }}
            onBack={vi.fn()}
            onClose={vi.fn()}
            onComplete={vi.fn()}
          />
        </CreationSessionContext.Provider>
      );
    }
    const view = render(<Quiz draft={initial} />);
    fireEvent.click(
      screen.getByRole('button', { name: /With a supernatural gift/ }),
    );
    const saved = changed.mock.lastCall?.[0] as CreationDraft;
    expect(saved.creationData?.guidedAnswers?.path).toBe('magic');
    expect(saved.characterId).toBe(initial.characterId);
    expect(saved.loadout).toEqual(initial.loadout);
    view.unmount();
    render(<Quiz draft={saved} step={1} />);
    expect(
      screen.getByRole('heading', { name: 'The Path of Magic' }),
    ).toBeInTheDocument();
    expect(
      (changed.mock.lastCall?.[0] as CreationDraft).creationData?.guidedAnswers
        ?.path,
    ).toBe('magic');
  });
});
