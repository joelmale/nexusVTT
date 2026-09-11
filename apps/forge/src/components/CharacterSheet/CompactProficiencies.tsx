import React from 'react';
import { Shield, Sword, Hammer, Languages } from 'lucide-react';
import { Character } from '../../types/dnd';

interface CompactProficienciesProps {
  character: Character;
  showLabels?: boolean;
  maxItems?: number; // Limit items shown, add "+X more" if exceeded
}

export const CompactProficiencies: React.FC<CompactProficienciesProps> = ({
  character,
  showLabels = true,
  maxItems = 3
}) => {
  const armor = character.proficiencies?.armor || [];
  const weapons = character.proficiencies?.weapons || [];
  const tools = character.proficiencies?.tools || [];
  const languages = character.languages || [];

  const formatList = (items: string[], max: number = maxItems) => {
    if (items.length === 0) return showLabels ? 'None' : '';
    if (items.length <= max) return items.join(', ');
    return `${items.slice(0, max).join(', ')} +${items.length - max} more`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {/* Armor */}
      <div className="flex items-center gap-1" title={`Armor: ${armor.join(', ') || 'None'}`}>
        <Shield className="w-3 h-3 text-blue-400" />
        {showLabels && <span className="text-theme-muted">Armor:</span>}
        <span className="text-theme-primary">{formatList(armor)}</span>
      </div>

      {/* Weapons */}
      <div className="flex items-center gap-1" title={`Weapons: ${weapons.join(', ') || 'None'}`}>
        <Sword className="w-3 h-3 text-red-400" />
        {showLabels && <span className="text-theme-muted">Weapons:</span>}
        <span className="text-theme-primary">{formatList(weapons)}</span>
      </div>

      {/* Tools (only show if present) */}
      {tools.length > 0 && (
        <div className="flex items-center gap-1" title={`Tools: ${tools.join(', ')}`}>
          <Hammer className="w-3 h-3 text-yellow-400" />
          {showLabels && <span className="text-theme-muted">Tools:</span>}
          <span className="text-theme-primary">{formatList(tools)}</span>
        </div>
      )}

      {/* Languages (only show if present) */}
      {languages.length > 0 && (
        <div className="flex items-center gap-1" title={`Languages: ${languages.join(', ')}`}>
          <Languages className="w-3 h-3 text-green-400" />
          {showLabels && <span className="text-theme-muted">Languages:</span>}
          <span className="text-theme-primary">{formatList(languages)}</span>
        </div>
      )}
    </div>
  );
};