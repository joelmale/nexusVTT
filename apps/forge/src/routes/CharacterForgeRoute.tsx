import React, { useCallback, useState } from 'react';

import {
  CharacterCreationWizard,
  type CharacterCreationResult,
} from '@nexus/character-creator';
import Hammer from 'lucide-react/dist/esm/icons/hammer';

import { addCharacter } from '../services/dbService';

export const CharacterForgeRoute: React.FC = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(true);
  const [createdCharacterName, setCreatedCharacterName] = useState<
    string | null
  >(null);

  const handleComplete = useCallback(
    async (result: CharacterCreationResult): Promise<void> => {
      await addCharacter(result.character);
      setCreatedCharacterName(result.character.name);
      setIsWizardOpen(false);
    },
    [],
  );

  const openWizard = (): void => {
    setCreatedCharacterName(null);
    setIsWizardOpen(true);
  };

  return (
    <main className="min-h-screen bg-theme-primary text-theme-primary font-sans flex items-center justify-center p-4 md:p-8">
      {!isWizardOpen && (
        <section className="w-full max-w-3xl border border-theme-primary bg-theme-secondary rounded-lg shadow-2xl p-6 md:p-10 text-center">
          <span
            className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-theme-primary bg-theme-tertiary text-accent-yellow-light"
            aria-hidden="true"
          >
            <Hammer size={28} strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 text-3xl md:text-4xl font-bold text-theme-primary">
            Character Forge
          </h1>
          <blockquote className="mx-auto mt-3 max-w-xl font-serif italic text-theme-muted">
            Great characters are forged in fire even if they start on paper.
          </blockquote>

          {createdCharacterName && (
            <p
              className="mt-6 font-semibold text-accent-green-light"
              role="status"
            >
              {createdCharacterName} is ready for adventure.
            </p>
          )}

          <button
            type="button"
            onClick={openWizard}
            className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent-red px-6 py-3 font-bold text-white shadow-lg transition-colors hover:bg-accent-red-light focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow-light"
          >
            <Hammer size={18} aria-hidden="true" />
            {createdCharacterName
              ? 'Forge another character'
              : 'Begin character creation'}
          </button>
        </section>
      )}

      <CharacterCreationWizard
        isOpen={isWizardOpen}
        edition="2024"
        submitLabel="Save Character"
        onCancel={() => setIsWizardOpen(false)}
        onComplete={handleComplete}
      />
    </main>
  );
};
