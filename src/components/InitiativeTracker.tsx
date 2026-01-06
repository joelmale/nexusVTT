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
      className={`initiative-card ${isActive ? 'active' : ''} ${isDead ? 'dead' : ''} ${entry.type}`}
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Card Header */}
      <div className="initiative-card-header">
        {/* Drag Handle */}
        <div className="initiative-drag-handle" title="Drag to reorder">
          ⋮⋮
        </div>

        {/* Initiative Number */}
        <div className="initiative-number">
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
        <div className="initiative-card-info">
          <div className="initiative-name-row">
            <input
              type="text"
              value={entry.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="initiative-name-input"
              placeholder="Character name"
              onClick={(e) => e.stopPropagation()}
            />
            <span className={`initiative-type-badge ${entry.type}`}>
              {entry.type === 'player' && '👤'}
              {entry.type === 'npc' && '🤝'}
              {entry.type === 'monster' && '👹'}
            </span>
          </div>

          {/* Stats Row */}
          <div className="initiative-stats-row">
            <div className="initiative-ac">
              <span className="stat-label">AC</span>
              <input
                type="number"
                value={entry.armorClass}
                onChange={(e) =>
                  onUpdate({ armorClass: parseInt(e.target.value, 10) || 10 })
                }
                className="stat-input"
                min="0"
                max="30"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {showHP && (
              <div className="initiative-hp-compact">
                <span className="stat-label">HP</span>
                <div className="hp-value-group">
                  <input
                    type="number"
                    value={entry.currentHP}
                    onChange={(e) =>
                      onUpdate({
                        currentHP: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="stat-input"
                    min="0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="hp-separator">/</span>
                  <input
                    type="number"
                    value={entry.maxHP}
                    onChange={(e) =>
                      onUpdate({
                        maxHP: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    className="stat-input"
                    min="1"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            {entry.conditions.length > 0 && (
              <div className="initiative-condition-badge">
                🩹 {entry.conditions.length}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="initiative-card-actions">
          <button
            onClick={() => setShowActions(!showActions)}
            className="initiative-action-btn"
            title="Quick Actions"
          >
            {showActions ? '▲' : '▼'}
          </button>
          <button
            onClick={onRemove}
            className="initiative-remove-btn"
            title="Remove"
          >
            ✕
          </button>
        </div>
      </div>

      {/* HP Bar */}
      {showHP && (
        <div className="initiative-hp-bar">
          <div
            className="initiative-hp-fill"
            style={{
              width: `${Math.min(100, hpPercentage)}%`,
              backgroundColor: getHPColor(),
            }}
          />
        </div>
      )}

      {/* Active Turn Indicator */}
      {isActive && (
        <div className="initiative-active-indicator">
          ⏰ ACTIVE TURN
        </div>
      )}

      {/* Expanded Actions */}
      {showActions && showHP && (
        <div className="initiative-expanded-actions">
          {/* HP Modification */}
          <div className="initiative-hp-modification">
            <div className="hp-mod-group">
              <input
                type="number"
                value={damageInput}
                onChange={(e) => setDamageInput(e.target.value)}
                placeholder="0"
                className="hp-mod-input"
                min="0"
              />
              <button onClick={handleDamage} className="hp-mod-btn damage">
                ⚔️ Damage
              </button>
            </div>

            <div className="hp-mod-group">
              <input
                type="number"
                value={healingInput}
                onChange={(e) => setHealingInput(e.target.value)}
                placeholder="0"
                className="hp-mod-input"
                min="0"
              />
              <button onClick={handleHealing} className="hp-mod-btn heal">
                ❤️ Heal
              </button>
            </div>
          </div>

          {/* Conditions */}
          <div className="initiative-conditions-section">
            <button
              onClick={() => setShowConditions(!showConditions)}
              className="toggle-conditions-btn"
            >
              🩹 Conditions {entry.conditions.length > 0 && `(${entry.conditions.length})`}
            </button>

            {showConditions && (
              <div className="conditions-list">
                {entry.conditions.map((condition) => (
                  <div key={condition.id} className="condition-tag">
                    <span className="condition-icon">{condition.icon}</span>
                    <span className="condition-name">{condition.name}</span>
                    {condition.duration && (
                      <span className="condition-duration">{condition.duration}r</span>
                    )}
                    <button
                      onClick={() => onRemoveCondition(condition.id)}
                      className="remove-condition-btn"
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
                  className="add-condition-select"
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
            <div className="death-saves-section">
              <div className="death-saves-grid">
                <div className="death-save-track">
                  <span className="death-save-label">Successes</span>
                  <div className="death-save-dots">
                    {[1, 2, 3].map((i) => (
                      <button
                        key={i}
                        className={`death-dot success ${i <= entry.deathSaves.successes ? 'filled' : ''}`}
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

                <div className="death-save-track">
                  <span className="death-save-label">Failures</span>
                  <div className="death-save-dots">
                    {[1, 2, 3].map((i) => (
                      <button
                        key={i}
                        className={`death-dot failure ${i <= entry.deathSaves.failures ? 'filled' : ''}`}
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
    <div className="initiative-tracker-redesign">
      {/* Header */}
      <div className="initiative-header-new">
        <div className="initiative-title-section">
          <h2>⚔️ Initiative</h2>
          {isActive && <span className="round-badge">Round {round}</span>}
        </div>

        {/* Combat Controls */}
        {!isActive ? (
          <button
            onClick={startCombat}
            className="btn-start-combat"
            disabled={entries.length === 0}
          >
            ▶️ Start Combat
          </button>
        ) : (
          <div className="combat-controls-new">
            <button onClick={previousTurn} className="btn-turn" title="Previous Turn">
              ⬅️
            </button>
            <button
              onClick={
                isPaused
                  ? () => useInitiativeStore.getState().resumeCombat()
                  : () => useInitiativeStore.getState().pauseCombat()
              }
              className="btn-turn"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? '▶️' : '⏸️'}
            </button>
            <button onClick={nextTurn} className="btn-turn" title="Next Turn">
              ➡️
            </button>
            <button onClick={endCombat} className="btn-end-combat">
              🏁 End
            </button>
          </div>
        )}
      </div>

      {/* Active Turn Banner */}
      {activeEntry && isActive && (
        <div className="active-turn-banner">
          <div className="active-turn-content">
            <span className="active-turn-icon">⏰</span>
            <div className="active-turn-info">
              <div className="active-turn-name">{activeEntry.name}</div>
              <div className="active-turn-subtitle">It's their turn!</div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Bar */}
      <div className="initiative-settings-bar">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showPlayerHP}
            onChange={(e) => updateSettings({ showPlayerHP: e.target.checked })}
          />
          <span>Show HP</span>
        </label>

        <label className="checkbox-label">
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
          className="btn-roll-all"
          disabled={entries.length === 0}
        >
          🎲 Roll All
        </button>
      </div>

      {/* Add Entry Form */}
      <div className="add-entry-card">
        <div className="add-entry-title">➕ Add Combatant</div>
        <div className="add-entry-form">
          <input
            type="text"
            value={newEntryName}
            onChange={(e) => setNewEntryName(e.target.value)}
            placeholder="Name"
            className="add-entry-name"
            onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
          />

          <select
            value={newEntryType}
            onChange={(e) =>
              setNewEntryType(e.target.value as 'player' | 'npc' | 'monster')
            }
            className="add-entry-type"
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
            className="add-entry-init"
            placeholder="Init"
            min="0"
            max="99"
          />

          <button onClick={handleAddEntry} className="btn-add-entry">
            Add
          </button>
        </div>
      </div>

      {/* Initiative Cards List */}
      <div className="initiative-cards-list">
        {entries.length === 0 ? (
          <div className="empty-state-new">
            <div className="empty-icon">⚔️</div>
            <div className="empty-text">No combatants yet</div>
            <div className="empty-hint">Add players, NPCs, or monsters above</div>
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
