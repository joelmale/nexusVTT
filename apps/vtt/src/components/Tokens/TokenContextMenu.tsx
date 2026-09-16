import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore, useCamera } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { STANDARD_CONDITIONS } from '@/types/initiative';
import { sceneUtils } from '@/utils/sceneUtils';
import { Portal } from '@/components/Portal';
import styles from './TokenContextMenu.module.css';

interface TokenContextMenuProps {
  tokenId: string;
  worldX: number;
  worldY: number;
  isDragging: boolean;
  onEdit: () => void;
}

/** Gap between the token and the menu, and the viewport edge padding. */
const TOKEN_GAP = 40;
const EDGE_PADDING = 8;

type OpenSubmenu = 'none' | 'damage' | 'conditions';

export const TokenContextMenu: React.FC<TokenContextMenuProps> = ({
  tokenId,
  worldX,
  worldY,
  isDragging,
  onEdit,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [submenu, setSubmenu] = useState<OpenSubmenu>('none');
  const [damageInput, setDamageInput] = useState('');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [flipBelow, setFlipBelow] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const camera = useCamera();
  const deleteToken = useGameStore((s) => s.deleteToken);
  const activeSceneId = useGameStore((s) => s.sceneState.activeSceneId);
  const updateToken = useGameStore((s) => s.updateToken);
  const token = useGameStore((s) =>
    activeSceneId
      ? s.sceneState.scenes
          .find((sc) => sc.id === activeSceneId)
          ?.placedTokens.find((t) => t.id === tokenId)
      : undefined,
  );
  const isHost = useGameStore((s) => s.user.type === 'host');

  // Damage/conditions delegate to the initiative entry, which is the only
  // model in the app with real 5e HP maths (max/current/temp, death saves,
  // combat log, HP sync). PlacedToken has a single `currentStats.hp` and no
  // maxHp or tempHP, so applying damage at the token level cannot be correct.
  const entry = useInitiativeStore((s) =>
    s.entries.find((e) => e.tokenId === tokenId),
  );
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
    if (activeSceneId) deleteToken(activeSceneId, tokenId);
  }, [activeSceneId, deleteToken, tokenId]);

  const handleToggleVisibility = useCallback(() => {
    if (!isHost || !activeSceneId || !token) return;
    updateToken(activeSceneId, tokenId, {
      visibleToPlayers: !token.visibleToPlayers,
    });
  }, [isHost, activeSceneId, token, updateToken, tokenId]);

  const handleToggleInitiative = useCallback(() => {
    if (!activeSceneId || !token) return;
    updateToken(activeSceneId, tokenId, {
      isInInitiative: !token.isInInitiative,
    });
  }, [activeSceneId, token, updateToken, tokenId]);

  const handleRotate = useCallback(() => {
    if (!activeSceneId || !token) return;
    updateToken(activeSceneId, tokenId, {
      rotation: (token.rotation + 45) % 360,
    });
  }, [activeSceneId, token, updateToken, tokenId]);

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

  if (!isVisible || isDragging || !token || !activeSceneId || !camera) {
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
