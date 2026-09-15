import languagesData from './languages.json';

export interface Language {
  name: string;
  category: 'Standard' | 'Exotic' | 'Secret' | 'Dialect' | 'Rare';
  edition?: '2014' | '2024' | 'both';
  rarity?: 'standard' | 'rare' | 'secret';
  typicalSpeakers: string;
  description: string;
  implementationNotes: string;
}

export const LANGUAGES: Language[] = languagesData as Language[];

export const getLanguagesByCategory = (category: Language['category']): Language[] => {
  return LANGUAGES.filter(lang => lang.category === category);
};

export const getLanguageByName = (name: string): Language | undefined => {
  return LANGUAGES.find(lang => lang.name === name);
};

/** Get languages filtered by edition/rarity for selection lists */
export const getSelectableLanguages = (edition: '2014' | '2024', allowedRarities: Array<Language['rarity']> = ['standard', 'rare']): Language[] => {
  return LANGUAGES.filter(lang => {
    const editionOk = !lang.edition || lang.edition === 'both' || lang.edition === edition;
    const rarityOk = !lang.rarity || allowedRarities.includes(lang.rarity);
    return editionOk && rarityOk;
  });
};
