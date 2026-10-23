import React, { Suspense, useEffect, useState } from 'react';
import Dices from 'lucide-react/dist/esm/icons/dices';
import MapIcon from 'lucide-react/dist/esm/icons/map';
import User from 'lucide-react/dist/esm/icons/user';
import type { Character } from '@nexus/character-contracts';
import type {
  SimpleTabId,
  UseSimplePlayerModeReturn,
} from '@/hooks/useSimplePlayerMode';
import { useReducedMotionSync } from '@/hooks/useReducedMotion';
import { useThemeSync } from '@/hooks/useTheme';
import { useCharacterStore } from '@/stores/characterStore';
import { useColorScheme, useSettings } from '@/stores/gameStore';
import { applyColorScheme } from '@/utils/colorSchemes';
import { CharacterClaimModal } from './CharacterClaimModal';
import { CompactInitiativeRibbon } from './CompactInitiativeRibbon';
import { HandoutSpotlight } from './HandoutSpotlight';
import { LiveRollToast } from './LiveRollToast';
import { MobileCharacterSheet } from './MobileCharacterSheet';
import { SimpleDiceDrawer } from './SimpleDiceDrawer';
import { SimpleMapViewport } from './SimpleMapViewport';
import { useSimplePlayerSession } from './useSimplePlayerSession';
import styles from './SimplePlayerShell.module.css';

const SharedCharacterCreator = React.lazy(() =>
  import('@/components/SharedCharacterCreator').then((m) => ({
    default: m.SharedCharacterCreator,
  })),
);

export interface SimplePlayerShellProps {
  mode: UseSimplePlayerModeReturn;
}

const TABS: Array<{ id: SimpleTabId; label: string; icon: typeof MapIcon }> = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'hero', label: 'My Hero', icon: User },
  { id: 'rolls', label: 'Rolls', icon: Dices },
];

/**
 * Simple Player Mode: a phone- and tablet-first view of the game for players
 * whose DM runs the full VTT. Map, character, turn order and dice only.
 */
export const SimplePlayerShell: React.FC<SimplePlayerShellProps> = ({
  mode,
}) => {
  const session = useSimplePlayerSession();
  const settings = useSettings();
  const colorScheme = useColorScheme();
  useThemeSync();
  useReducedMotionSync();

  useEffect(() => {
    applyColorScheme(colorScheme);
  }, [colorScheme]);
  useEffect(() => {
    void import('@/services/themeManager').then(({ switchTheme }) =>
      switchTheme(settings.enableGlassmorphism ? 'glass' : 'solid'),
    );
  }, [settings.enableGlassmorphism]);

  const [claimOpen, setClaimOpen] = useState(
    () => !session.isSpectator && !session.myCharacter,
  );
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { isTabletSplitView, activeTab, setActiveTab } = mode;
  const tabs = session.isSpectator
    ? TABS.filter((tab) => tab.id !== 'hero')
    : TABS;
  const sideTab: SimpleTabId =
    session.isSpectator && activeTab === 'hero' ? 'rolls' : activeTab;

  const handleCreated = async (characterId: string, character?: Character) => {
    setCreatorOpen(false);
    if (character) {
      const result = await session.submitCharacter(character);
      if (result.status === 'applied') {
        useCharacterStore.getState().setActiveCharacter(characterId);
      }
    }
  };

  const panel = (tab: SimpleTabId) =>
    tab === 'hero' ? (
      <MobileCharacterSheet
        character={session.myCharacter}
        weapons={session.weapons}
        isMyTurn={session.combat.isMyTurn}
        onRoll={session.roll}
        onDeathSave={session.deathSave}
        onSelectCharacter={() => setClaimOpen(true)}
      />
    ) : (
      <SimpleDiceDrawer
        rolls={session.visibleRolls}
        handouts={session.handouts}
        onRoll={session.roll}
        onOpenHandout={session.openHandout}
      />
    );

  return (
    <div
      className={`${styles.shell} ${isTabletSplitView ? styles.split : ''}`}
      data-testid="simple-player-shell"
    >
      <div className={styles.top}>
        <CompactInitiativeRibbon
          characterName={session.myCharacter?.name}
          currentHp={session.myCharacter?.hitPoints}
          maxHp={session.myCharacter?.maxHitPoints}
          tempHp={session.myCharacter?.temporaryHitPoints}
          armorClass={session.myCharacter?.armorClass}
          conditions={session.myCharacter?.conditions ?? []}
          isInCombat={session.combat.isInCombat}
          roundNumber={session.combat.round}
          combatants={session.combat.combatants}
          activeLabel={session.combat.activeLabel}
          upNextLabel={session.combat.upNextLabel}
          isMyTurn={session.combat.isMyTurn}
          connectionState={session.connectionState}
          pendingIntent={session.pendingIntent}
          hostAway={session.hostAway}
          readOnly={session.isSpectator}
          onAdjustHp={session.adjustHp}
          onEndTurn={session.endTurn}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <LiveRollToast rolls={session.visibleRolls} />
      </div>

      <main className={styles.main}>
        <div
          className={styles.mapPane}
          hidden={!isTabletSplitView && activeTab !== 'map'}
        >
          {session.scene ? (
            <SimpleMapViewport
              scene={session.scene}
              userId={session.userId}
              ownedCharacterIds={session.ownedCharacterIds}
              readOnly={session.isSpectator}
            />
          ) : (
            <div className={styles.waiting} role="status">
              <p>Waiting for the DM to open a map…</p>
            </div>
          )}
        </div>

        {isTabletSplitView ? (
          <aside className={styles.sidePane} aria-label="Side panel">
            <div className={styles.sideTabs} role="tablist">
              {tabs
                .filter((tab) => tab.id !== 'map')
                .map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={sideTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>
            <div className={styles.sideContent}>{panel(sideTab)}</div>
          </aside>
        ) : (
          activeTab !== 'map' && (
            <div className={styles.tabPane}>{panel(sideTab)}</div>
          )
        )}
      </main>

      {!isTabletSplitView && (
        <nav className={styles.tabBar} aria-label="Simple mode">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={22} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      )}

      {settingsOpen && (
        <div className={styles.sheetBackdrop}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            {!session.isSpectator && (
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setClaimOpen(true);
                }}
              >
                Switch Character
              </button>
            )}
            {mode.canSplitView && (
              <button
                type="button"
                aria-pressed={isTabletSplitView}
                onClick={mode.toggleTabletSplitView}
              >
                Tablet Split-Screen
              </button>
            )}
            <button type="button" onClick={() => mode.setUiMode('full')}>
              Switch to Full VTT
            </button>
            <button type="button" onClick={session.leave}>
              Leave Game
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setSettingsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {claimOpen && !session.isSpectator && (
        <CharacterClaimModal
          characters={session.sessionCharacters}
          userId={session.userId}
          onClaim={session.claimCharacter}
          onCreateNew={() => {
            setClaimOpen(false);
            setCreatorOpen(true);
          }}
          onClose={() => setClaimOpen(false)}
        />
      )}

      {creatorOpen && (
        <div className={styles.creator}>
          <Suspense fallback={<p role="status">Loading character creator…</p>}>
            <SharedCharacterCreator
              playerId={session.userId}
              onComplete={(id, character) => void handleCreated(id, character)}
              onCancel={() => setCreatorOpen(false)}
            />
          </Suspense>
        </div>
      )}

      {session.spotlight && (
        <HandoutSpotlight
          handout={session.spotlight}
          onDismiss={session.dismissSpotlight}
        />
      )}
    </div>
  );
};
