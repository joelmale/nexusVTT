import React from 'react';
import { Languages } from 'lucide-react';
import { Character } from '../../types/dnd';
import { LANGUAGES } from '../../data/languages';

interface LanguagesPanelProps {
  character: Character;
}

export const LanguagesPanel: React.FC<LanguagesPanelProps> = ({
  character,
}) => {
  const getLanguageDescription = (languageName: string): string => {
    const language = LANGUAGES.find(lang => lang.name === languageName);
    if (language) {
      return `${language.name}\n\n${language.description}\n\nTypically spoken by: ${language.typicalSpeakers}\n\nCategory: ${language.category}`;
    }
    return `${languageName}\n\nA language spoken in the world of Dungeons & Dragons.`;
  };

  return (
    <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <Languages className="w-4 h-4 text-accent-blue-light" />
        <span className="text-sm font-semibold text-blue-300">Languages</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {character.languages && character.languages.length > 0 ? (
          character.languages.map((language, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-accent-green-dark text-theme-primary text-xs rounded cursor-help"
              title={getLanguageDescription(language)}
            >
              {language}
            </span>
          ))
        ) : (
          <span className="text-xs text-theme-muted">None</span>
        )}
      </div>
    </div>
  );
};