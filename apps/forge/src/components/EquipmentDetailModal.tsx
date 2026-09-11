import React from 'react';
import { X, Sword, Shield, Package } from 'lucide-react';
import { loadEquipment } from '../services/dataService';
import { Equipment } from '../types/dnd';

interface EquipmentDetailModalProps {
  equipment: Equipment | { slug: string } | null;
  onClose: () => void;
}

export const EquipmentDetailModal: React.FC<EquipmentDetailModalProps> = ({ equipment, onClose }) => {
  // Handle case where equipment is passed as a slug
  const equipmentData = React.useMemo(() => {
    if (!equipment) return null;

    // If it's already an Equipment object, use it directly
    if ('name' in equipment) {
      return equipment;
    }

    // If it's an object with a slug, look up the equipment
    if ('slug' in equipment) {
      const allEquipment = loadEquipment();
      return allEquipment.find(eq => eq.slug === equipment.slug) || null;
    }

    return null;
  }, [equipment]);

  if (!equipmentData) {
    return null;
  }

  const isWeapon = equipmentData.weapon_category;
  const isArmor = equipmentData.armor_category;
  const isGear = !isWeapon && !isArmor;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-theme-secondary rounded-xl shadow-2xl w-full max-w-2xl border border-orange-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-orange-800 flex justify-between items-start sticky top-0 bg-theme-secondary z-10">
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2">
              {isWeapon && <Sword className="w-6 h-6 text-accent-red-light" />}
              {isArmor && <Shield className="w-6 h-6 text-accent-blue-light" />}
              {isGear && <Package className="w-6 h-6 text-accent-yellow-light" />}
               <h3 className="text-2xl font-bold text-orange-400">{equipmentData.name}</h3>
             </div>
             <div className="flex items-center gap-3 text-sm text-theme-muted">
               <span className="bg-theme-tertiary px-2 py-1 rounded">{equipmentData.equipment_category}</span>
               <span className="bg-theme-tertiary px-2 py-1 rounded">SRD {equipmentData.year}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-white transition-colors ml-4"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          {equipmentData.description && (
            <div className="mb-6">
              <h4 className="text-lg font-bold text-orange-400 mb-2">Description</h4>
              <p className="text-theme-tertiary leading-relaxed whitespace-pre-wrap">{equipmentData.description}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-theme-tertiary/50 p-3 rounded">
              <div className="text-xs text-theme-muted mb-1">Cost</div>
              <div className="text-lg font-bold text-accent-yellow-light">
                {equipmentData.cost?.quantity} {equipmentData.cost?.unit}
              </div>
            </div>
            <div className="bg-theme-tertiary/50 p-3 rounded">
              <div className="text-xs text-theme-muted mb-1">Weight</div>
              <div className="text-lg font-bold text-white">{equipmentData.weight} lb</div>
            </div>
          </div>

          {/* Weapon Stats */}
          {isWeapon && (
            <div>
              <h4 className="text-lg font-bold text-red-300 mb-3">Weapon Properties</h4>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-theme-tertiary/50 p-3 rounded">
                    <div className="text-xs text-theme-muted mb-1">Category</div>
                    <div className="text-sm font-bold text-white">
                      {equipmentData.weapon_category} {equipmentData.weapon_range}
                    </div>
                  </div>
                  {equipmentData.damage && (
                    <div className="bg-theme-tertiary/50 p-3 rounded">
                      <div className="text-xs text-theme-muted mb-1">Damage</div>
                      <div className="text-sm font-bold text-green-300">
                        {equipmentData.damage.damage_dice} {equipmentData.damage.damage_type}
                      </div>
                    </div>
                  )}
                </div>

                {equipmentData.two_handed_damage && (
                  <div className="bg-theme-tertiary/50 p-3 rounded">
                    <div className="text-xs text-theme-muted mb-1">Two-Handed Damage</div>
                    <div className="text-sm font-bold text-green-300">
                      {equipmentData.two_handed_damage.damage_dice} {equipmentData.two_handed_damage.damage_type}
                    </div>
                  </div>
                )}

                {equipmentData.range && (
                  <div className="bg-theme-tertiary/50 p-3 rounded">
                    <div className="text-xs text-theme-muted mb-1">Range</div>
                    <div className="text-sm font-bold text-blue-300">
                      {equipmentData.range.normal} ft{equipmentData.range.long && ` / ${equipmentData.range.long} ft`}
                    </div>
                  </div>
                )}

                {equipmentData.properties && equipmentData.properties.length > 0 && (
                  <div className="bg-theme-tertiary/50 p-3 rounded">
                    <div className="text-xs text-theme-muted mb-1">Properties</div>
                     <div className="flex flex-wrap gap-1">
                       {equipmentData.properties.map((prop, idx: number) => (
                         <span key={idx} className="text-xs bg-accent-blue/70 text-white px-2 py-1 rounded">
                           {prop.name}
                         </span>
                       ))}
                    </div>
                  </div>
                )}

                {equipmentData.mastery && (
                  <div className="bg-theme-tertiary/50 p-3 rounded">
                    <div className="text-xs text-theme-muted mb-1">Weapon Mastery</div>
                     <div className="text-sm font-bold text-purple-300">{equipmentData.mastery.name}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Armor Stats */}
          {isArmor && (
            <div>
              <h4 className="text-lg font-bold text-blue-300 mb-3">Armor Properties</h4>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-theme-tertiary/50 p-3 rounded">
                    <div className="text-xs text-theme-muted mb-1">Category</div>
                    <div className="text-sm font-bold text-white">{equipmentData.armor_category} Armor</div>
                  </div>
                  {equipmentData.armor_class && (
                    <div className="bg-theme-tertiary/50 p-3 rounded">
                      <div className="text-xs text-theme-muted mb-1">Armor Class</div>
                      <div className="text-sm font-bold text-green-300">
                        {equipmentData.armor_class.base}
                        {equipmentData.armor_class.dex_bonus && (
                          <span> + DEX{equipmentData.armor_class.max_bonus && ` (max +${equipmentData.armor_class.max_bonus})`}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {equipmentData.str_minimum && equipmentData.str_minimum > 0 && (
                  <div className="bg-yellow-900/30 p-3 rounded border border-accent-yellow-dark">
                    <div className="text-xs text-accent-yellow-light mb-1">Strength Requirement</div>
                    <div className="text-sm font-bold text-accent-yellow-light">STR {equipmentData.str_minimum}</div>
                  </div>
                )}

                {equipmentData.stealth_disadvantage && (
                  <div className="bg-red-900/30 p-3 rounded border border-accent-red-dark">
                    <div className="text-sm font-bold text-red-300">Stealth Disadvantage</div>
                    <div className="text-xs text-theme-muted">This armor imposes disadvantage on Stealth checks</div>
                  </div>
                )}

                {equipmentData.don_time && (
                  <div className="bg-blue-900/30 p-3 rounded border border-accent-blue-dark">
                    <div className="text-xs text-accent-blue-light mb-1">Don Time</div>
                    <div className="text-sm font-bold text-blue-300">{equipmentData.don_time}</div>
                  </div>
                )}

                {equipmentData.doff_time && (
                  <div className="bg-blue-900/30 p-3 rounded border border-accent-blue-dark">
                    <div className="text-xs text-accent-blue-light mb-1">Doff Time</div>
                    <div className="text-sm font-bold text-blue-300">{equipmentData.doff_time}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Container Contents */}
          {equipmentData.contents && equipmentData.contents.length > 0 && (
            <div className="bg-purple-900/30 p-3 rounded border border-accent-purple-dark">
              <div className="text-xs text-accent-purple-light mb-2">Contents</div>
              <div className="space-y-1">
                {equipmentData.contents.map((item: { item_name: string; quantity: number }, idx: number) => (
                  <div key={idx} className="text-sm text-theme-tertiary">
                    {item.item_name} (×{item.quantity})
                  </div>
                ))}
              </div>
            </div>
          )}

          {equipmentData.capacity && (
            <div className="bg-indigo-900/30 p-3 rounded border border-indigo-700">
              <div className="text-xs text-indigo-400 mb-1">Capacity</div>
              <div className="text-sm font-bold text-indigo-300">{equipmentData.capacity}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
