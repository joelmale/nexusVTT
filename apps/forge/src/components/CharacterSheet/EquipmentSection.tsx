import React from 'react';
import { Box, Plus } from 'lucide-react';
import { Character, Equipment } from '../../types/dnd';
import { loadEquipment } from '../../services/dataService';
import { EquipmentModal } from './EquipmentModal';
import { EquipmentManagerModal } from './EquipmentManagerModal';
import { canEquipItem } from '../../utils/equipmentValidation';

interface EquipmentSectionProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
  onEquipArmor: (characterId: string, armorSlug: string) => void;
  onEquipWeapon: (characterId: string, weaponSlug: string) => void;
  onUnequipItem: (characterId: string, itemSlug: string) => void;
  onAddItem: (characterId: string, equipmentSlug: string, quantity?: number) => void;
  onRemoveItem: (characterId: string, equipmentSlug: string, quantity?: number) => void;
  setEquipmentModal: (item: Equipment | null) => void;
  layoutMode?: 'paper-sheet' | 'classic-dnd' | 'modern';
}

export const EquipmentSection: React.FC<EquipmentSectionProps> = ({
  character,
  onUpdateCharacter: _onUpdateCharacter,
  onEquipArmor,
  onEquipWeapon,
  onUnequipItem,
  onAddItem,
  onRemoveItem,
  setEquipmentModal: _setEquipmentModal,
  layoutMode = 'modern',
}) => {
  const equipmentData = React.useMemo(() => loadEquipment(), []);
  const [selectedEquipment, setSelectedEquipment] = React.useState<Equipment | null>(null);
  const [equipError, setEquipError] = React.useState<string>('');
  const [equipmentManagerOpen, setEquipmentManagerOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'weapons' | 'armor' | 'gear' | 'equipped'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleEquipmentClick = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setEquipError('');
  };

  const handleEquipFromModal = () => {
    if (!selectedEquipment) return;

    const validation = canEquipItem(character, selectedEquipment);
    if (!validation.canEquip) {
      setEquipError(validation.reason || 'Cannot equip this item');
      return;
    }

    if (selectedEquipment.equipment_category === 'Armor') {
      onEquipArmor(character.id, selectedEquipment.slug);
    } else if (selectedEquipment.equipment_category === 'Weapon') {
      onEquipWeapon(character.id, selectedEquipment.slug);
    }

    setSelectedEquipment(null);
    setEquipError('');
  };

  const handleUnequipFromModal = () => {
    if (!selectedEquipment) return;

    onUnequipItem(character.id, selectedEquipment.slug);
    setSelectedEquipment(null);
    setEquipError('');
  };

  // Filter inventory items
  const filteredInventory = (character.inventory || [])
    .filter(item => {
      const equipment = equipmentData.find(eq => eq.slug === item.equipmentSlug);
      if (!equipment) return false;
      switch (filter) {
        case 'weapons':
          return equipment.equipment_category === 'Weapon';
        case 'armor':
          return equipment.equipment_category === 'Armor';
        case 'gear':
          return equipment.equipment_category === 'Adventuring Gear' || equipment.equipment_category === 'Tools';
        case 'equipped':
          return (
            item.equipped ||
            character.equippedArmor === item.equipmentSlug ||
            character.equippedWeapons?.includes(item.equipmentSlug)
          );
        default:
          return true;
      }
    })
    .filter(item => {
      if (!searchTerm.trim()) return true;
      const equipment = equipmentData.find(eq => eq.slug === item.equipmentSlug);
      const haystack = `${equipment?.name || item.equipmentSlug} ${equipment?.equipment_category || ''}`.toLowerCase();
      return haystack.includes(searchTerm.toLowerCase());
    });

  // Determine color scheme based on layout mode
  const isPaperSheet = layoutMode === 'paper-sheet';
  const bgSecondaryClass = isPaperSheet ? 'bg-[#fcf6e3]' : 'bg-theme-secondary';
  const bgTertiaryClass = isPaperSheet ? 'bg-[#f5ebd2]' : 'bg-theme-tertiary/50';
  const hoverBgClass = isPaperSheet ? 'hover:bg-[#ebe1c8]' : 'hover:bg-theme-tertiary';
  const textPrimaryClass = isPaperSheet ? 'text-[#1e140a]' : 'text-theme-primary';
  const textMutedClass = isPaperSheet ? 'text-[#3d2817]' : 'text-theme-muted';
  const textDisabledClass = isPaperSheet ? 'text-[#8b7355]' : 'text-theme-disabled';

  const totalWeight =
    (character.inventory || []).reduce((sum, item) => {
      const eq = equipmentData.find(eq => eq.slug === item.equipmentSlug);
      const wt = eq?.weight || 0;
      return sum + wt * (item.quantity || 0);
    }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-theme-border">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-accent-yellow" />
          <h2 className="text-xl font-bold">Inventory</h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-semibold">
          <span className={textMutedClass}>Loadout</span>
          <span className="px-2 py-1 rounded-full bg-theme-tertiary/40 text-xs">
            {totalWeight} lb
          </span>
        </div>
      </div>

      <div className={`p-4 ${bgSecondaryClass} rounded-xl shadow-lg border border-theme-border`}>
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-lg font-bold text-orange-500">
            Inventory ({character.inventory?.length || 0} items)
          </h3>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <input
              type="text"
              placeholder="Search items..."
              className={`px-3 py-2 rounded-lg border ${textPrimaryClass} ${bgTertiaryClass} ${hoverBgClass} focus:outline-none focus:ring-2 focus:ring-accent-blue/60 text-sm w-full md:w-56`}
              onChange={(e) => setSearchTerm(e.target.value)}
              value={searchTerm}
            />
            <button
              onClick={() => setEquipmentManagerOpen(true)}
              className="px-3 py-2 bg-accent-blue hover:bg-accent-blue-light text-white rounded-lg flex items-center gap-2 transition-colors"
              title="Add items to inventory"
            >
              <Plus className="w-4 h-4" />
              Add Items
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { key: 'all' as const, label: 'All', count: character.inventory?.length || 0 },
            { key: 'equipped' as const, label: 'Equipped', count: character.inventory?.filter(item =>
              item.equipped ||
              character.equippedArmor === item.equipmentSlug ||
              character.equippedWeapons?.includes(item.equipmentSlug)
            ).length || 0 },
            { key: 'weapons' as const, label: 'Weapons', count: character.inventory?.filter(item => {
              const equipment = equipmentData.find(eq => eq.slug === item.equipmentSlug);
              return equipment?.equipment_category === 'Weapon';
            }).length || 0 },
            { key: 'armor' as const, label: 'Armor', count: character.inventory?.filter(item => {
              const equipment = equipmentData.find(eq => eq.slug === item.equipmentSlug);
              return equipment?.equipment_category === 'Armor';
            }).length || 0 },
            { key: 'gear' as const, label: 'Gear/Tools', count: character.inventory?.filter(item => {
              const equipment = equipmentData.find(eq => eq.slug === item.equipmentSlug);
              return equipment?.equipment_category === 'Adventuring Gear' || equipment?.equipment_category === 'Tools';
            }).length || 0 }
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-accent-blue text-white shadow-[0_4px_10px_rgba(37,99,235,0.35)]'
                  : `${bgTertiaryClass} ${textMutedClass} ${hoverBgClass}`
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {filteredInventory.length === 0 ? (
          <div className={`text-center py-8 ${textDisabledClass}`}>
            <Box className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">
              {filter === 'all' ? 'No items in inventory' : `No ${filter} items found`}
            </p>
            <p className="text-sm">
              {filter === 'all' ? 'Equipment is assigned during character creation' : 'Try a different filter'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredInventory.map((item, idx) => {
              const equipment = equipmentData.find(eq => eq.slug === item.equipmentSlug);
              const isWeapon = equipment?.weapon_category !== undefined;
              const isMastered = character.weaponMastery?.includes(item.equipmentSlug);
              const masteryProperty = equipment?.mastery;
              const itemWeight = (equipment?.weight || 0) * (item.quantity || 0);

              return (
                <div
                  key={idx}
                  className={`${bgTertiaryClass} p-3 rounded-lg ${hoverBgClass} transition-all border border-theme-border/60 shadow-sm`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-grow min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {equipment ? (
                          <button
                            onClick={() => handleEquipmentClick(equipment)}
                            className={`font-semibold ${textPrimaryClass} hover:text-orange-300 transition-colors text-left`}
                          >
                            {equipment.name}
                          </button>
                        ) : (
                          <span className={`font-semibold ${textPrimaryClass} text-left`}>
                            {item.trinket?.short_name || item.equipmentSlug}
                          </span>
                        )}
                        {item.equipped && <span className="text-[11px] bg-accent-green/20 border border-accent-green/40 text-accent-green px-2 py-0.5 rounded">Equipped</span>}
                        {item.trinket && <span className="text-[11px] bg-purple-600/20 border border-purple-500/40 text-purple-100 px-2 py-0.5 rounded">Trinket</span>}
                        {isWeapon && isMastered && masteryProperty && (
                          <span
                            className="text-[11px] bg-amber-900/30 border border-amber-500/50 text-amber-200 px-2 py-0.5 rounded flex items-center gap-1"
                            title={`Mastery: ${masteryProperty.name}`}
                          >
                            ⚔️ {masteryProperty.name}
                          </span>
                        )}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border border-theme-border/60 ${textMutedClass}`}>
                          ×{item.quantity}
                        </span>
                      </div>
                      <div className={`text-xs ${textMutedClass} flex items-center gap-3 flex-wrap`}>
                        <span>{equipment?.equipment_category || 'Item'}</span>
                        <span>Weight: {itemWeight} lb</span>
                        {equipment?.weapon_range && <span>{equipment.weapon_range}</span>}
                        {equipment?.armor_category && <span>{equipment.armor_category}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex gap-1">
                        {/* Equip/Unequip buttons */}
                        {equipment && equipment.equipable && (
                          <>
                            {equipment.equipment_category === 'Armor' && equipment.armor_category !== 'Shield' && (
                              <button
                                onClick={() => {
                                  if (item.equipped) {
                                    onUnequipItem(character.id, item.equipmentSlug);
                                  } else {
                                    onEquipArmor(character.id, item.equipmentSlug);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                  item.equipped
                                    ? 'bg-accent-red hover:bg-accent-red-light text-white'
                                    : 'bg-accent-green hover:bg-accent-green-dark text-white'
                                }`}
                                title={item.equipped ? 'Unequip armor' : 'Equip armor'}
                              >
                                {item.equipped ? 'Unequip' : 'Equip'}
                              </button>
                            )}
                            {equipment.equipment_category === 'Weapon' && (
                              <button
                                onClick={() => {
                                  if (item.equipped) {
                                    onUnequipItem(character.id, item.equipmentSlug);
                                  } else {
                                    onEquipWeapon(character.id, item.equipmentSlug);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                  item.equipped
                                    ? 'bg-accent-red hover:bg-accent-red-light text-white'
                                    : 'bg-accent-blue hover:bg-accent-blue-dark text-white'
                                }`}
                                title={item.equipped ? 'Unequip weapon' : 'Equip weapon'}
                              >
                                {item.equipped ? 'Unequip' : 'Equip'}
                              </button>
                            )}
                            {equipment.armor_category === 'Shield' && (
                              <button
                                onClick={() => {
                                  if (item.equipped) {
                                    onUnequipItem(character.id, item.equipmentSlug);
                                  } else {
                                    onEquipWeapon(character.id, item.equipmentSlug);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                  item.equipped
                                    ? 'bg-accent-red hover:bg-accent-red-light text-white'
                                    : 'bg-accent-purple hover:bg-accent-purple-dark text-white'
                                }`}
                                title={item.equipped ? 'Unequip shield' : 'Equip shield'}
                              >
                                {item.equipped ? 'Unequip' : 'Equip'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {/* Quantity adjustment buttons */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onAddItem(character.id, item.equipmentSlug, 1)}
                            className="w-5 h-5 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center text-xs font-bold"
                            title="Add 1 to inventory"
                          >
                            +
                          </button>
                          <button
                            onClick={() => onRemoveItem(character.id, item.equipmentSlug, 1)}
                            className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded flex items-center justify-center text-xs font-bold"
                            title={item.quantity > 1 ? 'Use/consume 1 (reduce quantity)' : 'Remove from inventory'}
                          >
                            −
                          </button>
                        </div>
                        <div className={`text-xs ${textMutedClass} text-center`}>
                          {item.quantity > 1 ? 'Use' : 'Remove'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EquipmentModal
        equipment={selectedEquipment}
        isOpen={selectedEquipment !== null}
        onClose={() => {
          setSelectedEquipment(null);
          setEquipError('');
        }}
        onEquip={selectedEquipment && selectedEquipment.equipable ? handleEquipFromModal : undefined}
        onUnequip={
          selectedEquipment &&
          selectedEquipment.equipable &&
          (character.equippedArmor === selectedEquipment.slug || character.equippedWeapons?.includes(selectedEquipment.slug))
            ? handleUnequipFromModal
            : undefined
        }
        canEquip={selectedEquipment ? canEquipItem(character, selectedEquipment).canEquip : true}
        equipError={equipError}
      />

      <EquipmentManagerModal
        isOpen={equipmentManagerOpen}
        onClose={() => setEquipmentManagerOpen(false)}
        character={character}
        onAddItems={(items) => {
          items.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
              onAddItem(character.id, item.equipmentSlug, 1);
            }
          });
          setEquipmentManagerOpen(false);
        }}
      />
    </div>
  );
};
