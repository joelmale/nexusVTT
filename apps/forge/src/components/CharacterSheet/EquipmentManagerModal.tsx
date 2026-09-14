import React, { useState, useMemo } from 'react';
import { X, Search, Package, Sword, Shield, Wrench, Plus, Minus } from 'lucide-react';
import { Character, Equipment } from '../../types/dnd';
import { loadEquipment } from '../../services/dataService';

interface EquipmentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  onAddItems: (items: { equipmentSlug: string; quantity: number }[]) => void;
}

interface PendingItem {
  equipmentSlug: string;
  quantity: number;
  equipment: Equipment;
}

type EquipmentCategoryKey = 'all' | 'weapons' | 'armor' | 'gear' | 'tools';

export const EquipmentManagerModal: React.FC<EquipmentManagerModalProps> = ({
  isOpen,
  onClose,
  character,
  onAddItems
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategoryKey>('all');
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [tooltipData, setTooltipData] = useState<{
    presetName: string;
    items: { equipmentSlug: string; quantity: number }[];
    position: { x: number; y: number };
  } | null>(null);

  const allEquipment = useMemo(() => loadEquipment(), []);

  // Filter equipment based on search and category
  const filteredEquipment = useMemo(() => {
    return allEquipment.filter(equipment => {
      // Search filter
      const matchesSearch = equipment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           equipment.equipment_category.toLowerCase().includes(searchTerm.toLowerCase());

      // Category filter
      let matchesCategory = true;
      switch (selectedCategory) {
        case 'weapons':
          matchesCategory = equipment.equipment_category === 'Weapon';
          break;
        case 'armor':
          matchesCategory = equipment.equipment_category === 'Armor';
          break;
        case 'gear':
          matchesCategory = equipment.equipment_category === 'Adventuring Gear';
          break;
        case 'tools':
          matchesCategory = equipment.equipment_category === 'Tools';
          break;
        default:
          matchesCategory = true;
      }

      return matchesSearch && matchesCategory;
    });
  }, [allEquipment, searchTerm, selectedCategory]);

  // Get current inventory quantities
  const getCurrentQuantity = (equipmentSlug: string): number => {
    const item = character.inventory?.find(item => item.equipmentSlug === equipmentSlug);
    return item?.quantity || 0;
  };

  // Add item to pending list
  const addToPending = (equipment: Equipment) => {
    const existing = pendingItems.find(item => item.equipmentSlug === equipment.slug);
    if (existing) {
      setPendingItems(prev => prev.map(item =>
        item.equipmentSlug === equipment.slug
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setPendingItems(prev => [...prev, {
        equipmentSlug: equipment.slug,
        quantity: 1,
        equipment
      }]);
    }
  };

  // Update pending item quantity
  const updatePendingQuantity = (equipmentSlug: string, quantity: number) => {
    if (quantity <= 0) {
      setPendingItems(prev => prev.filter(item => item.equipmentSlug !== equipmentSlug));
    } else {
      setPendingItems(prev => prev.map(item =>
        item.equipmentSlug === equipmentSlug
          ? { ...item, quantity }
          : item
      ));
    }
  };

  // Add all pending items to inventory
  const addPendingItems = () => {
    if (pendingItems.length > 0) {
      onAddItems(pendingItems.map(item => ({
        equipmentSlug: item.equipmentSlug,
        quantity: item.quantity
      })));
      setPendingItems([]);
      onClose();
    }
  };

  // Quick add presets
  const quickAddPresets = {
    'Basic Adventuring Gear': [
      { equipmentSlug: 'backpack', quantity: 1 },
      { equipmentSlug: 'rations-1-day', quantity: 5 },
      { equipmentSlug: 'waterskin', quantity: 1 },
      { equipmentSlug: 'torch', quantity: 10 }
    ],
    'Common Loot': [
      { equipmentSlug: 'gold-piece', quantity: 25 },
      { equipmentSlug: 'shortsword', quantity: 1 },
      { equipmentSlug: 'leather', quantity: 1 }
    ],
    'Quest Reward': [
      { equipmentSlug: 'gold-piece', quantity: 50 },
      { equipmentSlug: 'potion-of-healing', quantity: 1 }
    ],
    "Delver's Pack": [
      { equipmentSlug: 'crowbar', quantity: 1 },
      { equipmentSlug: 'chalk-1-piece', quantity: 5 },
      { equipmentSlug: 'thieves-tools', quantity: 1 },
      { equipmentSlug: 'healers-kit', quantity: 1 },
      { equipmentSlug: 'signal-whistle', quantity: 1 }
    ],
    "Cheap Tricks Pack": [
      { equipmentSlug: 'ball-bearings', quantity: 1 },
      { equipmentSlug: 'caltrops', quantity: 20 }
    ],
    "Wilderness Survivor Kit": [
      { equipmentSlug: 'bedroll', quantity: 1 },
      { equipmentSlug: 'fishing-tackle', quantity: 1 },
      { equipmentSlug: 'hunting-trap', quantity: 1 },
      { equipmentSlug: 'antitoxin', quantity: 2 }
    ],
    "Urban Infiltrator Kit": [
      { equipmentSlug: 'manacles', quantity: 1 },
      { equipmentSlug: 'crowbar', quantity: 1 },
      { equipmentSlug: 'sealing-wax', quantity: 1 },
      { equipmentSlug: 'soap', quantity: 1 }
    ],
    "Vampire Hunter Kit": [
      { equipmentSlug: 'holy-water-flask', quantity: 5 },
      { equipmentSlug: 'dagger', quantity: 1 },
      { equipmentSlug: 'oil-flask', quantity: 5 },
      { equipmentSlug: 'healers-kit', quantity: 1 }
    ]
  };

  const applyQuickPreset = (presetName: string) => {
    const preset = quickAddPresets[presetName as keyof typeof quickAddPresets];
    if (preset) {
      onAddItems(preset);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-primary">
          <h2 className="text-2xl font-bold text-theme-primary">Equipment Manager</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[600px]">
          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Search and Filters */}
            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-muted w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search equipment..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-theme-tertiary border border-theme-primary rounded-lg text-theme-primary focus:border-accent-blue focus:outline-none"
                  />
                </div>
              </div>

              {/* Category Tabs */}
              <div className="flex gap-2 mb-4">
                {([
                  { key: 'all', label: 'All', icon: Package },
                  { key: 'weapons', label: 'Weapons', icon: Sword },
                  { key: 'armor', label: 'Armor', icon: Shield },
                  { key: 'gear', label: 'Gear', icon: Package },
                  { key: 'tools', label: 'Tools', icon: Wrench }
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      selectedCategory === key
                        ? 'bg-accent-blue text-white'
                        : 'bg-theme-tertiary text-theme-muted hover:bg-theme-hover'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {filteredEquipment.slice(0, 50).map(equipment => {
                const currentQty = getCurrentQuantity(equipment.slug);
                const pendingItem = pendingItems.find(item => item.equipmentSlug === equipment.slug);

                return (
                  <div key={equipment.slug} className="bg-theme-tertiary/50 p-4 rounded-lg border border-theme-primary">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-theme-primary text-sm">{equipment.name}</h3>
                        <p className="text-xs text-theme-muted capitalize">
                          {equipment.equipment_category}
                          {equipment.armor_category && ` • ${equipment.armor_category}`}
                          {equipment.weapon_category && ` • ${equipment.weapon_category}`}
                        </p>
                      </div>
                      {currentQty > 0 && (
                        <span className="text-xs bg-accent-green px-2 py-1 rounded">
                          Owned: {currentQty}
                        </span>
                      )}
                    </div>

                    {/* Equipment Details */}
                    <div className="text-xs text-theme-muted mb-3 space-y-1">
                      {equipment.cost && (
                        <div>Cost: {equipment.cost.quantity} {equipment.cost.unit.toUpperCase()}</div>
                      )}
                      {equipment.weight && (
                        <div>Weight: {equipment.weight} lbs</div>
                      )}
                      {equipment.damage && (
                        <div>Damage: {equipment.damage.damage_dice} {equipment.damage.damage_type}</div>
                      )}
                      {equipment.armor_class && (
                        <div>AC: {equipment.armor_class.base}</div>
                      )}
                    </div>

                    {/* Add Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => addToPending(equipment)}
                          className="px-3 py-1 bg-accent-green hover:bg-accent-green-dark text-white text-xs rounded transition-colors"
                        >
                          Add
                        </button>
                        {pendingItem && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updatePendingQuantity(equipment.slug, pendingItem.quantity - 1)}
                              className="w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded flex items-center justify-center text-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium min-w-[2rem] text-center">
                              {pendingItem.quantity}
                            </span>
                            <button
                              onClick={() => updatePendingQuantity(equipment.slug, pendingItem.quantity + 1)}
                              className="w-6 h-6 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center text-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredEquipment.length === 0 && (
              <div className="text-center py-8 text-theme-muted">
                No equipment found matching your search.
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-80 border-l border-theme-primary p-6 overflow-y-auto">
            {/* Pending Items */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-theme-primary mb-3">Items to Add</h3>
              {pendingItems.length > 0 ? (
                <div className="space-y-2">
                  {pendingItems.map(item => (
                    <div key={item.equipmentSlug} className="flex items-center justify-between bg-theme-tertiary/50 p-2 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-theme-primary">{item.equipment.name}</div>
                        <div className="text-xs text-theme-muted">×{item.quantity}</div>
                      </div>
                      <button
                        onClick={() => updatePendingQuantity(item.equipmentSlug, 0)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-theme-muted italic">No items selected</div>
              )}
            </div>

            {/* Quick Presets */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-theme-primary mb-3">Quick Add</h3>
              <div className="space-y-2">
                {Object.entries(quickAddPresets).map(([presetName, items]) => (
                  <button
                    key={presetName}
                    onClick={() => applyQuickPreset(presetName)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipData({
                        presetName,
                        items,
                        position: { x: rect.right + 10, y: rect.top }
                      });
                    }}
                    onMouseLeave={() => setTooltipData(null)}
                    className="w-full p-3 bg-theme-tertiary hover:bg-theme-hover rounded-lg text-left transition-colors"
                  >
                    <div className="font-medium text-theme-primary text-sm">{presetName}</div>
                    <div className="text-xs text-theme-muted mt-1">
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-theme-primary">
          <div className="text-sm text-theme-muted">
            {pendingItems.length > 0 && `${pendingItems.length} item${pendingItems.length !== 1 ? 's' : ''} ready to add`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-theme-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addPendingItems}
              disabled={pendingItems.length === 0}
              className={`px-4 py-2 rounded-lg text-white transition-colors ${
                pendingItems.length > 0
                  ? 'bg-accent-green hover:bg-accent-green-dark'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              Add to Inventory ({pendingItems.reduce((sum, item) => sum + item.quantity, 0)})
            </button>
          </div>
        </div>

        {/* Preset Tooltip */}
        {tooltipData && (
          <div
            className="fixed z-50 bg-theme-secondary border border-theme-primary rounded-lg shadow-lg p-3 max-w-xs"
            style={{
              left: tooltipData.position.x,
              top: tooltipData.position.y,
              pointerEvents: 'none'
            }}
          >
            <div className="text-sm font-medium text-theme-primary mb-2">{tooltipData.presetName}</div>
            <div className="space-y-1">
              {tooltipData.items.map((item, index) => {
                const equipment = allEquipment.find(eq => eq.slug === item.equipmentSlug);
                return (
                  <div key={index} className="text-xs text-theme-muted">
                    • {equipment?.name || item.equipmentSlug} ×{item.quantity}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
