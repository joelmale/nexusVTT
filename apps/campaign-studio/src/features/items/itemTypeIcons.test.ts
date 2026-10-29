import { describe, expect, it } from 'vitest';
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

import { getItemTypeIcon } from './itemTypeIcons';

describe('getItemTypeIcon', () => {
  it('returns appropriate icon for each item category', () => {
    expect(getItemTypeIcon('weapon')).toBe(Sword);
    expect(getItemTypeIcon('armor')).toBe(Shield);
    expect(getItemTypeIcon('shield')).toBe(Shield);
    expect(getItemTypeIcon('ammunition')).toBe(Crosshair);
    expect(getItemTypeIcon('potion')).toBe(FlaskConical);
    expect(getItemTypeIcon('scroll')).toBe(Scroll);
    expect(getItemTypeIcon('wand')).toBe(Wand2);
    expect(getItemTypeIcon('rod')).toBe(Wand2);
    expect(getItemTypeIcon('staff')).toBe(Wand2);
    expect(getItemTypeIcon('ring')).toBe(Gem);
    expect(getItemTypeIcon('wondrous_item')).toBe(Sparkles);
    expect(getItemTypeIcon('adventuring_gear')).toBe(Package);
    expect(getItemTypeIcon('tool')).toBe(Wrench);
    expect(getItemTypeIcon('unknown-or-other')).toBe(Box);
  });
});
