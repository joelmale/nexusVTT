import React from 'react';
import { Check, X, Package } from 'lucide-react';
import { generateQuickStartEquipment, getEquipmentBySlug } from '../../../services/equipmentService';
import { QuickStartItem } from '../../../types/equipment';

interface QuickStartEquipmentProps {
  classSlug: string;
  backgroundName: string;
  onAccept: () => void;
  onBuyInstead: () => void;
  onCancel?: () => void;
}

export const QuickStartEquipment: React.FC<QuickStartEquipmentProps> = ({
  classSlug,
  backgroundName,
  onAccept,
  onBuyInstead,
  onCancel
}) => {
  const equipment = generateQuickStartEquipment(classSlug, backgroundName);

  const getItemDisplayName = (item: QuickStartItem): string => {
    const equipmentData = getEquipmentBySlug(item.equipmentSlug);
    return equipmentData?.name || item.equipmentSlug;
  };

  const getItemDescription = (item: QuickStartItem): string => {
    const equipmentData = getEquipmentBySlug(item.equipmentSlug);
    return equipmentData?.description || '';
  };

  const equippedItems = equipment.items.filter(item => item.equipped);
  const unequippedItems = equipment.items.filter(item => !item.equipped);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Package className="w-12 h-12 text-accent-yellow-light mx-auto mb-4" />
        <h3 className="text-xl font-bold text-accent-yellow-light mb-2">
          Recommended Equipment Loadout
        </h3>
        <p className="text-sm text-theme-tertiary">
          This curated set of equipment will give your character a strong start.
          You can accept it as-is or choose to buy equipment instead.
        </p>
      </div>

      {/* Currency */}
      {(equipment.currency.gp > 0 || equipment.currency.sp > 0 || equipment.currency.cp > 0) && (
        <div className="bg-accent-yellow-darker/20 border border-accent-yellow-dark rounded-lg p-4">
          <h4 className="font-semibold text-accent-yellow-light mb-2">Starting Currency</h4>
          <div className="flex gap-4">
            {equipment.currency.gp > 0 && (
              <span className="text-accent-yellow-light font-medium">
                {equipment.currency.gp} gp
              </span>
            )}
            {equipment.currency.sp > 0 && (
              <span className="text-theme-tertiary">
                {equipment.currency.sp} sp
              </span>
            )}
            {equipment.currency.cp > 0 && (
              <span className="text-theme-tertiary">
                {equipment.currency.cp} cp
              </span>
            )}
          </div>
        </div>
      )}

      {/* Equipped Items */}
      {equippedItems.length > 0 && (
        <div>
          <h4 className="font-semibold text-accent-green-light mb-3 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Equipped Items
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {equippedItems.map((item, idx) => (
              <div key={idx} className="bg-accent-green-darker/20 border border-accent-green-dark rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-accent-green-light">
                      {getItemDisplayName(item)}
                      {item.quantity > 1 && (
                        <span className="text-sm text-theme-muted ml-1">x{item.quantity}</span>
                      )}
                    </div>
                    {item.slot && (
                      <div className="text-xs text-accent-green-light/70 mt-1">
                        {item.slot.replace('_', ' ')}
                      </div>
                    )}
                    {getItemDescription(item) && (
                      <div className="text-xs text-theme-tertiary mt-1">
                        {getItemDescription(item)}
                      </div>
                    )}
                  </div>
                  <Check className="w-4 h-4 text-accent-green-light flex-shrink-0 ml-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unequipped Items */}
      {unequippedItems.length > 0 && (
        <div>
          <h4 className="font-semibold text-theme-secondary mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Additional Items
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unequippedItems.map((item, idx) => (
              <div key={idx} className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-3">
                <div className="font-medium text-theme-primary">
                  {getItemDisplayName(item)}
                  {item.quantity > 1 && (
                    <span className="text-sm text-theme-muted ml-1">x{item.quantity}</span>
                  )}
                </div>
                {getItemDescription(item) && (
                  <div className="text-xs text-theme-tertiary mt-1">
                    {getItemDescription(item)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-theme-primary">
        <button
          onClick={onAccept}
          className="flex-1 px-6 py-3 bg-accent-green hover:bg-accent-green-dark rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          Accept Loadout
        </button>

        <button
          onClick={onBuyInstead}
          className="flex-1 px-6 py-3 bg-accent-blue hover:bg-accent-blue-dark rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Package className="w-4 h-4" />
          Buy Equipment Instead
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white transition-colors flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};