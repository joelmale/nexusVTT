import React from 'react';
import Axe from 'lucide-react/dist/esm/icons/axe';
import Crown from 'lucide-react/dist/esm/icons/crown';
import Crosshair from 'lucide-react/dist/esm/icons/crosshair';
import Cross from 'lucide-react/dist/esm/icons/cross';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Flame from 'lucide-react/dist/esm/icons/flame';
import Footprints from 'lucide-react/dist/esm/icons/footprints';
import Hammer from 'lucide-react/dist/esm/icons/hammer';
import Leaf from 'lucide-react/dist/esm/icons/leaf';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Music from 'lucide-react/dist/esm/icons/music';
import Sword from 'lucide-react/dist/esm/icons/sword';
import Swords from 'lucide-react/dist/esm/icons/swords';
import WandSparkles from 'lucide-react/dist/esm/icons/wand-sparkles';

const GLYPH_PROPS = { size: 20, 'aria-hidden': true } as const;

const CLASS_GLYPHS: Array<[string, () => React.ReactElement]> = [
  ['artificer', () => <Hammer {...GLYPH_PROPS} />],
  ['barbarian', () => <Axe {...GLYPH_PROPS} />],
  ['bard', () => <Music {...GLYPH_PROPS} />],
  ['cleric', () => <Cross {...GLYPH_PROPS} />],
  ['druid', () => <Leaf {...GLYPH_PROPS} />],
  ['fighter', () => <Swords {...GLYPH_PROPS} />],
  ['monk', () => <Footprints {...GLYPH_PROPS} />],
  ['paladin', () => <Crown {...GLYPH_PROPS} />],
  ['ranger', () => <Crosshair {...GLYPH_PROPS} />],
  ['rogue', () => <Eye {...GLYPH_PROPS} />],
  ['sorcerer', () => <Flame {...GLYPH_PROPS} />],
  ['warlock', () => <Moon {...GLYPH_PROPS} />],
  ['wizard', () => <WandSparkles {...GLYPH_PROPS} />],
];

/** Glyph for a class name; unknown or missing classes get a plain sword. */
const renderClassGlyph = (klass?: string): React.ReactElement => {
  const key = klass?.toLowerCase() ?? '';
  const match = CLASS_GLYPHS.find(([name]) => key.includes(name));
  return match ? match[1]() : <Sword {...GLYPH_PROPS} />;
};

interface ClassCrestProps {
  klass?: string;
  className?: string;
}

/** Heraldic shield with the hero's class glyph. Purely decorative. */
export const ClassCrest: React.FC<ClassCrestProps> = ({
  klass,
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      className={`relative w-12 h-14 flex-shrink-0 ${className}`}
    >
      <svg viewBox="0 0 48 56" className="absolute inset-0 w-full h-full">
        <path
          d="M24 2L45 8v18c0 14-9.500 24-21 28C12.500 50 3 40 3 26V8z"
          fill="#362b21"
          stroke="#8c6b4a"
          strokeWidth="2.500"
        />
        <path
          d="M24 7L40 11.500V26c0 10.500-7 18.500-16 22-9-3.500-16-11.500-16-22V11.500z"
          fill="none"
          stroke="#d97706"
          strokeWidth="1"
          opacity="0.7"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pb-1 text-amber-400">
        {renderClassGlyph(klass)}
      </div>
    </div>
  );
};
