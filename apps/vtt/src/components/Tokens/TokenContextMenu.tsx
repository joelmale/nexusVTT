import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGameStore, useCamera } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { STANDARD_CONDITIONS, createInitiativeEntry } from '@/types/initiative';
import { createPlacedToken } from '@/types/token';
import { webSocketService } from '@/services/websocket';
import { sceneUtils } from '@/utils/sceneUtils';
import { Portal } from '@/components/Portal';
import styles from './TokenContextMenu.module.css';

interface TokenContextMenuProps {
  tokenId: string;
  worldX: number;
  worldY: number;
  isDragging: boolean;
  onEdit: () => void;
  sceneId?: string;
}

/** Gap between the token and the menu, and the viewport edge padding. */
const TOKEN_GAP = 40;
const EDGE_PADDING = 8;

type OpenSubmenu = 'none' | 'damage' | 'conditions' | 'elevation';

export const TokenContextMenu: React.FC<TokenContextMenuProps> = ({
  tokenId,
  worldX,
  worldY,
  isDragging,
  onEdit,
  sceneId,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [submenu, setSubmenu] = useState<OpenSubmenu>('none');
  const [damageInput, setDamageInput] = useState('');
  const [elevationInput, setElevationInput] = useState('');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [flipBelow, setFlipBelow] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const camera = useCamera();
  const deleteToken = useGameStore((s) => s.deleteToken);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const placeToken = useGameStore((s) => s.placeToken);
  const setSelection = useGameStore((s) => s.setSelection);
  const user = useGameStore((s) => s.user);
  const activeSceneIdStore = useGameStore((s) => s.sceneState.activeSceneId);
  const effectiveSceneId = sceneId || activeSceneIdStore;
  const updateToken = useGameStore((s) => s.updateToken);
  const token = useGameStore((s) =>
    effectiveSceneId
      ? s.sceneState.scenes
          .find((sc) => sc.id === effectiveSceneId)
          ?.placedTokens.find((t) => t.id === tokenId)
      : undefined,
  );
  const isHost = useGameStore((s) => s.user.type === 'host');
  const selectedObjectIds = useGameStore((s) => s.sceneState.selectedObjectIds);
  const currentScene = useGameStore((s) =>
    effectiveSceneId
      ? s.sceneState.scenes.find((sc) => sc.id === effectiveSceneId)
      : undefined,
  );
  const selectedTokens = useMemo(
    () =>
      currentScene
        ? currentScene.placedTokens.filter((t) => selectedObjectIds.includes(t.id))
        : [],
    [currentScene, selectedObjectIds],
  );
  const isMultiTokenSelected = selectedTokens.length > 1;

  // Damage/conditions delegate to the initiative entry, which is the only
  // model in the app with real 5e HP maths (max/current/temp, death saves,
  // combat log, HP sync). PlacedToken has a single `currentStats.hp` and no
  // maxHp or tempHP, so applying damage at the token level cannot be correct.
  const entry = useInitiativeStore((s) =>
    s.entries.find((e) => e.tokenId === tokenId),
  );
  const addEntry = useInitiativeStore((s) => s.addEntry);
  const removeEntry = useInitiativeStore((s) => s.removeEntry);
  const applyDamage = useInitiativeStore((s) => s.applyDamage);
  const applyHealing = useInitiativeStore((s) => s.applyHealing);
  const addCondition = useInitiativeStore((s) => s.addCondition);
  const removeCondition = useInitiativeStore((s) => s.removeCondition);

  if (isDragging && isVisible) {
    setIsVisible(false);
  }

  // Debounce appearance to avoid flicker during drag-select
  useEffect(() => {
    if (isDragging) return;

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 120);

    return () => clearTimeout(timer);
  }, [isDragging]);

  // Close submenus when the selection moves to a different token.
  const lastTokenIdRef = useRef(tokenId);
  useEffect(() => {
    if (lastTokenIdRef.current === tokenId) return;
    lastTokenIdRef.current = tokenId;
    setSubmenu('none');
    setDamageInput('');
  }, [tokenId]);

  // Dismiss an open submenu on Escape without closing the whole menu.
  useEffect(() => {
    if (submenu === 'none') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setSubmenu('none');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [submenu]);

  const handleDelete = useCallback(() => {
    if (effectiveSceneId) {
      deleteToken(effectiveSceneId, tokenId);
      clearSelection();
    }
  }, [effectiveSceneId, deleteToken, tokenId, clearSelection]);

  const handleToggleVisibility = useCallback(() => {
    if (!isHost || !effectiveSceneId || !token) return;
    updateToken(effectiveSceneId, tokenId, {
      visibleToPlayers: !token.visibleToPlayers,
    });
  }, [isHost, effectiveSceneId, token, updateToken, tokenId]);

  const handleToggleLock = useCallback(() => {
    if (!effectiveSceneId || !token) return;
    updateToken(effectiveSceneId, tokenId, {
      locked: !token.locked,
    });
  }, [effectiveSceneId, token, updateToken, tokenId]);

  const handleToggleDead = useCallback(() => {
    if (!effectiveSceneId || !token) return;
    updateToken(effectiveSceneId, tokenId, {
      isDead: !token.isDead,
    });
  }, [effectiveSceneId, token, updateToken, tokenId]);

  const handleToggleInitiative = useCallback(() => {
    if (!effectiveSceneId || !token) return;
    const nextState = !token.isInInitiative;
    updateToken(effectiveSceneId, tokenId, {
      isInInitiative: nextState,
    });

    if (nextState) {
      const existing = useInitiativeStore
        .getState()
        .entries.find((e) => e.tokenId === tokenId);
      if (!existing) {
        const fullEntry = createInitiativeEntry(
          token.nameOverride || 'Creature',
          'monster',
          0,
          {
            tokenId: token.id,
            characterId: token.characterId,
            maxHP:
              (token.currentStats?.maxHp as number) ||
              (token.currentStats?.hp as number) ||
              10,
            currentHP: (token.currentStats?.hp as number) || 10,
            armorClass: (token.currentStats?.ac as number) || 10,
          },
        );
        const entryPayload = { ...fullEntry };
        delete (entryPayload as { id?: string }).id;
        addEntry(entryPayload);
      }
    } else {
      const existing = useInitiativeStore
        .getState()
        .entries.find((e) => e.tokenId === tokenId);
      if (existing) {
        removeEntry(existing.id);
      }
    }
  }, [effectiveSceneId, token, updateToken, tokenId, addEntry, removeEntry]);

  const handleRollInitiative = useCallback(() => {
    if (!effectiveSceneId) return;
    const targets = isMultiTokenSelected ? selectedTokens : token ? [token] : [];
    if (targets.length === 0) return;

    targets.forEach((targetToken) => {
      if (!targetToken.isInInitiative) {
        updateToken(effectiveSceneId, targetToken.id, {
          isInInitiative: true,
        });
      }

      const stats = targetToken.currentStats;
      const dexMod =
        typeof stats?.dexMod === 'number'
          ? (stats.dexMod as number)
          : typeof stats?.dexterityModifier === 'number'
          ? (stats.dexterityModifier as number)
          : typeof stats?.dex === 'number'
          ? Math.floor(((stats.dex as number) - 10) / 2)
          : 0;

      const existing = useInitiativeStore
        .getState()
        .entries.find((e) => e.tokenId === targetToken.id);

      if (!existing) {
        const fullEntry = createInitiativeEntry(
          targetToken.nameOverride || 'Creature',
          'monster',
          0,
          {
            tokenId: targetToken.id,
            characterId: targetToken.characterId,
            initiativeModifier: dexMod,
            dexterityModifier: dexMod,
            maxHP:
              (targetToken.currentStats?.maxHp as number) ||
              (targetToken.currentStats?.hp as number) ||
              10,
            currentHP: (targetToken.currentStats?.hp as number) || 10,
            armorClass: (targetToken.currentStats?.ac as number) || 10,
          },
        );
        const entryPayload = { ...fullEntry };
        delete (entryPayload as { id?: string }).id;
        const newId = addEntry(entryPayload);
        useInitiativeStore.getState().rollInitiativeForEntry(newId);
      } else {
        if (existing.initiativeModifier !== dexMod) {
          useInitiativeStore
            .getState()
            .updateEntry(existing.id, { initiativeModifier: dexMod });
        }
        useInitiativeStore.getState().rollInitiativeForEntry(existing.id);
      }
    });
  }, [
    effectiveSceneId,
    isMultiTokenSelected,
    selectedTokens,
    token,
    updateToken,
    addEntry,
  ]);

  const handleDuplicate = useCallback(() => {
    if (!effectiveSceneId || !token) return;
    const currentName = token.nameOverride || 'Creature';
    const match = currentName.match(/^(.*?)(?: (\d+))?$/);
    const baseName = match ? match[1] : currentName;
    const currentNum = match && match[2] ? parseInt(match[2], 10) : 1;
    const newName = `${baseName} ${currentNum + 1}`;

    const duplicated = createPlacedToken(
      {
        id: token.tokenId,
        name: newName,
        image: '',
        size: token.sizeOverride || 'medium',
        category: 'monster',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      { x: token.x + 24, y: token.y + 24 },
      effectiveSceneId,
      token.roomCode,
      user.id,
      {
        nameOverride: newName,
        sizeOverride: token.sizeOverride,
        visibleToPlayers: token.visibleToPlayers,
        dmNotesOnly: token.dmNotesOnly,
        rotation: token.rotation,
        scale: token.scale,
        layer: token.layer,
        currentStats: token.currentStats ? { ...token.currentStats } : undefined,
        conditions: [...token.conditions],
      },
    );

    placeToken(effectiveSceneId, duplicated);
    setSelection([duplicated.id]);

    try {
      webSocketService.sendEvent({
        type: 'token/place',
        data: {
          sceneId: effectiveSceneId,
          token: duplicated,
        },
      });
    } catch {
      // Ignore if offline/unconfigured
    }
  }, [effectiveSceneId, token, user.id, placeToken, setSelection]);

  const handleSetElevation = useCallback(
    (elevation: number) => {
      if (!effectiveSceneId || !token) return;
      updateToken(effectiveSceneId, tokenId, { elevation });
      setSubmenu('none');
    },
    [effectiveSceneId, token, updateToken, tokenId],
  );

  const handleRotate = useCallback(() => {
    if (!effectiveSceneId || !token) return;
    updateToken(effectiveSceneId, tokenId, {
      rotation: (token.rotation + 45) % 360,
    });
  }, [effectiveSceneId, token, updateToken, tokenId]);

  const submitHP = useCallback(
    (mode: 'damage' | 'heal') => {
      if (!entry) return;
      const amount = Math.abs(parseInt(damageInput, 10));
      if (!Number.isFinite(amount) || amount <= 0) return;

      if (mode === 'damage') applyDamage(entry.id, amount);
      else applyHealing(entry.id, amount);

      setDamageInput('');
      setSubmenu('none');
    },
    [entry, damageInput, applyDamage, applyHealing],
  );

  // Flip below the token when the menu would clip the top of the viewport.
  // The old hard-coded `-40` offset assumed a single row and had no collision
  // handling at all, so a submenu near the top of the screen was unreachable.
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const wouldClipTop = rect.top < EDGE_PADDING;
    if (wouldClipTop !== flipBelow) setFlipBelow(wouldClipTop);

    // Measured here rather than read from the ref during render, so the
    // horizontal clamp below has a width without touching a ref mid-render.
    if (rect.width !== measuredWidth) setMeasuredWidth(rect.width);
  }, [submenu, flipBelow, measuredWidth, isVisible]);

  if (!isVisible || isDragging || !token || !effectiveSceneId || !camera) {
    return null;
  }

  const canvasRoot = document.querySelector('[data-role="scene-canvas-root"]');
  if (!canvasRoot) return null;
  const rect = canvasRoot.getBoundingClientRect();
  const screenPos = sceneUtils.worldToScreen(
    worldX,
    worldY,
    camera,
    rect.width,
    rect.height,
  );

  const menuTop =
    rect.top + screenPos.y + (flipBelow ? TOKEN_GAP : -TOKEN_GAP);
  // Keep the menu inside the viewport horizontally. translateX(-50%) in CSS
  // centres it on the token, so clamp against half its own width.
  const halfWidth = measuredWidth / 2;
  const menuLeft = Math.min(
    Math.max(rect.left + screenPos.x, halfWidth + EDGE_PADDING),
    window.innerWidth - halfWidth - EDGE_PADDING,
  );

  // Match applied conditions by NAME, not id: initiativeStore.addCondition
  // replaces the condition's id with a fresh crypto.randomUUID() when it
  // stores it, so the STANDARD_CONDITIONS id never appears on the entry.
  // Removal likewise has to pass the *stored* instance id.
  const appliedByName = new Map(
    (entry?.conditions ?? []).map((c) => [c.name, c] as const),
  );

  return (
    <Portal>
      <div
        ref={wrapperRef}
        className={styles.contextMenuWrapper}
        data-flipped={flipBelow || undefined}
        style={{ top: menuTop, left: menuLeft }}
        onPointerDown={(e) => e.stopPropagation()} // Prevent deselection
      >
        <div className={styles.actionRow}>
          {isHost && (
            <button
              className={`${styles.actionBtn} ${!token.visibleToPlayers ? styles.active : ''}`}
              onClick={handleToggleVisibility}
              title={
                token.visibleToPlayers ? 'Hide from players' : 'Show to players'
              }
            >
              {token.visibleToPlayers ? '👁️' : '🔒'}
            </button>
          )}

          <button
            className={`${styles.actionBtn} ${token.locked ? styles.active : ''}`}
            onClick={handleToggleLock}
            title={token.locked ? 'Unlock position' : 'Lock position'}
          >
            {token.locked ? '🔒' : '🔓'}
          </button>

          <button
            className={`${styles.actionBtn} ${token.isInInitiative ? styles.active : ''}`}
            onClick={handleToggleInitiative}
            title={
              token.isInInitiative
                ? 'Remove from initiative'
                : 'Add to initiative'
            }
          >
            ⚔️
          </button>

          <button
            className={styles.actionBtn}
            onClick={handleRollInitiative}
            title={
              isMultiTokenSelected
                ? `Roll initiative for all ${selectedTokens.length} selected creatures (1d20 + Dex)`
                : 'Roll initiative (1d20 + Dex)'
            }
          >
            {isMultiTokenSelected ? `🎲×${selectedTokens.length}` : '🎲'}
          </button>

          <button
            className={`${styles.actionBtn} ${token.isDead ? styles.active : ''}`}
            onClick={handleToggleDead}
            title={
              token.isDead ? 'Revive token (mark alive)' : 'Mark dead / defeated'
            }
          >
            💀
          </button>

          <button
            className={styles.actionBtn}
            onClick={handleDuplicate}
            title="Duplicate token"
          >
            📋
          </button>

          <button
            className={`${styles.actionBtn} ${submenu === 'elevation' ? styles.active : ''}`}
            onClick={() =>
              setSubmenu((s) => (s === 'elevation' ? 'none' : 'elevation'))
            }
            aria-expanded={submenu === 'elevation'}
            title={`Elevation (${token.elevation || 0} ft)`}
          >
            🕊️
          </button>

          <button
            className={styles.actionBtn}
            onClick={handleRotate}
            title="Rotate"
          >
            ↻
          </button>

          <div className={styles.divider} />

          {/* Damage/heal and conditions need an initiative entry to act on -
              that is where HP and conditions actually live. */}
          <button
            className={`${styles.actionBtn} ${submenu === 'damage' ? styles.active : ''}`}
            onClick={() =>
              setSubmenu((s) => (s === 'damage' ? 'none' : 'damage'))
            }
            disabled={!entry}
            aria-expanded={submenu === 'damage'}
            title={
              entry
                ? 'Damage / heal'
                : 'Add this token to initiative to track HP'
            }
          >
            💥
          </button>

          <button
            className={`${styles.actionBtn} ${submenu === 'conditions' ? styles.active : ''}`}
            onClick={() =>
              setSubmenu((s) => (s === 'conditions' ? 'none' : 'conditions'))
            }
            disabled={!entry}
            aria-expanded={submenu === 'conditions'}
            title={
              entry
                ? 'Conditions'
                : 'Add this token to initiative to track conditions'
            }
          >
            🌀
          </button>

          <div className={styles.divider} />

          <button
            className={styles.actionBtn}
            onClick={onEdit}
            title="Edit Details..."
          >
            ⚙️
          </button>

          <div className={styles.divider} />

          <button
            className={`${styles.actionBtn} ${styles.danger}`}
            onClick={handleDelete}
            title="Delete"
          >
            🗑️
          </button>
        </div>

        {submenu === 'elevation' && (
          <div className={styles.submenu}>
            <div className={styles.hpReadout}>
              Current:{' '}
              {token.elevation
                ? `${token.elevation > 0 ? `+${token.elevation}` : token.elevation} ft`
                : 'Ground (0 ft)'}
            </div>
            <div className={styles.submenuRow}>
              <button
                className={styles.submenuBtn}
                onClick={() => handleSetElevation(0)}
              >
                0 ft
              </button>
              <button
                className={styles.submenuBtn}
                onClick={() => handleSetElevation(10)}
              >
                +10 ft
              </button>
              <button
                className={styles.submenuBtn}
                onClick={() => handleSetElevation(30)}
              >
                +30 ft
              </button>
              <button
                className={styles.submenuBtn}
                onClick={() => handleSetElevation(60)}
              >
                +60 ft
              </button>
            </div>
            <div className={styles.submenuRow}>
              <input
                className={styles.amountInput}
                type="number"
                placeholder="ft"
                value={elevationInput}
                onChange={(e) => setElevationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt(elevationInput, 10);
                    if (Number.isFinite(val)) handleSetElevation(val);
                  }
                }}
              />
              <button
                className={styles.submenuBtn}
                onClick={() => {
                  const val = parseInt(elevationInput, 10);
                  if (Number.isFinite(val)) handleSetElevation(val);
                }}
              >
                Set
              </button>
            </div>
          </div>
        )}

        {submenu === 'damage' && entry && (
          <div className={styles.submenu}>
            <div className={styles.hpReadout}>
              {entry.currentHP}
              {entry.tempHP > 0 ? ` (+${entry.tempHP})` : ''} / {entry.maxHP}
            </div>
            <div className={styles.submenuRow}>
              <input
                className={styles.amountInput}
                type="number"
                min="1"
                inputMode="numeric"
                autoFocus
                value={damageInput}
                aria-label="Amount"
                placeholder="0"
                onChange={(e) => setDamageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitHP(e.shiftKey ? 'heal' : 'damage');
                  }
                }}
              />
              <button
                className={`${styles.submenuBtn} ${styles.danger}`}
                onClick={() => submitHP('damage')}
                disabled={!damageInput.trim()}
              >
                Damage
              </button>
              <button
                className={styles.submenuBtn}
                onClick={() => submitHP('heal')}
                disabled={!damageInput.trim()}
              >
                Heal
              </button>
            </div>
          </div>
        )}

        {submenu === 'conditions' && entry && (
          <div className={styles.submenu}>
            <div className={styles.conditionGrid}>
              {STANDARD_CONDITIONS.map((condition) => {
                const applied = appliedByName.get(condition.name);
                const isOn = Boolean(applied);
                return (
                  <button
                    key={condition.id}
                    className={`${styles.conditionBtn} ${isOn ? styles.active : ''}`}
                    aria-pressed={isOn}
                    title={`${condition.name}${condition.description ? ` — ${condition.description}` : ''}`}
                    onClick={() =>
                      applied
                        ? removeCondition(entry.id, applied.id)
                        : addCondition(entry.id, condition)
                    }
                  >
                    <span aria-hidden="true">{condition.icon}</span>
                    <span className={styles.conditionLabel}>
                      {condition.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Portal>
  );
};
