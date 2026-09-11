import React from 'react';
import { Monster, UserMonster } from '../../types/dnd';

interface MonsterStatPanelProps {
  monster: Monster | UserMonster | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MonsterStatPanel({ monster, isOpen, onClose }: MonsterStatPanelProps) {
  if (!isOpen || !monster) return null;

  const formatAbilityScore = (score: number) => {
    const modifier = Math.floor((score - 10) / 2);
    return `${score} (${modifier >= 0 ? '+' : ''}${modifier})`;
  };

  const formatSpeed = (speed: Monster['speed']) => {
    const parts = [];
    if (speed.walk) parts.push(`${speed.walk} ft.`);
    if (speed.fly) parts.push(`fly ${speed.fly} ft.`);
    if (speed.swim) parts.push(`swim ${speed.swim} ft.`);
    if (speed.climb) parts.push(`climb ${speed.climb} ft.`);
    if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`);
    return parts.join(', ');
  };

  const formatArmorClass = (ac: Monster['armor_class']) => {
    return ac.map(item => {
      if (item.type) {
        return `${item.value} (${item.type}${item.desc ? `, ${item.desc}` : ''})`;
      }
      return item.value;
    }).join(' or ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-primary rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-secondary">
          <div>
            <h2 className="text-2xl font-bold text-white">{monster.name}</h2>
            <p className="text-theme-muted">
              {monster.size} {monster.type}
              {monster.subtype && ` (${monster.subtype})`}, {monster.alignment}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-accent-purple-light mb-2">Combat Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-theme-muted">Armor Class:</span>
                    <span className="text-white">{formatArmorClass(monster.armor_class)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-theme-muted">Hit Points:</span>
                    <span className="text-white">{monster.hit_points} ({monster.hit_dice})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-theme-muted">Speed:</span>
                    <span className="text-white">{formatSpeed(monster.speed)}</span>
                  </div>
                </div>
              </div>

              {/* Ability Scores */}
              <div>
                <h3 className="text-lg font-bold text-accent-purple-light mb-2">Ability Scores</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-white">STR</div>
                    <div className="text-theme-muted">{formatAbilityScore(monster.strength)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-white">DEX</div>
                    <div className="text-theme-muted">{formatAbilityScore(monster.dexterity)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-white">CON</div>
                    <div className="text-theme-muted">{formatAbilityScore(monster.constitution)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-white">INT</div>
                    <div className="text-theme-muted">{formatAbilityScore(monster.intelligence)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-white">WIS</div>
                    <div className="text-theme-muted">{formatAbilityScore(monster.wisdom)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-white">CHA</div>
                    <div className="text-theme-muted">{formatAbilityScore(monster.charisma)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-accent-purple-light mb-2">Challenge & XP</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-theme-muted">Challenge Rating:</span>
                    <span className="text-white">{monster.challenge_rating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-theme-muted">XP:</span>
                    <span className="text-white">{monster.xp.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-theme-muted">Proficiency Bonus:</span>
                    <span className="text-white">+{monster.proficiency_bonus}</span>
                  </div>
                </div>
              </div>

              {/* Senses & Languages */}
              {(Object.keys(monster.senses).length > 0 || monster.languages) && (
                <div>
                  <h3 className="text-lg font-bold text-accent-purple-light mb-2">Senses & Languages</h3>
                  <div className="space-y-1 text-sm">
                    {Object.keys(monster.senses).length > 0 && (
                      <div>
                        <span className="text-theme-muted">Senses: </span>
                        <span className="text-white">
                          {Object.entries(monster.senses).map(([sense, value]) =>
                            `${sense} ${value}`
                          ).join(', ')}
                        </span>
                      </div>
                    )}
                    {monster.languages && (
                      <div>
                        <span className="text-theme-muted">Languages: </span>
                        <span className="text-white">{monster.languages}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Special Abilities */}
          {monster.special_abilities && monster.special_abilities.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-accent-purple-light mb-3">Special Abilities</h3>
              <div className="space-y-3">
                {monster.special_abilities.map((ability, index) => (
                  <div key={index} className="border-l-4 border-accent-purple pl-4">
                    <h4 className="font-bold text-white">{ability.name}</h4>
                    <p className="text-theme-muted text-sm mt-1">{ability.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {monster.actions && monster.actions.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-accent-purple-light mb-3">Actions</h3>
              <div className="space-y-3">
                {monster.actions.map((action, index) => (
                  <div key={index} className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-bold text-white">{action.name}</h4>
                    <p className="text-theme-muted text-sm mt-1">{action.desc}</p>
                    {action.attack_bonus && (
                      <div className="text-xs text-theme-muted mt-1">
                        Attack: +{action.attack_bonus}
                        {action.damage && ` | Damage: ${action.damage.map(d => d.damage_dice).join(' + ')}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legendary Actions */}
          {monster.legendary_actions && monster.legendary_actions.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-accent-purple-light mb-3">Legendary Actions</h3>
              <div className="space-y-3">
                {monster.legendary_actions.map((action, index) => (
                  <div key={index} className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-bold text-white">{action.name}</h4>
                    <p className="text-theme-muted text-sm mt-1">{action.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reactions */}
          {monster.reactions && monster.reactions.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-accent-purple-light mb-3">Reactions</h3>
              <div className="space-y-3">
                {monster.reactions.map((reaction, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-bold text-white">{reaction.name}</h4>
                    <p className="text-theme-muted text-sm mt-1">{reaction.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
