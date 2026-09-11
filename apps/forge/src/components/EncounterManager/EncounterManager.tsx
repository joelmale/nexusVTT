import React, { useEffect } from 'react';
import { useIsTablet, useIsDesktop } from '../../hooks/useMediaQuery';
import { useEncounterCombat } from './hooks/useEncounterCombat';
import { DesktopView } from './views/DesktopView';
import { TabletView } from './views/TabletView';
import { MobileView } from './views/MobileView';
import './EncounterManager.css';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface EncounterManagerProps {
  encounterId: string;
  onBack?: () => void;
}

export function EncounterManager({ encounterId, onBack }: EncounterManagerProps) {
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

  let deviceType: DeviceType;
  if (isDesktop) {
    deviceType = 'desktop';
  } else if (isTablet) {
    deviceType = 'tablet';
  } else {
    deviceType = 'mobile';
  }

  const {
    players,
    initiativeOrder,
    currentTurn,
    round,
    isCombatActive,
    isLoadingEncounter,
    addPlayers,
    reorderInitiative,
    updateInitiativeEntry,
    nextTurn,
    previousTurn,
    newRound,
    saveCombatState,
  } = useEncounterCombat({ encounterId });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case ' ': // Space
        case 'Enter':
          if (event.shiftKey) {
            event.preventDefault();
            previousTurn();
          } else {
            event.preventDefault();
            nextTurn();
          }
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          newRound();
          break;
        case 's':
        case 'S':
          event.preventDefault();
          saveCombatState();
          break;
        case 'Escape':
          if (onBack) {
            event.preventDefault();
            onBack();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [nextTurn, previousTurn, newRound, saveCombatState, onBack]);

  if (isLoadingEncounter) {
    return (
      <div className="encounter-manager-loading">
        <div className="loading-content">
          <div className="loading-spinner">⚔️</div>
          <h2>Loading Encounter...</h2>
          <p>Preparing your combat session</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    const commonProps = {
      initiativeOrder,
      currentTurn,
      round,
      players,
      isCombatActive,
      onReorderInitiative: reorderInitiative,
      onUpdateInitiativeEntry: updateInitiativeEntry,
      onImportPlayers: addPlayers,
      onNextTurn: nextTurn,
      onPreviousTurn: previousTurn,
      onNewRound: newRound,
      onSaveCombat: saveCombatState,
      onBack,
    };

    switch (deviceType) {
      case 'desktop':
        return <DesktopView {...commonProps} />;
      case 'tablet':
        return <TabletView {...commonProps} />;
      case 'mobile':
        return <MobileView {...commonProps} />;
    }
  };

  return (
    <div className="encounter-manager">
      {renderView()}
    </div>
  );
}
