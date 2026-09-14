import React, { useState, useEffect } from 'react';
import { AbilityName, CharacterCreationData } from '../../../types/dnd';

interface BackgroundASIWidgetProps {
  availableOptions: AbilityName[];
  data: CharacterCreationData;
  updateData: (updates: Partial<CharacterCreationData>) => void;
}

export const BackgroundASIWidget: React.FC<BackgroundASIWidgetProps> = ({
  availableOptions,
  data,
  updateData,
}) => {
  const [method, setMethod] = useState<'2/1' | '1/1/1'>(data.backgroundAbilityChoices?.method || '2/1');
  const [bonuses, setBonuses] = useState<Partial<Record<AbilityName, number>>>(data.backgroundAbilityChoices?.bonuses || {});

  // Reset bonuses when method changes
  useEffect(() => {
    setBonuses({});
    updateData({ backgroundAbilityChoices: { method, bonuses: {} } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  // Sync with external data changes
  useEffect(() => {
    if (data.backgroundAbilityChoices) {
      setMethod(data.backgroundAbilityChoices.method || '2/1');
      setBonuses(data.backgroundAbilityChoices.bonuses || {});
    }
  }, [data.backgroundAbilityChoices]);

  const handleBonusChange = (ability: AbilityName, value: number) => {
    const newBonuses = { ...bonuses };

    // If assigning +2 (for 2/1 method), ensure no other +2 exists
    if (value === 2) {
      Object.keys(newBonuses).forEach((key) => {
        if (newBonuses[key as AbilityName] === 2) {
          delete newBonuses[key as AbilityName];
        }
      });
    }

    // If assigning +1
    if (value === 1) {
      // For 2/1 method: ensure max one +1, and it's not the same as the +2 ability
      if (method === '2/1') {
         Object.keys(newBonuses).forEach((key) => {
          if (newBonuses[key as AbilityName] === 1) {
            delete newBonuses[key as AbilityName];
          }
        });
      }
      // For 1/1/1 method: ensure max three +1s
      else if (method === '1/1/1') {
         // No specific restriction needed here other than max count check which is implicit in UI
      }
    }
    
    // Remove if 0
    if (value === 0) {
        delete newBonuses[ability];
    } else {
        newBonuses[ability] = value;
    }

    setBonuses(newBonuses);
    updateData({ backgroundAbilityChoices: { method, bonuses: newBonuses } });
  };

  const renderSelector = (label: string, value: number, disabledAbilities: string[]) => (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm font-medium text-theme-tertiary w-12">{label}</span>
      <select
        className="bg-theme-secondary border border-theme-primary text-white text-sm rounded p-1"
        value={Object.keys(bonuses).find(key => bonuses[key as AbilityName] === value) || ''}
        onChange={(e) => handleBonusChange(e.target.value as AbilityName, value)}
      >
        <option value="">Select...</option>
        {availableOptions.map(opt => (
          <option key={opt} value={opt} disabled={disabledAbilities.includes(opt)}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="bg-theme-tertiary/30 border border-theme-primary rounded-lg p-4 mt-4">
      <h4 className="text-sm font-bold text-accent-yellow-light mb-3">Background Ability Score Increase</h4>
      
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setMethod('2/1')}
          className={`flex-1 py-2 px-3 text-xs rounded border ${
            method === '2/1'
              ? 'bg-accent-blue border-accent-blue text-white'
              : 'bg-transparent border-theme-primary text-theme-muted hover:text-white'
          }`}
        >
          +2 / +1
        </button>
        <button
          onClick={() => setMethod('1/1/1')}
          className={`flex-1 py-2 px-3 text-xs rounded border ${
            method === '1/1/1'
              ? 'bg-accent-blue border-accent-blue text-white'
              : 'bg-transparent border-theme-primary text-theme-muted hover:text-white'
          }`}
        >
          +1 / +1 / +1
        </button>
      </div>

      {method === '2/1' ? (
        <div className="space-y-2">
          {renderSelector('+2', 2, Object.keys(bonuses).filter(k => bonuses[k as AbilityName] === 1))}
          {renderSelector('+1', 1, Object.keys(bonuses).filter(k => bonuses[k as AbilityName] === 2))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-theme-muted mb-2">Select 3 different abilities to increase by 1</div>
          {[1, 2, 3].map(idx => (
             <div key={idx} className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-theme-tertiary w-12">+1</span>
                <select
                    className="bg-theme-secondary border border-theme-primary text-white text-sm rounded p-1"
                    // This logic is simplified; for 1/1/1 we just need 3 unique selections.
                    // A proper multi-select or 3 separate dropdowns managing a shared list is better.
                    // Here, we'll let the user pick for "Slot 1", "Slot 2", "Slot 3" but storing them is tricky with just `bonuses` map.
                    // Actually, for 1/1/1, we can just render 3 dropdowns that read/write to specific keys if we had them, 
                    // but we store as `Record<Ability, number>`.
                    // So we need to render dropdowns that allow picking an ability *that isn't already picked by another +1*.
                    // We can try to infer "Slot 1" corresponds to the first key in bonuses, etc.
                    // But for simplicity/robustness, let's just show available options.
                    // Strategy: Render available options as checkboxes or clickable badges?
                    // Or just 3 dropdowns that add to the map.
                    value={Object.keys(bonuses)[idx-1] || ''}
                    onChange={(e) => {
                        const newAbility = e.target.value as AbilityName;
                        const oldAbility = Object.keys(bonuses)[idx-1] as AbilityName;
                        
                        const newBonuses = { ...bonuses };
                        if (oldAbility) delete newBonuses[oldAbility];
                        if (newAbility) newBonuses[newAbility] = 1;
                        setBonuses(newBonuses);
                        updateData({ backgroundAbilityChoices: { method, bonuses: newBonuses } });
                    }}
                >
                    <option value="">Select...</option>
                    {availableOptions.map(opt => (
                        <option key={opt} value={opt} disabled={Object.keys(bonuses).includes(opt) && Object.keys(bonuses)[idx-1] !== opt}>
                            {opt}
                        </option>
                    ))}
                </select>
             </div>
          ))}
        </div>
      )}
    </div>
  );
};
