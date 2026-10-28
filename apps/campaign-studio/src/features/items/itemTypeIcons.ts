import type { LucideIcon } from 'lucide-react';
import Box from 'lucide-react/dist/esm/icons/box';
import Crosshair from 'lucide-react/dist/esm/icons/crosshair';
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical';
import Gem from 'lucide-react/dist/esm/icons/gem';
import Package from 'lucide-react/dist/esm/icons/package';
import Scroll from 'lucide-react/dist/esm/icons/scroll';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Sword from 'lucide-react/dist/esm/icons/sword';
import Wand2 from 'lucide-react/dist/esm/icons/wand-2';
import Wrench from 'lucide-react/dist/esm/icons/wrench';

/**
 * Returns the canonical Lucide icon component corresponding to an item category.
 * Uses direct ESM path imports to preserve tree-shaking and Vite fast-refresh performance.
 */
export function getItemTypeIcon(itemType: string): LucideIcon {
  switch (itemType) {
    case 'weapon':
      return Sword;
    case 'armor':
    case 'shield':
      return Shield;
    case 'ammunition':
      return Crosshair;
    case 'potion':
      return FlaskConical;
    case 'scroll':
      return Scroll;
    case 'wand':
    case 'rod':
    case 'staff':
      return Wand2;
    case 'ring':
      return Gem;
    case 'wondrous_item':
      return Sparkles;
    case 'adventuring_gear':
      return Package;
    case 'tool':
      return Wrench;
    default:
      return Box;
  }
}
