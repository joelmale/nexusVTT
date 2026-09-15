// Quick Start Equipment Presets for Personality Wizard
export interface QuickStartItem {
  equipmentSlug: string;
  quantity: number;
  equipped?: boolean;
  slot?: 'main_hand' | 'off_hand' | 'two_handed' | 'armor' | 'belt';
}

export interface QuickStartPreset {
  label: string;
  items: QuickStartItem[];
  currency?: {
    gp: number;
    sp: number;
    cp: number;
  };
}

export interface QuickStartPresets {
  classes: Record<string, QuickStartPreset>;
  backgrounds: Record<string, QuickStartPreset>;
}

// Starting Wealth Rules for Buy Equipment Mode
export interface ClassWealthRule {
  class_id: string;
  dice_count: number;
  dice_sides: number;
  multiplier: number;
  average_gp: number;
}

// New Player Shop Items
export interface ShopItem {
  id: string;
  name: string;
  category: 'Armor' | 'Weapon' | 'Adventuring Gear';
  cost_gp: number;
  ac?: number; // Only for armor
  description?: string;
}

// Equipment Purchase Tracking
export interface PurchasedItem extends ShopItem {
  purchased: boolean;
  quantity: number;
}