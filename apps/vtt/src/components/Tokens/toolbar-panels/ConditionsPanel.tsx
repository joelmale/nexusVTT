import React from 'react';
import { useGameStore, useSelectedPlacedToken, useActiveScene } from '@/stores/gameStore';

interface ConditionsPanelProps {
  tokenId?: string; // Not currently used, kept for interface compatibility
}

const CONDITION_ICONS: Record<string, string> = {
  Blinded: '👁️‍🗨️',
  Charmed: '😍',
  Deafened: '🙉',
  Frightened: '😱',
  Grappled: '🤝',
  Incapacitated: '😴',
  Invisible: '👻',
  Paralyzed: '🧊',
  Petrified: '🗿',
  Poisoned: '🤢',
  Prone: '⬇️',
  Restrained: '🔒',
  Stunned: '💫',
  Unconscious: '😵',
};

const CONDITIONS = Object.keys(CONDITION_ICONS);

export const ConditionsPanel: React.FC<ConditionsPanelProps> = () => {
  const placedToken = useSelectedPlacedToken();
  const activeScene = useActiveScene();
  const { updateToken } = useGameStore();

  if (!placedToken || !activeScene) return null;

  const toggleCondition = (conditionName: string) => {
    const existingCondition = placedToken.conditions.find(c => c.name === conditionName);

    let newConditions;
    if (existingCondition) {
      // Remove the condition
      newConditions = placedToken.conditions.filter(c => c.name !== conditionName);
    } else {
      // Add the condition - Generate ID in event handler (not during render)
      const newCondition = {
        id: `condition-${placedToken.id}-${conditionName}-${placedToken.conditions.length}`,
        name: conditionName,
        icon: CONDITION_ICONS[conditionName],
      };
      newConditions = [...placedToken.conditions, newCondition];
    }

    updateToken(activeScene.id, placedToken.id, { conditions: newConditions });
  };

  return (
    <div className="token-toolbar-panel conditions-panel">
      <div className="token-panel-header">
        <span className="token-panel-title">Status Conditions</span>
      </div>
      <div className="token-panel-content">
        <div className="conditions-grid">
          {CONDITIONS.map((condition) => {
            const isActive = placedToken.conditions.some(c => c.name === condition);
            return (
              <button
                key={condition}
                className={`condition-btn ${isActive ? 'active' : ''}`}
                onClick={() => toggleCondition(condition)}
                title={`${condition} ${isActive ? '(Active)' : ''}`}
              >
                <span className="condition-icon">
                  {CONDITION_ICONS[condition]}
                </span>
                <span className="condition-name">{condition}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
