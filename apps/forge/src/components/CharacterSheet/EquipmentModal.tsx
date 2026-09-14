import React from 'react';
import { X, Shield, Sword, Package, Heart, Eye } from 'lucide-react';
import { Equipment } from '../../types/dnd';

interface EquipmentModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onEquip?: () => void;
  onUnequip?: () => void;
  canEquip?: boolean;
  equipError?: string;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  equipment,
  isOpen,
  onClose,
  onEquip,
  onUnequip,
  canEquip = true,
  equipError
}) => {
  if (!isOpen || !equipment) return null;

  const getEquipmentIcon = (equipment: Equipment) => {
    if (equipment.equipment_category === 'Armor') {
      return equipment.armor_category === 'Shield' ? <Shield className="w-6 h-6" /> : <Shield className="w-6 h-6" />;
    }
    if (equipment.equipment_category === 'Weapon') {
      return <Sword className="w-6 h-6" />;
    }
    return <Package className="w-6 h-6" />;
  };

  const getEquipmentTypeColor = (equipment: Equipment) => {
    if (equipment.equipment_category === 'Armor') return 'text-blue-400';
    if (equipment.equipment_category === 'Weapon') return 'text-red-400';
    return 'text-green-400';
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-primary">
          <div className="flex items-center gap-3">
            <div className={getEquipmentTypeColor(equipment)}>
              {getEquipmentIcon(equipment)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-theme-primary">{equipment.name}</h2>
              <p className="text-sm text-theme-muted capitalize">
                {equipment.equipment_category}
                {equipment.armor_category && ` • ${equipment.armor_category}`}
                {equipment.weapon_category && ` • ${equipment.weapon_category}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {equipment.cost && (
              <div className="bg-theme-tertiary/50 p-3 rounded-lg">
                <div className="text-xs font-semibold text-theme-muted uppercase">Cost</div>
                <div className="text-lg font-bold text-theme-primary">
                  {equipment.cost.quantity} {equipment.cost.unit.toUpperCase()}
                </div>
              </div>
            )}
            {equipment.weight && (
              <div className="bg-theme-tertiary/50 p-3 rounded-lg">
                <div className="text-xs font-semibold text-theme-muted uppercase">Weight</div>
                <div className="text-lg font-bold text-theme-primary">{equipment.weight} lbs</div>
              </div>
            )}
            {equipment.armor_class && (
              <div className="bg-theme-tertiary/50 p-3 rounded-lg">
                <div className="text-xs font-semibold text-theme-muted uppercase">AC</div>
                <div className="text-lg font-bold text-theme-primary">
                  {equipment.armor_class.base}
                  {equipment.armor_class.dex_bonus && ' + DEX'}
                  {equipment.armor_class.max_bonus && ` (max +${equipment.armor_class.max_bonus})`}
                </div>
              </div>
            )}
            {equipment.damage && (
              <div className="bg-theme-tertiary/50 p-3 rounded-lg">
                <div className="text-xs font-semibold text-theme-muted uppercase">Damage</div>
                <div className="text-lg font-bold text-theme-primary">
                  {equipment.damage.damage_dice}
                  {equipment.damage.damage_type && ` ${equipment.damage.damage_type}`}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {equipment.description && (
            <div className="bg-theme-tertiary/50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Description</h3>
              <p className="text-sm text-theme-primary leading-relaxed">{equipment.description}</p>
            </div>
          )}

          {/* Contents (for equipment packs) */}
          {equipment.contents && equipment.contents.length > 0 && (
            <div className="bg-theme-tertiary/50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Contents</h3>
              <div className="space-y-1">
                {equipment.contents.map((content, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-theme-primary">{content.item_name}</span>
                    <span className="text-theme-muted">×{content.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Special Properties */}
          {(equipment.properties || equipment.mastery || equipment.str_minimum || equipment.stealth_disadvantage) && (
            <div className="bg-theme-tertiary/50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-theme-muted uppercase mb-3">Properties</h3>
              <div className="space-y-2">
                {equipment.properties && equipment.properties.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-theme-muted uppercase mb-1">Special</div>
                    <div className="flex flex-wrap gap-1">
                      {equipment.properties.map((prop, idx) => (
                        <span key={idx} className="px-2 py-1 bg-accent-blue/20 text-accent-blue text-xs rounded">
                          {prop.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {equipment.mastery && (
                  <div>
                    <div className="text-xs font-semibold text-theme-muted uppercase mb-1">Weapon Mastery</div>
                    <span className="px-2 py-1 bg-amber-900/50 border border-amber-500/50 text-amber-300 text-xs rounded">
                      ⚔️ {equipment.mastery.name}
                    </span>
                  </div>
                )}
                {equipment.str_minimum && (
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-theme-primary">
                      Requires Strength {equipment.str_minimum}
                    </span>
                  </div>
                )}
                {equipment.stealth_disadvantage && (
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-theme-primary">
                      Disadvantage on Stealth checks
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Requirements & Restrictions */}
          {(equipment.str_minimum || equipment.stealth_disadvantage) && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-yellow-400 uppercase mb-2">Requirements & Restrictions</h3>
              <div className="space-y-1 text-sm text-theme-primary">
                {equipment.str_minimum && (
                  <div>• Strength {equipment.str_minimum} required</div>
                )}
                {equipment.stealth_disadvantage && (
                  <div>• Disadvantage on Stealth checks</div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {equipError && (
            <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-300">{equipError}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center p-6 border-t border-theme-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white transition-colors"
          >
            Close
          </button>

          <div className="flex gap-3">
            {onUnequip && (
              <button
                onClick={onUnequip}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Unequip
              </button>
            )}
            {onEquip && (
              <button
                onClick={onEquip}
                disabled={!canEquip}
                className={`px-4 py-2 rounded-lg text-white transition-colors ${
                  canEquip
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
              >
                {canEquip ? 'Equip' : 'Cannot Equip'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};