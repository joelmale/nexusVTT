import React, { useState } from 'react';
import {
  useInitiativeStore,
  useInitiative,
  useInitiativeActions,
} from '@/stores/initiativeStore';
import { STANDARD_CONDITIONS } from '@/types/initiative';
import type { InitiativeEntry, Condition } from '@/types/initiative';

interface InitiativeEntryRowProps {
  entry: InitiativeEntry;
  isActive: boolean;
  onUpdate: (updates: Partial<InitiativeEntry>) => void;
  onRemove: () => void;
  onApplyDamage: (damage: number) => void;
  onApplyHealing: (healing: number) => void;
  onAddCondition: (condition: Condition) => void;
  onRemoveCondition: (conditionId: string) => void;
  showHP: boolean;
}

const InitiativeEntryRow: React.FC<InitiativeEntryRowProps> = ({
  entry,
  isActive,
  onUpdate,
  onRemove,
  onApplyDamage,
  onApplyHealing,
  onAddCondition,
  onRemoveCondition,
  showHP,
}) => {
  const [damageInput, setDamageInput] = useState('');
  const [healingInput, setHealingInput] = useState('');
  const [showConditions, setShowConditions] = useState(false);

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

  return (
    <div
      className={`initiative-entry ${isActive ? 'active' : ''} ${isDead ? 'dead' : ''}`}
    >
      <div className="initiative-entry-header">
        <div className="initiative-value">
          <input
            type="number"
            value={entry.initiative}
            onChange={(e) =>
              onUpdate({ initiative: parseInt(e.target.value, 10) || 0 })
            }
            className="initiative-input"
            min="0"
            max="30"
          />
        </div>

        <div className="entry-info">
          <div className="entry-name">
            <input
              type="text"
              value={entry.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="name-input"
              placeholder="Character name"
            />
            <span className={`entry-type ${entry.type}`}>
              {entry.type.toUpperCase()}
            </span>
          </div>

          {showHP && (
            <div className="hp-display">
              <div className="hp-bar">
                <div
                  className="hp-fill"
                  style={{
                    width: `${hpPercentage}%`,
                    backgroundColor:
                      hpPercentage > 50
                        ? '#10b981'
                        : hpPercentage > 25
                          ? '#f59e0b'
                          : '#ef4444',
                  }}
                />
              </div>
              <div className="hp-text">
                <input
                  type="number"
                  value={entry.currentHP}
                  onChange={(e) =>
                    onUpdate({
                      currentHP: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="hp-input"
                  min="0"
                />
                <span>/</span>
                <input
                  type="number"
                  value={entry.maxHP}
                  onChange={(e) =>
                    onUpdate({
                      maxHP: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="hp-input"
                  min="1"
                />
                {entry.tempHP > 0 && (
                  <span className="temp-hp">+{entry.tempHP}</span>
                )}
              </div>
            </div>
          )}

          <div className="ac-display">
            <label>AC:</label>
            <input
              type="number"
              value={entry.armorClass}
              onChange={(e) =>
                onUpdate({ armorClass: parseInt(e.target.value, 10) || 10 })
              }
              className="ac-input"
              min="0"
              max="30"
            />
          </div>
        </div>

        <div className="entry-actions">
          <button
            onClick={() => setShowConditions(!showConditions)}
            className={`condition-btn ${entry.conditions.length > 0 ? 'has-conditions' : ''}`}
            title="Conditions"
          >
            🩹 {entry.conditions.length > 0 && entry.conditions.length}
          </button>
          <button onClick={onRemove} className="remove-btn" title="Remove">
            ❌
          </button>
        </div>
      </div>

      {showHP && (
        <div className="hp-controls">
          <div className="damage-control">
            <input
              type="number"
              value={damageInput}
              onChange={(e) => setDamageInput(e.target.value)}
              placeholder="Damage"
              className="damage-input"
              min="0"
            />
            <button onClick={handleDamage} className="damage-btn">
              ⚔️
            </button>
          </div>

          <div className="healing-control">
            <input
              type="number"
              value={healingInput}
              onChange={(e) => setHealingInput(e.target.value)}
              placeholder="Healing"
              className="healing-input"
              min="0"
            />
            <button onClick={handleHealing} className="healing-btn">
              ❤️
            </button>
          </div>
        </div>
      )}

      {isDead && (
        <div className="death-saves">
          <div className="death-save-group">
            <label>Successes:</label>
            <div className="death-save-dots">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`death-save-dot ${i <= entry.deathSaves.successes ? 'filled' : ''}`}
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
                </span>
              ))}
            </div>
          </div>
          <div className="death-save-group">
            <label>Failures:</label>
            <div className="death-save-dots">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`death-save-dot failure ${i <= entry.deathSaves.failures ? 'filled' : ''}`}
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
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {showConditions && (
        <div className="conditions-panel">
          <div className="active-conditions">
            {entry.conditions.map((condition) => (
              <div key={condition.id} className="condition-item">
                <span className="condition-icon">{condition.icon}</span>
                <span className="condition-name">{condition.name}</span>
                {condition.duration && (
                  <span className="condition-duration">
                    {condition.duration}r
                  </span>
                )}
                <button
                  onClick={() => onRemoveCondition(condition.id)}
                  className="remove-condition-btn"
                >
                  ❌
                </button>
              </div>
            ))}
          </div>

          <div className="add-condition">
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
              className="condition-select"
            >
              <option value="">Add condition...</option>
              {STANDARD_CONDITIONS.map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {condition.icon} {condition.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {entry.isReady && <div className="status-indicator ready">Ready</div>}
      {entry.isDelayed && (
        <div className="status-indicator delayed">Delayed</div>
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
  } = useInitiativeActions();

  const { showPlayerHP, sortByInitiative, updateSettings } =
    useInitiativeStore();

  const [newEntryName, setNewEntryName] = useState('');
  const [newEntryType, setNewEntryType] = useState<
    'player' | 'npc' | 'monster'
  >('player');
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

  return (
    <div className="initiative-tracker">
      <div className="initiative-header">
        <h3>Initiative Tracker</h3>

        <div className="combat-controls">
          {!isActive ? (
            <button
              onClick={startCombat}
              className="start-combat-btn"
              disabled={entries.length === 0}
            >
              ⚔️ Start Combat
            </button>
          ) : (
            <div className="active-combat-controls">
              <div className="round-display">Round {round}</div>

              <button
                onClick={previousTurn}
                className="prev-turn-btn"
                title="Previous Turn"
              >
                ⬅️
              </button>

              <button
                onClick={
                  isPaused
                    ? () => useInitiativeStore.getState().resumeCombat()
                    : () => useInitiativeStore.getState().pauseCombat()
                }
                className="pause-btn"
              >
                {isPaused ? '▶️' : '⏸️'}
              </button>

              <button
                onClick={nextTurn}
                className="next-turn-btn"
                title="Next Turn"
              >
                ➡️
              </button>

              <button onClick={endCombat} className="end-combat-btn">
                🏁 End
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="initiative-settings">
        <label className="setting-item">
          <input
            type="checkbox"
            checked={showPlayerHP}
            onChange={(e) => updateSettings({ showPlayerHP: e.target.checked })}
          />
          Show HP
        </label>

        <label className="setting-item">
          <input
            type="checkbox"
            checked={sortByInitiative}
            onChange={(e) =>
              updateSettings({ sortByInitiative: e.target.checked })
            }
          />
          Auto Sort
        </label>

        <button
          onClick={rollInitiativeForAll}
          className="roll-all-btn"
          disabled={entries.length === 0}
        >
          🎲 Roll All
        </button>
      </div>

      <div className="add-entry">
        <div className="add-entry-row">
          <input
            type="text"
            value={newEntryName}
            onChange={(e) => setNewEntryName(e.target.value)}
            placeholder="Character name"
            className="name-input"
            onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
          />
        </div>

        <div className="add-entry-row">
          <select
            value={newEntryType}
            onChange={(e) =>
              setNewEntryType(e.target.value as 'player' | 'npc' | 'monster')
            }
            className="type-select"
          >
            <option value="player">Player</option>
            <option value="npc">NPC</option>
            <option value="monster">Monster</option>
          </select>

          <input
            type="number"
            value={newEntryInitiative}
            onChange={(e) =>
              setNewEntryInitiative(parseInt(e.target.value, 10) || 0)
            }
            className="initiative-input"
            placeholder="Init"
            min="0"
            max="30"
          />

          <button onClick={handleAddEntry} className="add-btn">
            ➕ Add
          </button>
        </div>
      </div>

      <div className="initiative-list">
        {entries.length === 0 ? (
          <div className="empty-state">
            <p>No combatants added yet.</p>
            <p>Add players, NPCs, and monsters to begin combat.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <InitiativeEntryRow
              key={entry.id}
              entry={entry}
              isActive={entry.isActive}
              onUpdate={(updates) => updateEntry(entry.id, updates)}
              onRemove={() => removeEntry(entry.id)}
              onApplyDamage={(damage) => applyDamage(entry.id, damage)}
              onApplyHealing={(healing) => applyHealing(entry.id, healing)}
              onAddCondition={(condition) => addCondition(entry.id, condition)}
              onRemoveCondition={(conditionId) =>
                removeCondition(entry.id, conditionId)
              }
              showHP={showPlayerHP}
            />
          ))
        )}
      </div>

      {activeEntry && isActive && (
        <div className="current-turn">
          <div className="current-turn-indicator">
            <span className="turn-icon">⏰</span>
            <span className="turn-text">{activeEntry.name}'s Turn</span>
          </div>
        </div>
      )}
    </div>
  );
};
