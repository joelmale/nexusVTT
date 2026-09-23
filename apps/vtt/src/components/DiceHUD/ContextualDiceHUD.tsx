import React, { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import { useDiceRolls, useIsHost, useGameStore } from '@/stores/gameStore';
import { useUIStackStore } from '@/stores/uiStackStore';
import { createDiceRoll } from '@/utils/dice';
import { webSocketService } from '@/services/websocket';
import { diceSounds } from '@/services/diceSounds';
import { initializeTheme } from '@/services/themeManager';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2';
import VolumeX from 'lucide-react/dist/esm/icons/volume-x';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Unlock from 'lucide-react/dist/esm/icons/unlock';
import Plus from 'lucide-react/dist/esm/icons/plus';
import X from 'lucide-react/dist/esm/icons/x';
import SlidersHorizontal from 'lucide-react/dist/esm/icons/sliders-horizontal';

import { PolyhedralIcon, type DieType } from './PolyhedralIcon';
import styles from './ContextualDiceHUD.module.css';

export interface ContextualDiceHUDProps {
  onSwitchToClassic?: () => void;
}

type RollMode = 'none' | 'advantage' | 'disadvantage';

interface DieDefinition {
  type: DieType;
  label: string;
  color: string;
}

const DIE_DEFINITIONS: DieDefinition[] = [
  { type: 'd4', label: 'd4', color: '#fbbf24' },
  { type: 'd6', label: 'd6', color: '#38bdf8' },
  { type: 'd8', label: 'd8', color: '#34d399' },
  { type: 'd10', label: 'd10', color: '#c084fc' },
  { type: 'd12', label: 'd12', color: '#f472b6' },
  { type: 'd20', label: 'd20', color: '#818cf8' },
  { type: 'd100', label: 'd100', color: '#f87171' },
];

const QUICK_POOLS = [
  { label: '+1d6', die: 'd6', count: 1 },
  { label: '+2d6', die: 'd6', count: 2 },
  { label: '+1d8', die: 'd8', count: 1 },
  { label: '+1d10', die: 'd10', count: 1 },
  { label: '+4d6', die: 'd6', count: 4 },
];

export interface MacroItem {
  id: string;
  label: string;
  formula: string;
  category?: 'attack' | 'spell' | 'utility' | 'custom';
}

export interface RollToast {
  id: string;
  expression: string;
  total: number;
  results: number[];
  modifier?: number;
  crit?: 'success' | 'failure' | null;
  rollType?: 'normal' | 'advantage' | 'disadvantage';
}

const CATALOG_MACROS: MacroItem[] = [
  { id: 'attack', label: '⚔️ Melee Attack', formula: '1d20+5', category: 'attack' },
  { id: 'ranged', label: '🏹 Ranged Attack', formula: '1d20+6', category: 'attack' },
  { id: 'sneak', label: '🗡️ Sneak Attack', formula: '3d6', category: 'attack' },
  { id: 'fireball', label: '🔥 Fireball', formula: '8d6', category: 'spell' },
  { id: 'cure', label: '❤️ Cure Wounds', formula: '1d8+3', category: 'spell' },
  { id: 'healing_word', label: '✨ Healing Word', formula: '1d4+3', category: 'spell' },
  { id: 'guiding_bolt', label: '⚡ Guiding Bolt', formula: '4d6', category: 'spell' },
  { id: 'eldritch_blast', label: '💥 Eldritch Blast', formula: '1d10', category: 'spell' },
  { id: 'divine_smite', label: '⚔️ Divine Smite', formula: '2d8', category: 'spell' },
  { id: 'death_save', label: '🛡️ Death Save', formula: '1d20', category: 'utility' },
  { id: 'bardic_insp', label: '🎲 Bardic Inspiration', formula: '1d8', category: 'utility' },
  { id: 'second_wind', label: '💨 Second Wind', formula: '1d10+2', category: 'utility' },
];

const DEFAULT_ENABLED_IDS = ['attack', 'sneak', 'fireball', 'cure', 'death_save'];

const DICE_THEMES = [
  { id: 'white', name: 'Default' },
  { id: 'black', name: 'Black' },
  { id: 'bronze', name: 'Bronze' },
  { id: 'dragons', name: 'Dragons' },
  { id: 'fire', name: 'Fire' },
  { id: 'ice', name: 'Ice' },
  { id: 'poison', name: 'Poison' },
  { id: 'astralsea', name: 'Astral Sea' },
  { id: 'rainbow', name: 'Rainbow' },
];

export const ContextualDiceHUD: React.FC<ContextualDiceHUDProps> = ({
  onSwitchToClassic,
}) => {
  const diceRolls = useDiceRolls();
  const isHost = useIsHost();
  const user = useGameStore((state) => state.user);
  const sendChatMessage = useGameStore((state) => state.sendChatMessage);

  // Roll Mode: 'none' | 'advantage' | 'disadvantage'
  const [rollMode, setRollMode] = useState<RollMode>('none');
  // D20 modifier
  const [d20Modifier, setD20Modifier] = useState<number>(0);
  const [customMod, setCustomMod] = useState<string>('');

  // Staged Dice Pool: Record<dieType, count>
  const [stagedDice, setStagedDice] = useState<Record<string, number>>({
    d4: 0,
    d6: 0,
    d8: 0,
    d10: 0,
    d12: 0,
    d20: 0,
    d100: 0,
  });

  // Drawer expansion state (defaults to open)
  const [isTrayExpanded, setIsTrayExpanded] = useState(true);

  // Custom text formula input
  const [formulaInput, setFormulaInput] = useState('');
  const [error, setError] = useState('');

  // Host private roll toggle
  const [isPrivate, setIsPrivate] = useState(false);

  // Sound mute state
  const [isSoundMuted, setIsSoundMuted] = useState(diceSounds.isSoundMuted());

  // Connection state
  const [isConnected, setIsConnected] = useState(false);

  // Macro Manager Modal state
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [enabledMacroIds, setEnabledMacroIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_dice_enabled_macros');
      return saved ? JSON.parse(saved) : DEFAULT_ENABLED_IDS;
    } catch {
      return DEFAULT_ENABLED_IDS;
    }
  });

  // Custom user-defined macros
  const [customMacros, setCustomMacros] = useState<MacroItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_dice_custom_macros');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [newMacroName, setNewMacroName] = useState('');
  const [newMacroFormula, setNewMacroFormula] = useState('');

  // Dice theme
  const [diceTheme, setDiceTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('nexus_dice_theme') || 'white';
    } catch {
      return 'white';
    }
  });

  // Active Roll Toast Notification (transient 3.5s feedback)
  const [activeToast, setActiveToast] = useState<RollToast | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const [, startRollTransition] = useTransition();
  const historyListRef = useRef<HTMLDivElement>(null);
  const prevRollsCount = useRef(diceRolls.length);

  // Check connection status periodically
  useEffect(() => {
    const checkConn = () => {
      setIsConnected(webSocketService.isConnected());
    };
    checkConn();
    const interval = setInterval(checkConn, 1000);
    return () => clearInterval(interval);
  }, []);

  // Theme setup
  useEffect(() => {
    initializeTheme()?.catch?.((err) => {
      console.warn('Failed to initialize theme in ContextualDiceHUD:', err);
    });
  }, []);

  // Scroll roll history on new roll
  useEffect(() => {
    if (diceRolls.length > prevRollsCount.current && historyListRef.current) {
      historyListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevRollsCount.current = diceRolls.length;
  }, [diceRolls]);

  // Persist enabled macros
  const toggleMacroEnabled = (id: string) => {
    setEnabledMacroIds((prev) => {
      const next = prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id];
      try {
        localStorage.setItem('nexus_dice_enabled_macros', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist macro preferences:', e);
      }
      return next;
    });
  };

  // Add custom macro
  const handleAddCustomMacro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMacroName.trim() || !newMacroFormula.trim()) return;

    const id = `custom_${Date.now()}`;
    const newMacro: MacroItem = {
      id,
      label: newMacroName.trim(),
      formula: newMacroFormula.trim(),
      category: 'custom',
    };

    const updated = [...customMacros, newMacro];
    setCustomMacros(updated);
    setEnabledMacroIds((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem('nexus_dice_enabled_macros', JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to save macro preferences:', err);
      }
      return next;
    });

    try {
      localStorage.setItem('nexus_dice_custom_macros', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save custom macros:', err);
    }

    setNewMacroName('');
    setNewMacroFormula('');
  };

  // Combine catalog and custom macros
  const allMacros = useMemo(() => {
    return [...CATALOG_MACROS, ...customMacros];
  }, [customMacros]);

  // Active macros visible on player's HUD
  const visibleMacros = useMemo(() => {
    return allMacros.filter((macro) => enabledMacroIds.includes(macro.id));
  }, [allMacros, enabledMacroIds]);

  // Compute total staged count
  const totalStagedCount = useMemo(() => {
    return Object.values(stagedDice).reduce((acc, c) => acc + c, 0);
  }, [stagedDice]);

  // Compute staged formula string
  const stagedFormula = useMemo(() => {
    const parts: string[] = [];
    for (const def of DIE_DEFINITIONS) {
      const count = stagedDice[def.type] || 0;
      if (count > 0) {
        parts.push(`${count}${def.type}`);
      }
    }
    if (parts.length === 0) return '';
    let result = parts.join(' + ');
    if (d20Modifier > 0) {
      result += ` + ${d20Modifier}`;
    } else if (d20Modifier < 0) {
      result += ` - ${Math.abs(d20Modifier)}`;
    }
    return result;
  }, [stagedDice, d20Modifier]);

  // Execution engine for rolls
  const executeRoll = (expression: string, explicitMode?: RollMode) => {
    const cleanExpr = expression.replace(/^\/r\s+/i, '').trim();
    if (!cleanExpr) {
      setError('Please provide a dice expression');
      return;
    }

    setError('');
    const effectiveMode = explicitMode !== undefined ? explicitMode : rollMode;

    const roll = createDiceRoll(
      cleanExpr,
      user.id || 'unknown',
      user.name || 'Player',
      {
        isPrivate: isHost && isPrivate,
        advantage: effectiveMode === 'advantage',
        disadvantage: effectiveMode === 'disadvantage',
      },
    );

    if (!roll) {
      setError(`Invalid expression: ${cleanExpr}`);
      return;
    }

    // Trigger Transient Toast Notification
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setActiveToast({
      id: `toast_${Date.now()}`,
      expression: roll.expression,
      total: roll.total,
      results: roll.results,
      modifier: roll.modifier,
      crit: roll.crit,
      rollType: effectiveMode === 'none' ? 'normal' : effectiveMode,
    });
    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 3500);

    const isOnline = webSocketService.isConnected();
    if (!isOnline) {
      useGameStore.getState().addDiceRoll(roll);
    }

    startRollTransition(() => {
      const breakdown = `[${roll.results.join(', ')}]${
        roll.modifier
          ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}`
          : ''
      } = ${roll.total}`;

      const diceData = {
        expression: roll.expression,
        results: roll.results,
        total: roll.total,
        breakdown,
        modifier: roll.modifier,
        diceType: roll.pools.length === 1 ? roll.pools[0].sides : undefined,
        diceCount: roll.pools.length === 1 ? roll.pools[0].count : undefined,
        isCrit: roll.crit === 'success',
        isCritFail: roll.crit === 'failure',
        rollType: effectiveMode === 'none' ? ('normal' as const) : effectiveMode,
      };

      sendChatMessage(
        `rolled ${roll.expression}`,
        'dice-roll',
        undefined,
        diceData,
      );

      if (isOnline) {
        webSocketService.sendEvent({
          type: 'dice/roll-request',
          data: {
            expression: roll.expression,
            isPrivate: isHost && isPrivate,
            advantage: effectiveMode === 'advantage',
            disadvantage: effectiveMode === 'disadvantage',
          },
        });
      }
    });
  };

  // Roll D20 Core Action
  const handleRollD20 = () => {
    let expr = '1d20';
    if (d20Modifier > 0) {
      expr = `1d20+${d20Modifier}`;
    } else if (d20Modifier < 0) {
      expr = `1d20-${Math.abs(d20Modifier)}`;
    }
    executeRoll(expr);
  };

  // Roll Staged Formula
  const handleRollStaged = () => {
    if (!stagedFormula) return;
    executeRoll(stagedFormula);
    clearStagedPool();
  };

  // Staging Pool mutations
  const incrementDie = (type: string, delta = 1) => {
    setError('');
    setStagedDice((prev) => ({
      ...prev,
      [type]: Math.max(0, (prev[type] || 0) + delta),
    }));
  };

  const clearStagedPool = () => {
    setStagedDice({
      d4: 0,
      d6: 0,
      d8: 0,
      d10: 0,
      d12: 0,
      d20: 0,
      d100: 0,
    });
    setError('');
  };

  // Toggle Advantage/Disadvantage
  const handleToggleAdvantage = () => {
    setRollMode((prev) => (prev === 'advantage' ? 'none' : 'advantage'));
  };

  const handleToggleDisadvantage = () => {
    setRollMode((prev) => (prev === 'disadvantage' ? 'none' : 'disadvantage'));
  };

  // Toggle Sound Mute
  const handleToggleSound = () => {
    const nextMuted = diceSounds.toggleMute();
    setIsSoundMuted(nextMuted);
  };

  // Handle Theme Change
  const handleThemeChange = (newTheme: string) => {
    setDiceTheme(newTheme);
    try {
      localStorage.setItem('nexus_dice_theme', newTheme);
    } catch (e) {
      console.warn('Failed to save dice theme:', e);
    }
    window.dispatchEvent(
      new CustomEvent('nexus-dice-theme-changed', {
        detail: { theme: newTheme },
      }),
    );
  };

  // Switch to classic panel
  const handleSwitchClassic = () => {
    if (onSwitchToClassic) {
      onSwitchToClassic();
    } else {
      useUIStackStore.getState().selectPanel('dice');
    }
  };

  // Visible rolls
  const visibleRolls = isHost
    ? diceRolls
    : diceRolls.filter((roll) => !roll.isPrivate);

  return (
    <div className={styles.hudContainer} data-testid="dice-hud-container">
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.hudTitle}>🎲 Dice HUD</h2>
          <span
            className={`${styles.connectionBadge} ${
              isConnected ? styles.onlineBadge : styles.offlineBadge
            }`}
            data-testid="connection-badge"
          >
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className={styles.headerActions}>
          <select
            className={styles.themeSelect}
            value={diceTheme}
            onChange={(e) => handleThemeChange(e.target.value)}
            aria-label="Dice theme selector"
          >
            {DICE_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.iconButton}
            onClick={handleToggleSound}
            title={isSoundMuted ? 'Unmute dice sounds' : 'Mute dice sounds'}
            aria-label={isSoundMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {isSoundMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {isHost && (
            <button
              type="button"
              className={`${styles.iconButton} ${
                isPrivate ? styles.iconButtonActive : ''
              }`}
              onClick={() => setIsPrivate(!isPrivate)}
              title={isPrivate ? 'Private roll (GM only)' : 'Public roll'}
              aria-label={isPrivate ? 'Private roll' : 'Public roll'}
            >
              {isPrivate ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
          )}

          <button
            type="button"
            className={styles.switchPanelButton}
            onClick={handleSwitchClassic}
            title="Open Classic Dice Roller"
          >
            Classic View
          </button>
        </div>
      </div>

      {/* Floating 3-4s Transient Roll Toast Notification */}
      {activeToast && (
        <div
          className={`${styles.rollToast} ${
            activeToast.crit === 'success'
              ? styles.toastCritSuccess
              : activeToast.crit === 'failure'
                ? styles.toastCritFailure
                : styles.toastNormal
          }`}
          role="status"
          aria-live="polite"
          data-testid="dice-roll-toast"
        >
          <div className={styles.toastHeader}>
            <div className={styles.toastBadge}>
              {activeToast.crit === 'success' && '🌟 NATURAL 20! CRITICAL HIT'}
              {activeToast.crit === 'failure' && '💀 NATURAL 1! CRITICAL FAILURE'}
              {!activeToast.crit && (
                <>
                  {activeToast.rollType === 'advantage' && '✨ Advantage Roll'}
                  {activeToast.rollType === 'disadvantage' && '⚠️ Disadvantage Roll'}
                  {activeToast.rollType === 'normal' && '🎲 Dice Roll Result'}
                </>
              )}
            </div>
            <button
              type="button"
              className={styles.toastCloseBtn}
              onClick={() => setActiveToast(null)}
              aria-label="Dismiss roll notification"
            >
              <X size={14} />
            </button>
          </div>

          <div className={styles.toastBody}>
            <div className={styles.toastFormulaCol}>
              <span className={styles.toastExpression}>
                {activeToast.expression}
              </span>
              <span className={styles.toastBreakdown}>
                [{activeToast.results.join(', ')}]
                {activeToast.modifier
                  ? ` ${activeToast.modifier > 0 ? '+' : ''}${activeToast.modifier}`
                  : ''}
              </span>
            </div>
            <div className={styles.toastTotalCol}>
              <span className={styles.toastTotal}>{activeToast.total}</span>
            </div>
          </div>

          <div className={styles.toastProgressBar} />
        </div>
      )}

      {/* Hero Section: D20 & Advantage / Disadvantage Wings */}
      <div className={styles.heroSection}>
        <div className={styles.heroWingsRow}>
          {/* Advantage Wing */}
          <button
            type="button"
            className={`${styles.wingButton} ${
              rollMode === 'advantage' ? styles.advantageActive : ''
            }`}
            onClick={handleToggleAdvantage}
            data-testid="advantage-toggle"
            aria-pressed={rollMode === 'advantage'}
          >
            <span className={styles.wingLabel}>Advantage</span>
            <span className={styles.wingSubtext}>+Adv (Pick High)</span>
          </button>

          {/* Central Circular D20 */}
          <button
            type="button"
            className={styles.d20CenterButton}
            onClick={handleRollD20}
            data-testid="roll-d20-button"
            aria-label="Roll d20"
          >
            <div className={styles.d20IconWrapper}>
              <PolyhedralIcon type="d20" size={36} color="#ffffff" />
            </div>
            <span className={styles.d20Text}>ROLL D20</span>
          </button>

          {/* Disadvantage Wing */}
          <button
            type="button"
            className={`${styles.wingButton} ${
              rollMode === 'disadvantage' ? styles.disadvantageActive : ''
            }`}
            onClick={handleToggleDisadvantage}
            data-testid="disadvantage-toggle"
            aria-pressed={rollMode === 'disadvantage'}
          >
            <span className={styles.wingLabel}>Disadvantage</span>
            <span className={styles.wingSubtext}>-Dis (Pick Low)</span>
          </button>
        </div>

        {/* Quick Modifiers Row */}
        <div className={styles.modifiersRow}>
          <span className={styles.modLabel}>Modifier:</span>
          {[-2, -1, 0, 1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              type="button"
              className={`${styles.modChip} ${
                d20Modifier === val ? styles.modChipActive : ''
              }`}
              onClick={() => {
                setD20Modifier(val);
                setCustomMod('');
              }}
            >
              {val >= 0 ? `+${val}` : `${val}`}
            </button>
          ))}
          <input
            type="number"
            className={styles.customModInput}
            placeholder="±"
            value={customMod}
            onChange={(e) => {
              setCustomMod(e.target.value);
              const parsed = parseInt(e.target.value, 10);
              setD20Modifier(isNaN(parsed) ? 0 : parsed);
            }}
            aria-label="Custom modifier input"
          />
        </div>
      </div>

      {/* Prominent Visual Dice Bag & Polyhedral Tray */}
      <div className={styles.trayCard} data-testid="dice-bag-card">
        <div
          className={styles.trayHeader}
          onClick={() => setIsTrayExpanded(!isTrayExpanded)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setIsTrayExpanded(!isTrayExpanded);
            }
          }}
          aria-expanded={isTrayExpanded}
          aria-label="Dice Bag & Tray drawer toggle"
        >
          <div className={styles.trayTitleGroup}>
            <span className={styles.trayTitle}>
              <PolyhedralIcon type="bag" size={20} color="#fbbf24" />
              🎒 Dice Bag (Click to Draw)
            </span>
            {totalStagedCount > 0 && (
              <span className={styles.trayBadge} data-testid="staged-count-badge">
                {totalStagedCount} in pool
              </span>
            )}
          </div>
          {isTrayExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>

        {isTrayExpanded && (
          <div className={styles.trayBody}>
            {/* Visual Dice Bag Header Banner */}
            <div className={styles.bagBanner} data-testid="dice-bag-banner">
              <div className={styles.bagIllustration}>
                <PolyhedralIcon type="bag" size={38} color="#fbbf24" />
              </div>
              <div className={styles.bagBannerText}>
                <span className={styles.bagBannerTitle}>Adventurer's Dice Bag</span>
                <span className={styles.bagBannerHint}>
                  Click any polyhedral die below to draw it from your pouch into the rolling tray
                </span>
              </div>
            </div>

            {/* Polyhedral Grid with Inlined Vector Dice */}
            <div className={styles.polyGrid}>
              {DIE_DEFINITIONS.map((def) => {
                const count = stagedDice[def.type] || 0;
                return (
                  <button
                    key={def.type}
                    type="button"
                    className={styles.dieCard}
                    onClick={() => incrementDie(def.type, 1)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      incrementDie(def.type, -1);
                    }}
                    title={`Click to add ${def.label}, right click to remove`}
                    data-testid={`die-btn-${def.type}`}
                  >
                    <PolyhedralIcon type={def.type} size={28} color={def.color} />
                    <span className={styles.dieName}>{def.label}</span>
                    {count > 0 && (
                      <span className={styles.dieCountBadge}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Common Pools */}
            <div className={styles.quickPoolsRow}>
              <span className={styles.quickPoolLabel}>Quick Pools:</span>
              {QUICK_POOLS.map((pool) => (
                <button
                  key={pool.label}
                  type="button"
                  className={styles.quickPoolChip}
                  onClick={() => incrementDie(pool.die, pool.count)}
                >
                  <Plus size={10} style={{ display: 'inline', marginRight: 2 }} />
                  {pool.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Staging Pill Bar (Drawn from Bag) */}
      <div className={styles.stagingBar}>
        <div className={styles.stagingFormula} data-testid="staging-formula-display">
          {stagedFormula ? (
            <span>
              <strong>Drawn from Bag:</strong> {stagedFormula}
            </span>
          ) : (
            <span className={styles.stagingFormulaEmpty}>
              Select dice from the bag above to build pool...
            </span>
          )}
        </div>

        {totalStagedCount > 0 && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={clearStagedPool}
            title="Clear staged pool"
            aria-label="Clear staged pool"
          >
            <Trash2 size={15} />
          </button>
        )}

        <button
          type="button"
          className={styles.rollStagedButton}
          disabled={!stagedFormula}
          onClick={handleRollStaged}
          data-testid="roll-staged-button"
        >
          <Sparkles size={15} /> ROLL POOL
        </button>
      </div>

      {/* Direct Formula Input Bar */}
      <div className={styles.formulaSection}>
        <input
          type="text"
          className={styles.formulaInput}
          placeholder="Custom notation (e.g. 4d6k3 + 5, 2d8 + 3)..."
          value={formulaInput}
          onChange={(e) => setFormulaInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              executeRoll(formulaInput);
              setFormulaInput('');
            }
          }}
          aria-label="Custom dice expression"
        />
        <button
          type="button"
          className={styles.formulaRollButton}
          onClick={() => {
            executeRoll(formulaInput);
            setFormulaInput('');
          }}
        >
          Roll
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className={styles.errorMessage} role="alert">
          {error}
        </div>
      )}

      {/* Saved D&D Macros Dock with Customization Popup Trigger */}
      <div className={styles.macrosSection}>
        <div className={styles.macroHeaderRow}>
          <span className={styles.sectionHeading}>Common D&D Macros</span>
          <button
            type="button"
            className={styles.manageMacrosBtn}
            onClick={() => setIsMacroModalOpen(true)}
            title="Customize which macros appear for your character"
            aria-label="Customize macros"
          >
            <SlidersHorizontal size={13} /> Customize
          </button>
        </div>

        <div className={styles.macrosList}>
          {visibleMacros.map((macro) => (
            <button
              key={macro.id}
              type="button"
              className={styles.macroChip}
              onClick={() => executeRoll(macro.formula)}
              title={`Roll ${macro.formula}`}
            >
              {macro.label} ({macro.formula})
            </button>
          ))}

          {visibleMacros.length === 0 && (
            <button
              type="button"
              className={styles.emptyMacrosPrompt}
              onClick={() => setIsMacroModalOpen(true)}
            >
              + No active macros. Click here to choose actions for your character.
            </button>
          )}
        </div>
      </div>

      {/* Macro Customization Popup / Modal */}
      {isMacroModalOpen && (
        <div
          className={styles.macroModalOverlay}
          role="dialog"
          aria-label="Customize Macros Modal"
        >
          <div className={styles.macroModalBox}>
            <div className={styles.macroModalHeader}>
              <div>
                <h3 className={styles.macroModalTitle}>Customize Macros</h3>
                <div className={styles.macroModalSubtitle}>
                  Toggle relevant actions for your class and build
                </div>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setIsMacroModalOpen(false)}
                aria-label="Close macro modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.macroModalBody}>
              <div className={styles.macroToggleList}>
                {allMacros.map((macro) => {
                  const isChecked = enabledMacroIds.includes(macro.id);
                  return (
                    <div
                      key={macro.id}
                      className={styles.macroToggleRow}
                      onClick={() => toggleMacroEnabled(macro.id)}
                    >
                      <div className={styles.macroToggleInfo}>
                        <span className={styles.macroToggleName}>
                          {macro.label}
                        </span>
                        <span className={styles.macroToggleFormula}>
                          {macro.formula}
                        </span>
                      </div>
                      <div className={styles.macroCheckboxWrapper}>
                        <input
                          type="checkbox"
                          className={styles.macroCheckbox}
                          checked={isChecked}
                          onChange={() => {}} // handled by row click
                          aria-label={`Toggle ${macro.label}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Custom Macro Form */}
              <form onSubmit={handleAddCustomMacro} className={styles.customMacroSection}>
                <span className={styles.customMacroHeading}>Add Custom Character Macro</span>
                <div className={styles.customMacroInputsRow}>
                  <input
                    type="text"
                    className={styles.customMacroNameInput}
                    placeholder="Action name (e.g. Eldritch Smite)"
                    value={newMacroName}
                    onChange={(e) => setNewMacroName(e.target.value)}
                    aria-label="New macro action name"
                  />
                  <input
                    type="text"
                    className={styles.customMacroFormulaInput}
                    placeholder="Formula (e.g. 2d8+4)"
                    value={newMacroFormula}
                    onChange={(e) => setNewMacroFormula(e.target.value)}
                    aria-label="New macro formula"
                  />
                  <button
                    type="submit"
                    className={styles.addCustomMacroBtn}
                    disabled={!newMacroName.trim() || !newMacroFormula.trim()}
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>

            <div className={styles.macroModalFooter}>
              <button
                type="button"
                className={styles.doneModalBtn}
                onClick={() => setIsMacroModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roll History Stream */}
      <div className={styles.historySection}>
        <div className={styles.historyHeader}>
          <span className={styles.sectionHeading}>Recent Rolls</span>
          <span className={styles.quickPoolLabel}>
            {visibleRolls.length} rolls
          </span>
        </div>

        <div className={styles.historyList} ref={historyListRef}>
          {visibleRolls.slice(0, 8).map((roll, idx) => (
            <div key={idx} className={styles.historyItem}>
              <div className={styles.historyItemLeft}>
                <span className={styles.historyExpression}>
                  {roll.expression} {roll.isPrivate ? '🔒' : ''}
                </span>
                <span className={styles.historyBreakdown}>
                  [{roll.results.join(', ')}]
                  {roll.modifier
                    ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}`
                    : ''}
                </span>
              </div>

              <div className={styles.historyItemRight}>
                <span
                  className={`${styles.historyTotal} ${
                    roll.crit === 'success'
                      ? styles.critSuccess
                      : roll.crit === 'failure'
                        ? styles.critFailure
                        : ''
                  }`}
                >
                  {roll.total}
                </span>
                <button
                  type="button"
                  className={styles.historyRerollBtn}
                  onClick={() => executeRoll(roll.expression)}
                  title="Re-roll this formula"
                  aria-label={`Reroll ${roll.expression}`}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
