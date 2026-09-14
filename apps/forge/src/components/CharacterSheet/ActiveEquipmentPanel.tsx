import React from 'react';
import { Shield, Sword, Package } from 'lucide-react';
import { Character } from '../../types/dnd';
import { loadEquipment } from '../../services/dataService';

interface ActiveEquipmentPanelProps {
  character: Character;
  onUnequipItem?: (itemSlug: string) => void;
}

export const ActiveEquipmentPanel: React.FC<ActiveEquipmentPanelProps> = ({
  character,
  onUnequipItem,
}) => {
  // Get equipped armor details
  const equippedArmor = character.equippedArmor
    ? loadEquipment().find(eq => eq.slug === character.equippedArmor)
    : null;

  // Get equipped weapons (excluding shields)
  const equippedWeapons = character.equippedWeapons?.filter(slug => {
    const item = loadEquipment().find(eq => eq.slug === slug);
    return item && item.equipment_category !== 'Armor'; // Exclude shields
  }) || [];

  // Get equipped shield
  const equippedShield = character.equippedWeapons?.find(slug => {
    const item = loadEquipment().find(eq => eq.slug === slug);
    return item?.equipment_category === 'Armor' && item.armor_category === 'Shield';
  });

  // Calculate AC breakdown
  const getACBreakdown = () => {
    const breakdown = [];
    breakdown.push(`Base: 10 + ${character.abilities.DEX.modifier >= 0 ? '+' : ''}${character.abilities.DEX.modifier} DEX`);

    if (equippedArmor && equippedArmor.armor_class) {
      if (equippedArmor.armor_category === 'Light') {
        breakdown.push(`${equippedArmor.name}: ${equippedArmor.armor_class.base} + full DEX bonus`);
      } else if (equippedArmor.armor_category === 'Medium') {
        const dexBonus = Math.min(character.abilities.DEX.modifier, equippedArmor.armor_class.max_bonus || 2);
        breakdown.push(`${equippedArmor.name}: ${equippedArmor.armor_class.base} + ${dexBonus} DEX (max ${equippedArmor.armor_class.max_bonus || 2})`);
      } else if (equippedArmor.armor_category === 'Heavy') {
        breakdown.push(`${equippedArmor.name}: ${equippedArmor.armor_class.base} (no DEX bonus)`);
      }
    }

    if (equippedShield) {
      const shield = loadEquipment().find(eq => eq.slug === equippedShield);
      if (shield) {
        breakdown.push(`${shield.name}: +2 AC`);
      }
    }

    return breakdown;
  };

  return (
    <div className="space-y-4">
      {/* Equipped Armor Section */}
      <div>
        <div className="flex items-center gap-2 text-emerald-300 mb-2">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-semibold">Armor</span>
        </div>
        {equippedArmor ? (
          <div className="bg-theme-tertiary/50 p-3 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-theme-primary">{equippedArmor.name}</div>
                <div className="text-sm text-theme-tertiary">
                  AC: {getACBreakdown().slice(1).join(' + ')}
                </div>
                {equippedArmor.weight && (
                  <div className="text-xs text-theme-muted">
                    Weight: {equippedArmor.weight} lbs
                  </div>
                )}
              </div>
              {onUnequipItem && (
                <button
                  onClick={() => onUnequipItem(equippedArmor.slug)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded ml-2 flex-shrink-0"
                  title="Unequip armor"
                >
                  Unequip
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-theme-muted italic">No armor equipped</div>
        )}
      </div>

      {/* Equipped Weapons Section */}
      <div>
        <div className="flex items-center gap-2 text-emerald-300 mb-2">
          <Sword className="w-4 h-4" />
          <span className="text-sm font-semibold">Weapons</span>
        </div>
        {equippedWeapons.length > 0 ? (
          <div className="space-y-2">
            {equippedWeapons.map((weaponSlug, index) => {
              const weapon = loadEquipment().find(eq => eq.slug === weaponSlug);
              if (!weapon) return null;

              return (
                <div key={index} className="bg-theme-tertiary/50 p-3 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-theme-primary">{weapon.name}</div>
                      <div className="text-sm text-theme-tertiary">
                        {weapon.weapon_range || 'Melee'} • {weapon.damage?.damage_dice || 'Special'}
                        {weapon.damage?.damage_type && ` ${weapon.damage.damage_type}`}
                      </div>
                      {weapon.weight && (
                        <div className="text-xs text-theme-muted">
                          Weight: {weapon.weight} lbs
                        </div>
                      )}
                      {character.weaponMastery?.includes(weapon.slug) && (
                        <div className="text-xs text-amber-400 mt-1">
                          ⚔️ Mastered
                        </div>
                      )}
                    </div>
                    {onUnequipItem && (
                      <button
                        onClick={() => onUnequipItem(weapon.slug)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded ml-2 flex-shrink-0"
                        title="Unequip weapon"
                      >
                        Unequip
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-theme-muted italic">No weapons equipped</div>
        )}
      </div>

      {/* Equipped Shield Section */}
      {equippedShield && (
        <div>
          <div className="flex items-center gap-2 text-emerald-300 mb-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-semibold">Shield</span>
          </div>
          <div className="bg-theme-tertiary/50 p-3 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-theme-primary">
                  {loadEquipment().find(eq => eq.slug === equippedShield)?.name || 'Unknown Shield'}
                </div>
                <div className="text-sm text-theme-tertiary">
                  AC: +2
                </div>
                {loadEquipment().find(eq => eq.slug === equippedShield)?.weight && (
                  <div className="text-xs text-theme-muted">
                    Weight: {loadEquipment().find(eq => eq.slug === equippedShield)?.weight} lbs
                  </div>
                )}
              </div>
              {onUnequipItem && (
                <button
                  onClick={() => onUnequipItem(equippedShield)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded ml-2 flex-shrink-0"
                  title="Unequip shield"
                >
                  Unequip
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Items Section */}
      <div>
        <div className="flex items-center gap-2 text-emerald-300 mb-2">
          <Package className="w-4 h-4" />
          <span className="text-sm font-semibold">Active Items</span>
        </div>
        {character.inventory?.some(item => item.equipped) ? (
          <div className="space-y-2">
            {character.inventory
              .filter(item => item.equipped)
              .map((item, index) => {
                const itemData = loadEquipment().find(eq => eq.slug === item.equipmentSlug);
                return (
                  <div key={index} className="bg-theme-tertiary/50 p-2 rounded-lg">
                    <div className="font-semibold text-theme-primary text-sm">{itemData?.name || item.equipmentSlug}</div>
                    <div className="text-xs text-theme-muted">Equipped</div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-sm text-theme-muted italic">No active items</div>
        )}
      </div>
    </div>
  );
};