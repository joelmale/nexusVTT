import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDiceRolls, useIsHost } from '@/stores/gameStore';
import { webSocketService } from '@/services/websocket';
import { diceSounds } from '@/services/diceSounds';
import { initializeTheme } from '@/services/themeManager';
import { DICE_THEMES, getStoredDiceTheme } from '@/utils/diceThemes';
import { PopoverMenu } from '../PopoverMenu';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2';
import VolumeX from 'lucide-react/dist/esm/icons/volume-x';
import Palette from 'lucide-react/dist/esm/icons/palette';
import SlidersHorizontal from 'lucide-react/dist/esm/icons/sliders-horizontal';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Globe from 'lucide-react/dist/esm/icons/globe';

import { PolyhedralIcon } from './PolyhedralIcon';
import { MacroCustomizeModal } from './MacroCustomizeModal';
import { RollLog } from './RollLog';
import {
  DIE_TYPES,
  MODIFIER_VALUES,
  countersToNotation,
  d20Expression,
  emptyCounters,
  formatModifier,
  type DieCounters,
} from './diceNotation';
import type { DieType } from './PolyhedralIcon';
import {
  CATALOG_MACROS,
  loadCustomMacros,
  loadEnabledMacroIds,
  macroIcon,
  saveCustomMacros,
  saveEnabledMacroIds,
  type MacroItem,
} from './macros';
import { useDiceRoll } from './useDiceRoll';
import styles from './DiceRoller.module.css';

const SHELF_ICON_COLOR = '#C9D1DC';

/**
 * Unified Dice Roller panel: d20 engine, modifier row, dice shelf with
 * counters, notation input, macros and a collapsible roll log.
 *
 * It only feeds the roll pipeline (see useDiceRoll); the 3D dice are animated
 * by DiceBox3D from `gameStore.diceRolls`.
 */
export const DiceRoller: React.FC = () => {
  const diceRolls = useDiceRolls();
  const isHost = useIsHost();

  const [modifier, setModifierState] = useState(0);
  const [counters, setCountersState] = useState<DieCounters>(emptyCounters);
  // Mirrors of the two pieces of state that derive the notation, so rapid
  // consecutive clicks (several events before a re-render) never read a
  // stale snapshot and drop a die.
  const modifierRef = useRef(0);
  const countersRef = useRef<DieCounters>(emptyCounters());
  // Dice in the order they were first queued, so the notation reads naturally.
  const orderRef = useRef<DieType[]>([]);
  const setModifier = (value: number) => {
    modifierRef.current = value;
    setModifierState(value);
  };
  const setCounters = (value: DieCounters) => {
    countersRef.current = value;
    if (DIE_TYPES.every((die) => value[die] === 0)) orderRef.current = [];
    setCountersState(value);
  };
  const [notation, setNotation] = useState('');
  const [error, setError] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(diceSounds.isSoundMuted());
  const [diceTheme, setDiceTheme] = useState<string>(() => getStoredDiceTheme());
  const [isConnected, setIsConnected] = useState(false);
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [enabledMacroIds, setEnabledMacroIds] =
    useState<string[]>(loadEnabledMacroIds);
  const [customMacros, setCustomMacros] =
    useState<MacroItem[]>(loadCustomMacros);

  const { roll } = useDiceRoll({ isPrivate: isHost && isPrivate });

  useEffect(() => {
    const check = () => setIsConnected(webSocketService.isConnected());
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    initializeTheme()?.catch?.((err: unknown) => {
      console.warn('Failed to initialize theme in DiceRoller:', err);
    });
  }, []);

  const allMacros = useMemo(
    () => [...CATALOG_MACROS, ...customMacros],
    [customMacros],
  );
  const visibleMacros = useMemo(
    () => allMacros.filter((macro) => enabledMacroIds.includes(macro.id)),
    [allMacros, enabledMacroIds],
  );

  const visibleRolls = useMemo(
    () => (isHost ? diceRolls : diceRolls.filter((r) => !r.isPrivate)),
    [isHost, diceRolls],
  );

  const dispatchRoll = (expression: string, mode: Parameters<typeof roll>[1]) => {
    const message = roll(expression, mode);
    setError(message ?? '');
    return message === null;
  };

  const handleModifierChange = (value: number) => {
    setModifier(value);
    // Counter-built pools carry the modifier; hand-typed text is left alone.
    if (DIE_TYPES.some((die) => countersRef.current[die] > 0)) {
      setNotation(
        countersToNotation(countersRef.current, value, orderRef.current),
      );
    }
  };

  const adjustDie = (die: DieType, delta: number) => {
    const current = countersRef.current;
    const next = {
      ...current,
      [die]: Math.max(0, current[die] + delta),
    };
    if (current[die] === 0 && delta > 0) {
      orderRef.current = [...orderRef.current.filter((d) => d !== die), die];
    }
    setError('');
    setCounters(next);
    setNotation(countersToNotation(next, modifierRef.current, orderRef.current));
  };

  const handleNotationChange = (value: string) => {
    setNotation(value);
    setCounters(emptyCounters());
    setError('');
  };

  const handleRollPool = () => {
    if (!notation.trim()) return;
    if (dispatchRoll(notation, 'none')) {
      setNotation('');
      setCounters(emptyCounters());
    }
  };

  const handleToggleMacro = (id: string) => {
    setEnabledMacroIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((existing) => existing !== id)
        : [...prev, id];
      saveEnabledMacroIds(next);
      return next;
    });
  };

  const handleAddCustomMacro = (name: string, formula: string) => {
    const id = `custom_${Date.now()}`;
    const updated: MacroItem[] = [
      ...customMacros,
      { id, label: name, formula, category: 'custom' },
    ];
    setCustomMacros(updated);
    saveCustomMacros(updated);
    setEnabledMacroIds((prev) => {
      const next = [...prev, id];
      saveEnabledMacroIds(next);
      return next;
    });
  };

  const handleToggleSound = () => {
    setIsSoundMuted(diceSounds.toggleMute());
  };

  const selectDiceTheme = (newTheme: string) => {
    setDiceTheme(newTheme);
    try {
      localStorage.setItem('nexus_dice_theme', newTheme);
    } catch (e) {
      console.warn('Failed to save dice theme to localStorage:', e);
    }
    // DiceBox3D reads the theme from localStorage but cannot observe a
    // same-tab write, so tell it explicitly.
    window.dispatchEvent(
      new CustomEvent('nexus-dice-theme-changed', {
        detail: { theme: newTheme },
      }),
    );
  };

  const themeName =
    DICE_THEMES.find((theme) => theme.id === diceTheme)?.name || 'Default';

  return (
    <div className={styles.root} data-testid="dice-roller">
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <PolyhedralIcon type="d20" size={24} color="#6B9EFC" />
          <h2 className={styles.title}>Dice Roller</h2>
          <span
            className={`${styles.badge} ${
              isConnected ? styles.badgeOnline : styles.badgeOffline
            }`}
            data-testid="connection-badge"
            title={
              isConnected
                ? undefined
                : "Rolls work offline, but won't sync to other players"
            }
          >
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className={styles.headerActions}>
          {isHost ? (
            <label className={styles.visibility}>
              {isPrivate ? <Lock size={13} /> : <Globe size={13} />}
              <select
                className={styles.visibilitySelect}
                value={isPrivate ? 'private' : 'public'}
                onChange={(e) => setIsPrivate(e.target.value === 'private')}
                aria-label="Roll visibility"
              >
                <option value="public">Public</option>
                <option value="private">Private (GM only)</option>
              </select>
            </label>
          ) : (
            <span className={styles.visibility}>
              <Globe size={13} /> Public
            </span>
          )}

          <PopoverMenu
            trigger={
              <span
                className={styles.iconButton}
                title={`Dice Theme: ${themeName}`}
              >
                <Palette size={16} />
              </span>
            }
            contentClassName={styles.themeMenu}
          >
            {DICE_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`${styles.themeItem} ${
                  diceTheme === theme.id ? styles.themeItemActive : ''
                }`}
                onClick={(e) => {
                  selectDiceTheme(theme.id);
                  // Dismiss the popover so it does not cover the roll controls.
                  (
                    e.currentTarget.closest('[popover]') as
                      | (HTMLElement & { hidePopover?: () => void })
                      | null
                  )?.hidePopover?.();
                }}
                aria-pressed={diceTheme === theme.id}
              >
                {theme.name}
              </button>
            ))}
          </PopoverMenu>

          <button
            type="button"
            className={styles.iconButton}
            onClick={handleToggleSound}
            title={isSoundMuted ? 'Unmute dice sounds' : 'Mute dice sounds'}
            aria-label={isSoundMuted ? 'Unmute dice sounds' : 'Mute dice sounds'}
          >
            {isSoundMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {/* d20 engine */}
        <section className={styles.engine} aria-label="d20 engine">
          <button
            type="button"
            className={`${styles.wing} ${styles.wingAdv}`}
            onClick={() => dispatchRoll(d20Expression(modifier), 'advantage')}
            aria-label="Roll d20 with advantage"
            data-testid="advantage-button"
          >
            <span className={styles.wingLabel}>ADVANTAGE</span>
            <span className={styles.wingSub}>+Adv (Pick High)</span>
          </button>

          <button
            type="button"
            className={styles.d20Button}
            onClick={() => dispatchRoll(d20Expression(modifier), 'none')}
            aria-label="Roll d20"
            data-testid="roll-d20-button"
          >
            <PolyhedralIcon type="d20" size={34} color="#ffffff" />
            <span className={styles.d20Text}>ROLL D20</span>
          </button>

          <button
            type="button"
            className={`${styles.wing} ${styles.wingDis}`}
            onClick={() =>
              dispatchRoll(d20Expression(modifier), 'disadvantage')
            }
            aria-label="Roll d20 with disadvantage"
            data-testid="disadvantage-button"
          >
            <span className={styles.wingLabel}>DISADVANTAGE</span>
            <span className={styles.wingSub}>-Dis (Pick Low)</span>
          </button>
        </section>

        {/* Modifier row */}
        <div className={styles.modifierRow}>
          <span className={styles.modifierLabel} id="dice-modifier-label">
            MODIFIER:
          </span>
          <div
            className={styles.modifierChips}
            role="radiogroup"
            aria-labelledby="dice-modifier-label"
          >
            {MODIFIER_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={modifier === value}
                className={`${styles.modChip} ${
                  modifier === value ? styles.modChipActive : ''
                }`}
                onClick={() => handleModifierChange(value)}
              >
                {formatModifier(value)}
              </button>
            ))}
          </div>
        </div>

        {/* Dice shelf */}
        <div className={styles.shelf}>
          {DIE_TYPES.map((die) => {
            const count = counters[die];
            return (
              <button
                key={die}
                type="button"
                className={styles.dieButton}
                onClick={() => adjustDie(die, 1)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  adjustDie(die, -1);
                }}
                title={`Click to add ${die}, right-click to remove`}
                aria-label={
                  count > 0 ? `${die}, ${count} queued` : die
                }
                data-testid={`die-btn-${die}`}
              >
                <PolyhedralIcon type={die} size={34} color={SHELF_ICON_COLOR} />
                <span className={styles.dieName}>{die}</span>
                {count > 0 && (
                  <span
                    className={styles.dieCounter}
                    data-testid={`die-count-${die}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notation input */}
        <div className={styles.notationRow}>
          <input
            type="text"
            className={styles.textInput}
            placeholder="2d8 + 1d6 + 3"
            value={notation}
            onChange={(e) => handleNotationChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRollPool();
            }}
            aria-label="Dice notation"
          />
          <button
            type="button"
            className={styles.rollPoolButton}
            onClick={handleRollPool}
            disabled={!notation.trim()}
          >
            Roll Pool
          </button>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {/* Macros */}
        <section className={styles.macros} aria-label="Macros">
          <div className={styles.macroHeader}>
            <span className={styles.sectionHeading}>Macros</span>
            <button
              type="button"
              className={styles.customizeButton}
              onClick={() => setIsMacroModalOpen(true)}
              title="Customize which macros appear for your character"
              aria-label="Customize macros"
            >
              <SlidersHorizontal size={13} /> Customize
            </button>
          </div>
          <div className={styles.macroList}>
            {visibleMacros.map((macro) => {
              const Icon = macroIcon(macro);
              return (
                <button
                  key={macro.id}
                  type="button"
                  className={styles.macroPill}
                  onClick={() => dispatchRoll(macro.formula, 'none')}
                  title={`Roll ${macro.formula}`}
                >
                  <Icon size={14} />
                  {macro.label}
                  <span className={styles.macroFormula}>({macro.formula})</span>
                </button>
              );
            })}
            {visibleMacros.length === 0 && (
              <button
                type="button"
                className={styles.macroPill}
                onClick={() => setIsMacroModalOpen(true)}
              >
                + No active macros. Click here to choose actions.
              </button>
            )}
          </div>
        </section>

        <RollLog rolls={visibleRolls} />
      </div>

      {isMacroModalOpen && (
        <MacroCustomizeModal
          macros={allMacros}
          enabledIds={enabledMacroIds}
          onToggle={handleToggleMacro}
          onAddCustom={handleAddCustomMacro}
          onClose={() => setIsMacroModalOpen(false)}
        />
      )}
    </div>
  );
};
