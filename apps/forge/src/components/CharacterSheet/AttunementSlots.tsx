import React from 'react';
import { Zap, Star } from 'lucide-react';
import { Character } from '../../types/dnd';
import { loadEquipment } from '../../services/dataService';

interface AttunementSlotsProps {
  character: Character;
}

export const AttunementSlots: React.FC<AttunementSlotsProps> = ({
  character,
}) => {
  // Calculate attunement slots based on character level
  const getAttunementSlots = (level: number): number => {
    if (level >= 20) return 5;
    if (level >= 18) return 4;
    if (level >= 14) return 3;
    if (level >= 10) return 2;
    if (level >= 6) return 1;
    return 0;
  };

  const maxSlots = getAttunementSlots(character.level);
  const usedSlots = character.inventory?.filter(item =>
    item.attuned === true
  ).length || 0;

  const availableSlots = Math.max(0, maxSlots - usedSlots);

  // Get attuned items for display
  const attunedItems = character.inventory?.filter(item =>
    item.attuned === true
  ) || [];

  return (
    <div className="bg-cyan-900 rounded-xl shadow-lg border-l-4 border-yellow-500 p-4">
      <h3 className="text-lg font-bold text-accent-yellow-light mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5" />
        Attunement Slots
      </h3>

      <div className="space-y-4">
        {/* Slot Counter */}
        <div className="text-center">
          <div className="text-3xl font-bold text-theme-primary mb-1">
            {availableSlots} / {maxSlots}
          </div>
          <div className="text-sm text-theme-muted">Available Slots</div>
        </div>

        {/* Visual Slot Display */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: maxSlots }, (_, index) => (
            <div
              key={index}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                index < usedSlots
                  ? 'bg-accent-yellow border-yellow-400 text-cyan-900'
                  : 'bg-theme-tertiary border-theme-primary text-theme-disabled'
              }`}
            >
              {index < usedSlots ? (
                <Star className="w-4 h-4 fill-current" />
              ) : (
                <span className="text-xs font-bold">{index + 1}</span>
              )}
            </div>
          ))}
        </div>

        {/* Attuned Items List */}
        {attunedItems.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-cyan-300">Attuned Items:</h4>
            <div className="space-y-1">
              {attunedItems.map((item, index) => {
                const equipment = loadEquipment().find(eq => eq.slug === item.equipmentSlug);
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-theme-secondary/50 rounded">
                    <Star className="w-4 h-4 text-accent-yellow-light fill-current" />
                    <span className="text-sm text-theme-tertiary">{equipment?.name || item.equipmentSlug}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info Text */}
        <div className="text-xs text-theme-disabled text-center">
          Attunement slots unlock at levels 6, 10, 14, 18, and 20
        </div>

        {/* Level Requirements */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-theme-secondary/50 p-2 rounded text-center">
            <div className="text-cyan-400 font-semibold">Level 6+</div>
            <div className="text-theme-tertiary">1 slot</div>
          </div>
          <div className="bg-theme-secondary/50 p-2 rounded text-center">
            <div className="text-cyan-400 font-semibold">Level 10+</div>
            <div className="text-theme-tertiary">2 slots</div>
          </div>
          <div className="bg-theme-secondary/50 p-2 rounded text-center">
            <div className="text-cyan-400 font-semibold">Level 14+</div>
            <div className="text-theme-tertiary">3 slots</div>
          </div>
          <div className="bg-theme-secondary/50 p-2 rounded text-center">
            <div className="text-cyan-400 font-semibold">Level 18+</div>
            <div className="text-theme-tertiary">4 slots</div>
          </div>
        </div>
      </div>
    </div>
  );
};