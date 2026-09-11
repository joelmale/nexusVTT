import React from 'react';
import { Shield, Sword, Hammer, Languages } from 'lucide-react';
import { LANGUAGES } from '../../data/languages';
import { loadClasses, BACKGROUNDS } from '../../services/dataService';
import { Character } from '../../types/dnd';

interface ProficienciesAndLanguagesProps {
  character: Character;
}

export const ProficienciesAndLanguages: React.FC<ProficienciesAndLanguagesProps> = ({
  character,
}) => {
  const classData = React.useMemo(
    () => loadClasses().find(cls => cls.slug === character.classSlug || cls.name === character.class),
    [character.classSlug, character.class]
  );
  const backgroundData = React.useMemo(
    () => BACKGROUNDS.find(bg => bg.slug === character.background || bg.name === character.background),
    [character.background]
  );

  // Use real proficiency data from character
  const armorProficiencies = character.proficiencies?.armor?.length
    ? character.proficiencies.armor
    : classData?.proficiencies?.armor || [];
  const weaponProficiencies = character.proficiencies?.weapons?.length
    ? character.proficiencies.weapons
    : classData?.proficiencies?.weapons || [];
  const instrumentProficiencies = character.featuresAndTraits?.musicalInstrumentProficiencies || [];
  const baseTools = character.proficiencies?.tools?.length
    ? character.proficiencies.tools
    : Array.from(new Set([...(classData?.proficiencies?.tools || []), ...(backgroundData?.tool_proficiencies || [])]));
  const toolProficiencies = instrumentProficiencies.length
    ? Array.from(
        new Set([
          ...baseTools.filter(tool => !tool.toLowerCase().includes('musical instrument')),
          ...instrumentProficiencies,
        ])
      )
    : baseTools;
  const languages = ['Common', ...(character.languages || []).filter(lang => lang !== 'Common')];

  const getLanguageDescription = (languageName: string): string => {
    const language = LANGUAGES.find(lang => lang.name === languageName);
    if (language) {
      return `${language.name}\n\n${language.description}\n\nTypically spoken by: ${language.typicalSpeakers}\n\nCategory: ${language.category}`;
    }
    return `${languageName}\n\nA language spoken in the world of Dungeons & Dragons.`;
  };

  return (
    <div className="bg-emerald-900 rounded-xl shadow-lg border-l-4 border-yellow-500 p-4">
      <h3 className="text-lg font-bold text-accent-yellow-light mb-4">Proficiencies & Languages</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Armor Proficiencies */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-semibold">Armor</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {armorProficiencies.map((proficiency, index) => (
              <span key={index} className="px-2 py-1 bg-blue-700 text-theme-primary text-xs rounded">
                {proficiency}
              </span>
            ))}
          </div>
        </div>

        {/* Weapon Proficiencies */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <Sword className="w-4 h-4" />
            <span className="text-sm font-semibold">Weapons</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {weaponProficiencies.map((proficiency, index) => (
              <span key={index} className="px-2 py-1 bg-blue-700 text-theme-primary text-xs rounded">
                {proficiency}
              </span>
            ))}
          </div>
        </div>

        {/* Tool Proficiencies */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <Hammer className="w-4 h-4" />
            <span className="text-sm font-semibold">Tools</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {toolProficiencies.map((proficiency, index) => (
              <span key={index} className="px-2 py-1 bg-blue-700 text-theme-primary text-xs rounded">
                {proficiency}
              </span>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <Languages className="w-4 h-4" />
            <span className="text-sm font-semibold">Languages</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {languages.map((language, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-accent-green-dark text-theme-primary text-xs rounded cursor-help"
                title={getLanguageDescription(language)}
              >
                {language}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-theme-primary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-theme-primary">{armorProficiencies.length}</div>
            <div className="text-xs text-theme-muted">Armor Proficiencies</div>
          </div>
          <div>
            <div className="text-lg font-bold text-theme-primary">{weaponProficiencies.length}</div>
            <div className="text-xs text-theme-muted">Weapon Proficiencies</div>
          </div>
          <div>
            <div className="text-lg font-bold text-theme-primary">{toolProficiencies.length}</div>
            <div className="text-xs text-theme-muted">Tool Proficiencies</div>
          </div>
          <div>
            <div className="text-lg font-bold text-theme-primary">{languages.length}</div>
            <div className="text-xs text-theme-muted">Languages</div>
          </div>
        </div>
      </div>
    </div>
  );
};
