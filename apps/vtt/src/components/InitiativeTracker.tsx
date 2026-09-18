import React, { useState, useRef, useCallback } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { DragSourceMonitor, DropTargetMonitor } from 'react-dnd';
import type { Identifier, XYCoord } from 'dnd-core';
import {
  useInitiativeStore,
  useInitiative,
  useInitiativeActions,
} from '@/stores/initiativeStore';
import { STANDARD_CONDITIONS } from '@/types/initiative';
import type { InitiativeEntry, Condition } from '@/types/initiative';
import styles from './InitiativeTracker.module.css';

interface DragItem {
  index: number;
  id: string;
  type: string;
}

interface InitiativeCardProps {
  entry: InitiativeEntry;
  index: number;
  isActive: boolean;
  onUpdate: (updates: Partial<InitiativeEntry>) => void;
  onRemove: () => void;
  onApplyDamage: (damage: number) => void;
  onApplyHealing: (healing: number) => void;
  onAddCondition: (condition: Condition) => void;
  onRemoveCondition: (conditionId: string) => void;
  onMoveCard: (dragIndex: number, hoverIndex: number) => void;
  showHP: boolean;
}

const InitiativeCard: React.FC<InitiativeCardProps> = ({
  entry,
  index,
  isActive,
  onUpdate,
  onRemove,
  onApplyDamage,
  onApplyHealing,
  onAddCondition,
  onRemoveCondition,
  onMoveCard,
  showHP,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [damageInput, setDamageInput] = useState('');
  const [healingInput, setHealingInput] = useState('');
  const [showConditions, setShowConditions] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const [{ handlerId }, drop] = useDrop<
    DragItem,
    void,
    { handlerId: Identifier | null }
  >({
    accept: 'INITIATIVE_CARD',
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem, monitor: DropTargetMonitor<DragItem, void>) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset() as XYCoord | null;
      if (!clientOffset) {
        return;
      }
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      onMoveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag<
    DragItem,
    void,
    { isDragging: boolean }
  >({
    type: 'INITIATIVE_CARD',
    item: () => {
      return { id: entry.id, index, type: 'INITIATIVE_CARD' };
    },
    collect: (monitor: DragSourceMonitor<DragItem, void>) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const attachDragDropRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      if (node) {
        drag(drop(node));
      }
    },
    [drag, drop],
  );

  const handleDamage = () => {
    const damage = parseInt(damageInput, 10);
    if (!isNaN(damage) && damage > 0) {
      onApplyDamage(damage);
      setDamageInput('');
    }
  };

  const handleHealing = () => {
    const healing = parseInt(healingInput, 10);
    if (!isNaN(healing) && healing > 0) {
      onApplyHealing(healing);
      setHealingInput('');
    }
  };

  const isDead = entry.currentHP === 0;
  const hpPercentage = (entry.currentHP / entry.maxHP) * 100;

  // Get HP bar color
  const getHPColor = () => {
    if (hpPercentage > 75) return '#10b981';
    if (hpPercentage > 50) return '#84cc16';
    if (hpPercentage > 25) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div
      ref={attachDragDropRef}
      data-handler-id={handlerId}
      className={[
        styles.initiativeCard,
        isActive && styles.active,
        isDead && styles.dead,
        styles[entry.type],
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Card Header */}
      <div className={styles.initiativeCardHeader}>
        {/* Drag Handle */}
        <div className={styles.initiativeDragHandle} title="Drag to reorder">
          ⋮⋮
        </div>

        {/* Initiative Number */}
        <div className={styles.initiativeNumber}>
          <input
            type="number"
            value={entry.initiative}
            onChange={(e) =>
              onUpdate({ initiative: parseInt(e.target.value, 10) || 0 })
            }
            className="initiative-number-input"
            min="0"
            max="99"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Name and Type */}
        <div className={styles.initiativeCardInfo}>
          <div className={styles.initiativeNameRow}>
            <input
              type="text"
              value={entry.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="initiative-name-input"
              placeholder="Character name"
              onClick={(e) => e.stopPropagation()}
            />
            <span
              className={`${styles.initiativeTypeBadge} ${styles[entry.type]}`}
            >
              {entry.type === 'player' && '👤'}
              {entry.type === 'npc' && '🤝'}
              {entry.type === 'monster' && '👹'}
            </span>
          </div>

          {/* Stats Row */}
          <div className={styles.initiativeStatsRow}>
            <div className={styles.initiativeAc}>
              <span className={styles.statLabel}>AC</span>
              <input
                type="number"
                value={entry.armorClass}
                onChange={(e) =>
                  onUpdate({ armorClass: parseInt(e.target.value, 10) || 10 })
                }
                className={styles.statInput}
                min="0"
                max="30"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {showHP && (
              <div className={styles.initiativeHpCompact}>
                <span className={styles.statLabel}>HP</span>
                <div className={styles.hpValueGroup}>
                  <input
                    type="number"
                    value={entry.currentHP}
                    onChange={(e) =>
                      onUpdate({
                        currentHP: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className={styles.statInput}
                    min="0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className={styles.hpSeparator}>/</span>
                  <input
                    type="number"
                    value={entry.maxHP}
                    onChange={(e) =>
                      onUpdate({
                        maxHP: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    className={styles.statInput}
                    min="1"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            {entry.conditions.length > 0 && (
              <div className={styles.initiativeConditionBadge}>
                🩹 {entry.conditions.length}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.initiativeCardActions}>
          <button
            onClick={() => setShowActions(!showActions)}
            className={styles.initiativeActionBtn}
            title="Quick Actions"
          >
            {showActions ? '▲' : '▼'}
          </button>
          <button
            onClick={onRemove}
            className={styles.initiativeRemoveBtn}
            title="Remove"
          >
            ✕
          </button>
        </div>
      </div>

      {/* HP Bar */}
      {showHP && (
        <div className={styles.initiativeHpBar}>
          <div
            className={styles.initiativeHpFill}
            style={{
              width: `${Math.min(100, hpPercentage)}%`,
              backgroundColor: getHPColor(),
            }}
          />
        </div>
      )}

      {/* Active Turn Indicator */}
      {isActive && (
        <div className={styles.initiativeActiveIndicator}>
          ⏰ ACTIVE TURN
        </div>
      )}

      {/* Expanded Actions */}
      {showActions && showHP && (
        <div className={styles.initiativeExpandedActions}>
          {/* HP Modification */}
          <div className={styles.initiativeHpModification}>
            <div className={styles.hpModGroup}>
              <input
                type="number"
                value={damageInput}
                onChange={(e) => setDamageInput(e.target.value)}
                placeholder="0"
                className={styles.hpModInput}
                min="0"
              />
              <button
                onClick={handleDamage}
                className={`${styles.hpModBtn} ${styles.damage}`}
              >
                ⚔️ Damage
              </button>
            </div>

            <div className={styles.hpModGroup}>
              <input
                type="number"
                value={healingInput}
                onChange={(e) => setHealingInput(e.target.value)}
                placeholder="0"
                className={styles.hpModInput}
                min="0"
              />
              <button
                onClick={handleHealing}
                className={`${styles.hpModBtn} ${styles.heal}`}
              >
                ❤️ Heal
              </button>
            </div>
          </div>

          {/* Conditions */}
          <div className={styles.initiativeConditionsSection}>
            <button
              onClick={() => setShowConditions(!showConditions)}
              className={styles.toggleConditionsBtn}
            >
              🩹 Conditions {entry.conditions.length > 0 && `(${entry.conditions.length})`}
            </button>

            {showConditions && (
              <div className={styles.conditionsList}>
                {entry.conditions.map((condition) => (
                  <div key={condition.id} className={styles.conditionTag}>
                    <span className={styles.conditionIcon}>{condition.icon}</span>
                    <span className={styles.conditionName}>{condition.name}</span>
                    {condition.duration && (
                      <span className={styles.conditionDuration}>{condition.duration}r</span>
                    )}
                    <button
                      onClick={() => onRemoveCondition(condition.id)}
                      className={styles.removeConditionBtn}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <select
                  onChange={(e) => {
                    const condition = STANDARD_CONDITIONS.find(
                      (c) => c.id === e.target.value,
                    );
                    if (condition) {
                      onAddCondition(condition);
                      e.target.value = '';
                    }
                  }}
                  className={styles.addConditionSelect}
                >
                  <option value="">+ Add condition...</option>
                  {STANDARD_CONDITIONS.map((condition) => (
                    <option key={condition.id} value={condition.id}>
                      {condition.icon} {condition.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Death Saves (if dead) */}
          {isDead && (
            <div className={styles.deathSavesSection}>
              <div className={styles.deathSavesGrid}>
                <div className={styles.deathSaveTrack}>
                  <span className={styles.deathSaveLabel}>Successes</span>
                  <div className={styles.deathSaveDots}>
                    {[1, 2, 3].map((i) => (
                      <button
                        key={i}
                        className={[
                          styles.deathDot,
                          styles.success,
                          i <= entry.deathSaves.successes && styles.filled,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() =>
                          onUpdate({
                            deathSaves: {
                              ...entry.deathSaves,
                              successes: i <= entry.deathSaves.successes ? i - 1 : i,
                            },
                          })
                        }
                      >
                        ●
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.deathSaveTrack}>
                  <span className={styles.deathSaveLabel}>Failures</span>
                  <div className={styles.deathSaveDots}>
                    {[1, 2, 3].map((i) => (
                      <button
                        key={i}
                        className={[
                          styles.deathDot,
                          styles.failure,
                          i <= entry.deathSaves.failures && styles.filled,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() =>
                          onUpdate({
                            deathSaves: {
                              ...entry.deathSaves,
                              failures: i <= entry.deathSaves.failures ? i - 1 : i,
                            },
                          })
                        }
                      >
                        ●
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const InitiativeTracker: React.FC = () => {
  const { isActive, isPaused, round, entries, activeEntry } = useInitiative();
  const {
    startCombat,
    endCombat,
    nextTurn,
    previousTurn,
    addEntry,
    removeEntry,
    updateEntry,
    applyDamage,
    applyHealing,
    addCondition,
    removeCondition,
    rollInitiativeForAll,
    reorderEntries,
  } = useInitiativeActions();

  const { showPlayerHP, sortByInitiative, updateSettings } =
    useInitiativeStore();

  const [newEntryName, setNewEntryName] = useState('');
  const [newEntryType, setNewEntryType] = useState<
    'player' | 'npc' | 'monster'
  >('monster');
  const [newEntryInitiative, setNewEntryInitiative] = useState(10);

  const handleAddEntry = () => {
    if (newEntryName.trim()) {
      addEntry({
        name: newEntryName.trim(),
        type: newEntryType,
        initiative: newEntryInitiative,
        maxHP: 10,
        currentHP: 10,
        tempHP: 0,
        armorClass: 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: 0,
        dexterityModifier: 0,
      });
      setNewEntryName('');
      setNewEntryInitiative(10);
    }
  };

  const moveCard = (dragIndex: number, hoverIndex: number) => {
    reorderEntries(dragIndex, hoverIndex);
  };

  return (
    <div className={styles.initiativeTrackerRedesign}>
      {/* Header */}
      <div className={styles.initiativeHeaderNew}>
        <div className={styles.initiativeTitleSection}>
          <h2>⚔️ Initiative</h2>
          {isActive && <span className={styles.roundBadge}>Round {round}</span>}
        </div>

        {/* Combat Controls */}
        {!isActive ? (
          <button
            onClick={startCombat}
            className={styles.btnStartCombat}
            disabled={entries.length === 0}
          >
            ▶️ Start Combat
          </button>
        ) : (
          <div className={styles.combatControlsNew}>
            <button onClick={previousTurn} className={styles.btnTurn} title="Previous Turn">
              ⬅️
            </button>
            <button
              onClick={
                isPaused
                  ? () => useInitiativeStore.getState().resumeCombat()
                  : () => useInitiativeStore.getState().pauseCombat()
              }
              className={styles.btnTurn}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? '▶️' : '⏸️'}
            </button>
            <button onClick={nextTurn} className={styles.btnTurn} title="Next Turn">
              ➡️
            </button>
            <button onClick={endCombat} className={styles.btnEndCombat}>
              🏁 End
            </button>
          </div>
        )}
      </div>

      {/* Active Turn Banner */}
      {activeEntry && isActive && (
        <div className={styles.activeTurnBanner}>
          <div className={styles.activeTurnContent}>
            <span className={styles.activeTurnIcon}>⏰</span>
            <div className={styles.activeTurnInfo}>
              <div className={styles.activeTurnName}>{activeEntry.name}</div>
              <div className={styles.activeTurnSubtitle}>It's their turn!</div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Bar */}
      <div className={styles.initiativeSettingsBar}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showPlayerHP}
            onChange={(e) => updateSettings({ showPlayerHP: e.target.checked })}
          />
          <span>Show HP</span>
        </label>

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={sortByInitiative}
            onChange={(e) =>
              updateSettings({ sortByInitiative: e.target.checked })
            }
          />
          <span>Auto-Sort</span>
        </label>

        <button
          onClick={rollInitiativeForAll}
          className={styles.btnRollAll}
          disabled={entries.length === 0}
        >
          🎲 Roll All
        </button>
      </div>

      {/* Add Entry Form */}
      <div className={styles.addEntryCard}>
        <div className={styles.addEntryTitle}>➕ Add Combatant</div>
        <div className={styles.addEntryForm}>
          <input
            type="text"
            value={newEntryName}
            onChange={(e) => setNewEntryName(e.target.value)}
            placeholder="Name"
            className={styles.addEntryName}
            onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
          />

          <select
            value={newEntryType}
            onChange={(e) =>
              setNewEntryType(e.target.value as 'player' | 'npc' | 'monster')
            }
            className={styles.addEntryType}
          >
            <option value="player">👤 Player</option>
            <option value="npc">🤝 NPC</option>
            <option value="monster">👹 Monster</option>
          </select>

          <input
            type="number"
            value={newEntryInitiative}
            onChange={(e) =>
              setNewEntryInitiative(parseInt(e.target.value, 10) || 0)
            }
            className={styles.addEntryInit}
            placeholder="Init"
            min="0"
            max="99"
          />

          <button onClick={handleAddEntry} className={styles.btnAddEntry}>
            Add
          </button>
        </div>
      </div>

      {/* Initiative Cards List */}
      <div className={styles.initiativeCardsList}>
        {entries.length === 0 ? (
          <div className={styles.emptyStateNew}>
            <div className={styles.emptyIcon}>⚔️</div>
            <div className={styles.emptyText}>No combatants yet</div>
            <div className={styles.emptyHint}>Add players, NPCs, or monsters above</div>
          </div>
        ) : (
          entries.map((entry, index) => (
            <InitiativeCard
              key={entry.id}
              entry={entry}
              index={index}
              isActive={entry.isActive}
              onUpdate={(updates) => updateEntry(entry.id, updates)}
              onRemove={() => removeEntry(entry.id)}
              onApplyDamage={(damage) => applyDamage(entry.id, damage)}
              onApplyHealing={(healing) => applyHealing(entry.id, healing)}
              onAddCondition={(condition) => addCondition(entry.id, condition)}
              onRemoveCondition={(conditionId) =>
                removeCondition(entry.id, conditionId)
              }
              onMoveCard={moveCard}
              showHP={showPlayerHP}
            />
          ))
        )}
      </div>
    </div>
  );
};
