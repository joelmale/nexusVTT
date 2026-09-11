import React, { useState } from 'react';
import { Monster, UserMonster } from '../../types/dnd';
import { Eye } from 'lucide-react';
import { MonsterStatBlock } from '../MonsterLibrary/MonsterStatBlock';

interface EncounterGridProps {
  monsters: (Monster | UserMonster)[];
}

const getModifier = (score: number): string => {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const getACDisplay = (armorClass: Monster['armor_class']): string => {
  if (Array.isArray(armorClass) && armorClass.length > 0) {
    return armorClass[0].value.toString();
  }
  return '10';
};

const getSpeedDisplay = (speed: Monster['speed']): string => {
  if (speed.walk) return speed.walk;
  if (speed.fly) return `fly ${speed.fly}`;
  if (speed.swim) return `swim ${speed.swim}`;
  return '0 ft.';
};

const getCRColor = (cr: number): string => {
  if (cr <= 4) return 'bg-accent-green';
  if (cr <= 10) return 'bg-accent-yellow-dark';
  if (cr <= 16) return 'bg-orange-600';
  return 'bg-accent-red';
};

const CondensedStatBlock: React.FC<{
  monster: Monster | UserMonster;
  instanceNumber: number;
  onViewFull: () => void;
}> = ({ monster, instanceNumber, onViewFull }) => {
  return (
    <div className="bg-theme-secondary rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-red-900 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">
              {monster.name}
              {instanceNumber > 1 && (
                <span className="ml-2 text-sm text-theme-tertiary">#{instanceNumber}</span>
              )}
            </h3>
            <p className="text-sm text-theme-tertiary italic">
              {monster.size} {monster.type}
            </p>
          </div>
          <span
            className={`px-2 py-1 ${getCRColor(
              monster.challenge_rating
            )} text-white text-xs font-bold rounded`}
          >
            CR {monster.challenge_rating}
          </span>
        </div>
      </div>

      {/* Core Stats */}
      <div className="p-4 space-y-3">
        {/* AC, HP, Speed */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-theme-tertiary/50 p-2 rounded">
          <div>
            <div className="text-theme-muted">AC</div>
            <div className="text-lg font-bold text-accent-yellow-light">{getACDisplay(monster.armor_class)}</div>
          </div>
          <div>
            <div className="text-theme-muted">HP</div>
            <div className="text-lg font-bold text-accent-green-light">{monster.hit_points}</div>
          </div>
          <div>
            <div className="text-theme-muted">Speed</div>
            <div className="text-sm font-bold text-blue-300">{getSpeedDisplay(monster.speed)}</div>
          </div>
        </div>

        {/* Ability Scores */}
        <div className="grid grid-cols-6 gap-1 text-center text-xs">
          {[
            { name: 'STR', score: monster.strength },
            { name: 'DEX', score: monster.dexterity },
            { name: 'CON', score: monster.constitution },
            { name: 'INT', score: monster.intelligence },
            { name: 'WIS', score: monster.wisdom },
            { name: 'CHA', score: monster.charisma },
          ].map((ability) => (
            <div key={ability.name} className="bg-theme-tertiary/50 p-1 rounded">
              <div className="text-theme-muted">{ability.name}</div>
              <div className="font-bold text-white">{ability.score}</div>
              <div className="text-xs text-theme-muted">({getModifier(ability.score)})</div>
            </div>
          ))}
        </div>

        {/* Key Abilities */}
        {monster.special_abilities && monster.special_abilities.length > 0 && (
          <div className="text-xs">
            <div className="font-bold text-accent-purple-light mb-1">Special Abilities:</div>
            <div className="text-theme-tertiary line-clamp-2">
              {monster.special_abilities.map((a) => a.name).join(', ')}
            </div>
          </div>
        )}

        {/* Actions */}
        {monster.actions && monster.actions.length > 0 && (
          <div className="text-xs">
            <div className="font-bold text-accent-red-light mb-1">Actions:</div>
            <div className="text-theme-tertiary line-clamp-2">
              {monster.actions.map((a) => a.name).join(', ')}
            </div>
          </div>
        )}

        {/* View Full Button */}
        <button
          onClick={onViewFull}
          className="w-full py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white font-semibold transition-colors flex items-center justify-center text-sm"
        >
          <Eye className="w-4 h-4 mr-2" />
          View Full Stat Block
        </button>
      </div>
    </div>
  );
};

export const EncounterGrid: React.FC<EncounterGridProps> = ({ monsters }) => {
  const [selectedMonster, setSelectedMonster] = useState<Monster | UserMonster | null>(null);

  // Group monsters by type to assign instance numbers
  const monsterInstances = new Map<string, number>();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {monsters.map((monster, index) => {
          // Track instance numbers for duplicate monsters
          const currentCount = monsterInstances.get(monster.index) || 0;
          monsterInstances.set(monster.index, currentCount + 1);
          const instanceNumber = monsterInstances.get(monster.index) || 1;

          return (
            <CondensedStatBlock
              key={`${monster.index}-${index}`}
              monster={monster}
              instanceNumber={instanceNumber}
              onViewFull={() => setSelectedMonster(monster)}
            />
          );
        })}
      </div>

      {/* Full Stat Block Modal */}
      {selectedMonster && (
        <MonsterStatBlock
          monster={selectedMonster}
          onClose={() => setSelectedMonster(null)}
        />
      )}
    </>
  );
};
