import { LANGUAGES } from '../data/languages';
import { getAllSpecies, BACKGROUNDS, getModifier, SPECIES_LANGUAGE_MAP } from '../services/dataService';
import { CharacterCreationData } from '../types/dnd';

export const calculateKnownLanguages = (data: CharacterCreationData): string[] => {
  const languages = new Set<string>();

  // Always include Common
  languages.add('Common');

  // Add species languages
  const speciesLanguages = getSpeciesLanguages(data.speciesSlug);
  speciesLanguages.forEach(lang => languages.add(lang));

  // Add background languages
  const backgroundLanguages = getBackgroundLanguages(data.background);
  backgroundLanguages.forEach(lang => languages.add(lang));

  // Add class languages (Thieves' Cant for Rogues, Druidic for Druids)
  const classLanguages = getClassLanguages(data.classSlug);
  classLanguages.forEach(lang => languages.add(lang));

  // Add selected languages
  if (data.knownLanguages) {
    data.knownLanguages.forEach(lang => languages.add(lang));
  }

  return Array.from(languages).sort();
};

export const getSpeciesLanguages = (speciesSlug: string): string[] => {
  const allSpecies = getAllSpecies();
  const species = allSpecies.find(s => s.slug === speciesSlug);

  if (!species) return [];

  return (SPECIES_LANGUAGE_MAP as Record<string, string[]>)[speciesSlug] || [];
};

/** @deprecated Use getSpeciesLanguages */
export const getRacialLanguages = getSpeciesLanguages;

export const getBackgroundLanguages = (backgroundName: string): string[] => {
  const background = BACKGROUNDS.find(bg => bg.name === backgroundName);

  if (!background || !background.languages) return [];

  const languages: string[] = [];

  background.languages.forEach(langChoice => {
    if (langChoice === 'Two of your choice') {
      // This will be handled in the UI - for calculation purposes, we assume choices are made
      // In a real implementation, we'd need to track background language choices
    } else if (langChoice === 'One of your choice') {
      // Same as above
    } else {
      // Direct language assignment
      languages.push(langChoice);
    }
  });

  return languages;
};

export const getClassLanguages = (classSlug: string): string[] => {
  const classLanguageMap: Record<string, string[]> = {
    'rogue': ['Thieves\' Cant'],
    'druid': ['Druidic']
  };

  return classLanguageMap[classSlug] || [];
};

export const getMaxLanguages = (intelligenceScore: number): number => {
  return 1 + Math.max(0, getModifier(intelligenceScore));
};

export const getAvailableLanguages = (currentLanguages: string[], category?: 'Standard' | 'Exotic' | 'Secret' | 'Dialect'): string[] => {
  let available = LANGUAGES.map(lang => lang.name);

  // Remove already known languages
  available = available.filter(lang => !currentLanguages.includes(lang));

  // Filter by category if specified
  if (category) {
    const categoryLanguages = LANGUAGES.filter(lang => lang.category === category).map(lang => lang.name);
    available = available.filter(lang => categoryLanguages.includes(lang));
  }

  return available.sort();
};

export const parseBackgroundLanguageChoices = (backgroundLanguages: string[]): { direct: string[], choices: number } => {
  const direct: string[] = [];
  let choices = 0;

  backgroundLanguages.forEach(lang => {
    if (lang === 'Two of your choice') {
      choices = 2;
    } else if (lang === 'One of your choice') {
      choices = 1;
    } else {
      direct.push(lang);
    }
  });

  return { direct, choices };
};
