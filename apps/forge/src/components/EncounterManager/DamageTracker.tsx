import React, { useState } from 'react';
import { InitiativeEntry } from '../../types/encounterCombat';

interface DamageTrackerProps {
  combatants: InitiativeEntry[];
  onUpdateHP: (combatantId: string, newHP: number) => void;
}

export function DamageTracker({ combatants, onUpdateHP }: DamageTrackerProps) {
  const [selectedCombatant, setSelectedCombatant] = useState<string>('');
  const [damageAmount, setDamageAmount] = useState<string>('');
  const [isHealing, setIsHealing] = useState<boolean>(false);

  const selectedEntry = combatants.find(c => c.id === selectedCombatant);

  const handleApplyDamage = () => {
    if (!selectedEntry || !damageAmount) return;

    const amount = parseInt(damageAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newHP = isHealing
      ? Math.min(selectedEntry.maxHp, selectedEntry.currentHp + amount)
      : Math.max(0, selectedEntry.currentHp - amount);

    onUpdateHP(selectedEntry.id, newHP);
    setDamageAmount('');
  };

  const handleQuickDamage = (amount: number, healing: boolean = false) => {
    if (!selectedEntry) return;

    const newHP = healing
      ? Math.min(selectedEntry.maxHp, selectedEntry.currentHp + amount)
      : Math.max(0, selectedEntry.currentHp - amount);

    onUpdateHP(selectedEntry.id, newHP);
  };

  return (
    <div className="damage-tracker">
      <h3>Damage & Healing</h3>

      {/* Combatant Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Combatant</label>
        <select
          value={selectedCombatant}
          onChange={(e) => setSelectedCombatant(e.target.value)}
          className="w-full p-2 bg-theme-secondary border border-theme-tertiary rounded"
        >
          <option value="">Choose a combatant...</option>
          {combatants.map(combatant => (
            <option key={combatant.id} value={combatant.id}>
              {combatant.name} ({combatant.currentHp}/{combatant.maxHp} HP)
            </option>
          ))}
        </select>
      </div>

      {selectedEntry && (
        <>
          {/* Current HP Display */}
          <div className="mb-4 p-3 bg-theme-secondary rounded">
            <div className="flex justify-between items-center">
              <span className="font-medium">{selectedEntry.name}</span>
              <span className="text-lg font-bold">
                {selectedEntry.currentHp}/{selectedEntry.maxHp} HP
              </span>
            </div>
            <div className="w-full bg-theme-tertiary rounded-full h-2 mt-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, (selectedEntry.currentHp / selectedEntry.maxHp) * 100)}%`
                }}
              />
            </div>
          </div>

          {/* Damage/Healing Input */}
          <div className="mb-4">
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setIsHealing(false)}
                className={`flex-1 py-2 px-4 rounded transition-colors ${
                  !isHealing
                    ? 'bg-red-600 text-white'
                    : 'bg-theme-secondary text-theme-muted hover:bg-theme-tertiary'
                }`}
              >
                Damage
              </button>
              <button
                onClick={() => setIsHealing(true)}
                className={`flex-1 py-2 px-4 rounded transition-colors ${
                  isHealing
                    ? 'bg-green-600 text-white'
                    : 'bg-theme-secondary text-theme-muted hover:bg-theme-tertiary'
                }`}
              >
                Heal
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                value={damageAmount}
                onChange={(e) => setDamageAmount(e.target.value)}
                placeholder="Enter amount..."
                className="flex-1 p-2 bg-theme-secondary border border-theme-tertiary rounded"
                min="1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleApplyDamage();
                  }
                }}
              />
              <button
                onClick={handleApplyDamage}
                disabled={!damageAmount || parseInt(damageAmount) <= 0}
                className="px-4 py-2 bg-accent-purple text-white rounded hover:bg-accent-purple-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Quick Actions</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 5, 10, 20].map(amount => (
                <button
                  key={`damage-${amount}`}
                  onClick={() => handleQuickDamage(amount, false)}
                  className="p-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  title={`Deal ${amount} damage`}
                >
                  -{amount}
                </button>
              ))}
              {[1, 5, 10, 20].map(amount => (
                <button
                  key={`heal-${amount}`}
                  onClick={() => handleQuickDamage(amount, true)}
                  className="p-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  title={`Heal ${amount} HP`}
                >
                  +{amount}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}