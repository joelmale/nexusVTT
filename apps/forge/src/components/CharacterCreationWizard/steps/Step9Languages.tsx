import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronUp, ChevronDown, Shuffle } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import { BACKGROUNDS, randomizeLanguages } from '../../../services/dataService';
import {
  getMaxLanguages,
  parseBackgroundLanguageChoices,
  getSpeciesLanguages,
  getClassLanguages
} from '../../../utils/languageUtils';
import { getLanguagesByCategory, getSelectableLanguages } from '../../../data/languages';

const RandomizeButton: React.FC<{ onClick: () => void; title?: string; className?: string }> = ({
  onClick,
  title = "Randomize this section",
  className = ""
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2 ${className}`}
      title={title}
    >
      <Shuffle className="w-4 h-4" />
      Randomize
    </button>
  );
};

export const Step9Languages: React.FC<StepProps> = ({ data, updateData, nextStep, prevStep, getNextStepLabel }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Standard']));
  const selectedLanguages = data.knownLanguages || [];

  // Calculate auto-included languages
  const autoLanguages = new Set<string>();
  autoLanguages.add('Common'); // Always included

  // Add species languages
  getSpeciesLanguages(data.speciesSlug).forEach((lang: string) => autoLanguages.add(lang));

  // Add class languages (secret languages displayed as badges)
  const classLangs = getClassLanguages(data.classSlug);
  classLangs.forEach((lang: string) => autoLanguages.add(lang));

  // Get background language choices (2024 backgrounds don't grant languages)
  const background = BACKGROUNDS.find(bg => bg.slug === data.background || bg.name === data.background);
  const backgroundChoices = (data.edition === '2024')
    ? { direct: [], choices: 0 }
    : background ? parseBackgroundLanguageChoices(background.languages || []) : { direct: [], choices: 0 };

  // Add direct background languages
  backgroundChoices.direct.forEach((lang: string) => autoLanguages.add(lang));

  // Calculate remaining language slots
  const intelligenceScore = data.abilities.INT;
  const maxLanguages = getMaxLanguages(intelligenceScore);
  const totalAvailableSlots = maxLanguages + (data.edition === '2024' ? 0 : backgroundChoices.choices);
  const remainingSlots = Math.max(0, totalAvailableSlots - (autoLanguages.size + selectedLanguages.length));

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const handleLanguageToggle = (languageName: string) => {
    const newSelected = selectedLanguages.includes(languageName)
      ? selectedLanguages.filter(lang => lang !== languageName)
      : [...selectedLanguages, languageName];

    // Update the data
    updateData({ knownLanguages: newSelected });
  };

  // Validation for required background language selections
  const hasRequiredBackgroundSelections = data.edition === '2024' || selectedLanguages.length >= backgroundChoices.choices;

  const languageCategories = data.edition === '2024'
    ? [
        { name: 'Standard' as const, icon: '🏛️', description: 'PHB 2024 standard languages' },
        { name: 'Rare' as const, icon: '✨', description: 'PHB 2024 rare languages' }
      ]
    : [
        { name: 'Standard' as const, icon: '🏛️', description: 'Common languages of major civilizations' },
        { name: 'Exotic' as const, icon: '✨', description: 'Rare and mystical languages' },
        { name: 'Secret' as const, icon: '🔒', description: 'Hidden languages of specific groups' },
        { name: 'Dialect' as const, icon: '💬', description: 'Specialized dialects and elemental tongues' }
      ];

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h3 className='text-xl font-bold text-red-300'>Select Languages</h3>
        <RandomizeButton
          onClick={() => {
            const languages = randomizeLanguages(data.speciesSlug, data.background, data.edition, data.abilities);
            updateData({ knownLanguages: languages });
          }}
          title="Randomize language selection"
        />
      </div>

      {/* Language Limits Info */}
      <div className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-4">
        <h4 className="text-lg font-bold text-accent-yellow-light mb-2">Language Proficiency</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-theme-tertiary">Intelligence Score:</span>
            <span className="text-white font-bold ml-2">{intelligenceScore}</span>
          </div>
          <div>
            <span className="text-theme-tertiary">Maximum Languages:</span>
            <span className="text-white font-bold ml-2">{maxLanguages}</span>
          </div>
          <div>
            <span className="text-theme-tertiary">Languages Known:</span>
            <span className="text-white font-bold ml-2">{autoLanguages.size + selectedLanguages.length}</span>
          </div>
          <div>
            <span className="text-theme-tertiary">Remaining Slots:</span>
            <span className={`font-bold ml-2 ${remainingSlots > 0 ? 'text-accent-green-light' : 'text-accent-red-light'}`}>
              {remainingSlots}
            </span>
          </div>
        </div>
      </div>

      {/* Auto-Included Languages */}
      <div className="bg-accent-blue-darker/20 border border-accent-blue-dark rounded-lg p-4">
        <h4 className="text-lg font-bold text-blue-300 mb-3">Auto-Included Languages</h4>
        <p className="text-sm text-theme-muted mb-3">
          These languages are automatically known based on your species, class, and background choices.
        </p>
        <div className="flex flex-wrap gap-2">
          {Array.from(autoLanguages).sort().map(language => {
            const isSecret = language === "Thieves' Cant" || language === 'Druidic';
            return (
              <span
                key={language}
                className={`px-3 py-1 rounded-full text-sm ${isSecret ? 'bg-accent-purple text-white border border-purple-400' : 'bg-accent-blue-darker text-blue-100'}`}
              >
                {language}{isSecret ? ' (secret)' : ''}
              </span>
            );
          })}
        </div>
      </div>

      {/* Background Language Choices */}
      {backgroundChoices.choices > 0 && (
        <div className="bg-accent-purple-darker/20 border border-accent-purple-dark rounded-lg p-4">
          <h4 className="text-lg font-bold text-purple-300 mb-3">
            Background Choice: {backgroundChoices.choices} Language{backgroundChoices.choices > 1 ? 's' : ''} of Your Choice
          </h4>
          <p className="text-sm text-theme-muted mb-3">
            Your {data.background} background allows you to choose {backgroundChoices.choices} additional language{backgroundChoices.choices > 1 ? 's' : ''}.
          </p>
          <div className="text-sm text-accent-yellow-light">
            Selected: {selectedLanguages.length} / {backgroundChoices.choices}
          </div>
        </div>
      )}

      {/* Language Selection */}
      <div className="space-y-3">
        <h4 className="text-lg font-bold text-accent-yellow-light">Choose Additional Languages</h4>
        <p className="text-sm text-theme-muted">
          Select languages from the categories below. You can learn additional languages through feats, magic items, or DM approval.
        </p>

        {languageCategories.map(category => {
          const categoryLanguages = data.edition === '2024'
            ? getSelectableLanguages('2024', category.name === 'Rare' ? ['rare'] : ['standard'])
            : getLanguagesByCategory(category.name);
          const availableInCategory = categoryLanguages.filter(lang =>
            !autoLanguages.has(lang.name) && !selectedLanguages.includes(lang.name)
          );

          return (
            <div key={category.name} className='border border-theme-primary rounded-lg overflow-hidden'>
              <button
                onClick={() => toggleCategory(category.name)}
                className='w-full p-4 bg-theme-tertiary hover:bg-gray-650 flex items-center justify-between transition-colors'
              >
                <div className='flex items-center gap-3'>
                  <span className='text-2xl'>{category.icon}</span>
                  <div className='text-left'>
                    <div className='font-bold text-accent-yellow-light text-lg'>{category.name} Languages</div>
                    <div className='text-xs text-theme-muted'>{category.description}</div>
                  </div>
                </div>
                {expandedCategories.has(category.name) ? (
                  <ChevronUp className='w-5 h-5 text-theme-muted' />
                ) : (
                  <ChevronDown className='w-5 h-5 text-theme-muted' />
                )}
              </button>

              {expandedCategories.has(category.name) && (
                <div className='p-4 bg-theme-secondary/50'>
                  {availableInCategory.length === 0 ? (
                    <p className="text-theme-muted text-sm">No additional {category.name.toLowerCase()} languages available.</p>
                  ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                      {availableInCategory.map(language => {
                        const isSelected = selectedLanguages.includes(language.name);
                        const canSelect = remainingSlots > 0 || isSelected;

                        return (
                          <button
                            key={language.name}
                            onClick={() => canSelect && handleLanguageToggle(language.name)}
                            disabled={!canSelect && !isSelected}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              isSelected
                                ? 'bg-green-800 border-green-500'
                                : canSelect
                                ? 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
                                : 'bg-theme-secondary border-theme-secondary opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <div className="font-semibold text-white">{language.name}</div>
                            <div className="text-xs text-theme-muted mt-1">
                              {language.typicalSpeakers}
                            </div>
                            <div className="text-xs text-theme-disabled mt-1 line-clamp-2">
                              {language.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Languages Summary */}
      {selectedLanguages.length > 0 && (
        <div className="bg-accent-green-darker/20 border border-accent-green-dark rounded-lg p-4">
          <h4 className="text-lg font-bold text-green-300 mb-3">Selected Languages</h4>
          <div className="flex flex-wrap gap-2">
            {selectedLanguages.map(language => (
              <div key={language} className="flex items-center gap-2 px-3 py-1 bg-green-800 text-green-100 rounded-full text-sm">
                <span>{language}</span>
                <button
                  onClick={() => handleLanguageToggle(language)}
                  className="text-green-300 hover:text-white ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className='flex justify-between'>
        <button onClick={prevStep} className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <button
          onClick={nextStep}
          disabled={!hasRequiredBackgroundSelections}
          className={`px-4 py-2 rounded-lg text-white flex items-center ${
            hasRequiredBackgroundSelections
              ? 'bg-accent-red hover:bg-accent-red-light'
              : 'bg-theme-hover cursor-not-allowed'
          }`}
        >
          Next: {getNextStepLabel?.() || 'Continue'} <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};
