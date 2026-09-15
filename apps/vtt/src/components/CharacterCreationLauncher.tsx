import React, { useState, Suspense } from 'react';
import type { Character } from '@nexus/character-contracts';
import { CharacterCreationContext } from './CharacterCreationContext';

// The shared creator pulls in the full 5e rules dataset, so it is always
// loaded lazily — nothing of it reaches the initial VTT bundle.
const SharedCharacterCreator = React.lazy(() =>
  import('./SharedCharacterCreator').then((module) => ({
    default: module.SharedCharacterCreator,
  })),
);

// Context for sharing character creation launcher across components

export const CharacterCreationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [launcher, setLauncher] = useState<{
    playerId: string;
    context: 'fullpage' | 'modal';
    onComplete: (characterId: string, character?: Character) => void;
    onCancel?: () => void;
  } | null>(null);

  const startCharacterCreation = (
    playerId: string,
    context: 'fullpage' | 'modal' = 'modal',
    onComplete: (characterId: string, character?: Character) => void,
    onCancel?: () => void,
  ) => {
    // The creator ships its own scoped stylesheet inside the lazy chunk, so
    // there is nothing to preload here — Suspense covers the load.
    setLauncher({
      playerId,
      context,
      onComplete,
      onCancel,
    });
  };

  const closeLauncher = () => {
    setLauncher(null);
  };

  const LauncherComponent = launcher ? (
    <CharacterCreationLauncher
      playerId={launcher.playerId}
      context={launcher.context}
      onComplete={(characterId, character) => {
        launcher.onComplete(characterId, character);
        closeLauncher();
      }}
      onCancel={() => {
        if (launcher.onCancel) {
          launcher.onCancel();
        }
        closeLauncher();
      }}
    />
  ) : null;

  return (
    <CharacterCreationContext.Provider
      value={{
        startCharacterCreation,
        LauncherComponent,
        isActive: !!launcher,
      }}
    >
      {children}
    </CharacterCreationContext.Provider>
  );
};

interface CharacterCreationLauncherProps {
  playerId: string;
  onComplete: (characterId: string, character?: Character) => void;
  context: 'fullpage' | 'modal';
  onCancel?: () => void;
}

/**
 * Launcher component that handles dual context rendering of the character creation wizard
 * - fullpage: Renders as a full-page experience (for initial character creation)
 * - modal: Renders as a modal overlay (for in-game character creation)
 */
export const CharacterCreationLauncher: React.FC<
  CharacterCreationLauncherProps
> = ({ playerId, onComplete, context, onCancel }) => {
  const [isActive, setIsActive] = useState(true);

  const handleComplete = (characterId: string, character?: Character) => {
    setIsActive(false);
    onComplete(characterId, character);
  };

  const handleCancel = () => {
    setIsActive(false);
    if (onCancel) {
      onCancel();
    }
  };

  if (!isActive) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <div className="character-creation-loading">
          <div className="spinner" />
          <p>Loading character creation...</p>
        </div>
      }
    >
      <SharedCharacterCreator
        playerId={playerId}
        onComplete={handleComplete}
        onCancel={handleCancel}
        isModal={context === 'modal'}
      />
    </Suspense>
  );
};
