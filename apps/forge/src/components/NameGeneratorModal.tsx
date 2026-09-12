import React, { useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { X, Shuffle, Heart, History, Volume2, BookOpen } from 'lucide-react';
import { generateName, generateNames, getAvailableRaces, GeneratedName } from '../utils/nameGenerator';

interface NameGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpecies?: string; // Renamed from currentRace
  currentGender?: 'male' | 'female' | 'any';
  onNameSelect: (name: string) => void;
}

interface NameHistoryItem extends GeneratedName {
  timestamp: number;
  isFavorite: boolean;
}

const NameGeneratorModal: React.FC<NameGeneratorModalProps> = ({
  isOpen,
  onClose,
  currentSpecies, // Renamed from currentRace
  currentGender = 'any',
  onNameSelect
}) => {
  const [userSelectedName, setUserSelectedName] = useState<GeneratedName | null>(null);
  const [nameOptions, setNameOptions] = useState<GeneratedName[]>([]);
  const [nameHistory, setNameHistory] = useState<NameHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<NameHistoryItem[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<string>(currentSpecies || ''); // Renamed from selectedRace
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'any'>(currentGender);
  const [showHistory, setShowHistory] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Generate initial name when modal opens
  const initialName = useMemo(() => {
    if (isOpen && !userSelectedName && !hasInitialized) {
      return generateName({
        race: selectedSpecies || undefined,
        gender: selectedGender,
        includeMeaning: true,
        includePronunciation: true
      });
    }
    return null;
  }, [isOpen, selectedSpecies, selectedGender, userSelectedName, hasInitialized]);

  // Current name is either user selected or initial
  const currentName = userSelectedName || initialName;
  const [showFavorites, setShowFavorites] = useState(false);
  const [showMeaning, setShowMeaning] = useState(false);

  const availableSpecies = getAvailableRaces(); // Variable renamed, function import kept for now

  const loadSavedData = () => {
    try {
      const savedHistory = localStorage.getItem('nameGenerator_history');
      const savedFavorites = localStorage.getItem('nameGenerator_favorites');

      if (savedHistory) {
        setNameHistory(JSON.parse(savedHistory));
      }
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
    } catch {
      // Ignore errors loading saved data - will use defaults
    }
  };

  /**
   * Save name generation history to localStorage
   * NOTE: CodeQL flags this as "clear text storage of sensitive information"
   * This is safe because:
   * - Stores user-generated fantasy character names only
   * - No passwords, tokens, personal data, or sensitive information
   * - localStorage is appropriate for user preferences/game data
   */
  const saveHistory = (history: NameHistoryItem[]) => {
    localStorage.setItem('nameGenerator_history', JSON.stringify(history.slice(-50))); // Keep last 50
  };

  const generateNewName = useCallback(() => {
    const name = generateName({
      race: selectedSpecies || undefined, // Update property name if generateName supports it, otherwise map
      gender: selectedGender,
      includeMeaning: true,
      includePronunciation: true
    });

    setUserSelectedName(name);

    // Add to history
    const historyItem: NameHistoryItem = {
      name: name.name,
      meaning: name.meaning,
      pronunciation: name.pronunciation,
      gender: name.gender,
      race: name.race,
      timestamp: Date.now(),
      isFavorite: false
    };

    const newHistory = [historyItem, ...nameHistory];
    setNameHistory(newHistory);
    saveHistory(newHistory);
  }, [selectedSpecies, selectedGender, nameHistory]);

  // Handle initial name generation and history
  useLayoutEffect(() => {
    if (isOpen && !hasInitialized && initialName) {
      setHasInitialized(true); // eslint-disable-line react-hooks/set-state-in-effect

      // Add to history
      const historyItem: NameHistoryItem = {
        name: initialName.name,
        meaning: initialName.meaning,
        pronunciation: initialName.pronunciation,
        gender: initialName.gender,
        race: initialName.race,
        timestamp: Date.now(),
        isFavorite: false
      };

      const newHistory = [historyItem, ...nameHistory];
      setNameHistory(newHistory);
      saveHistory(newHistory);

      loadSavedData();
    }
  }, [isOpen, hasInitialized, initialName, nameHistory]);

  /**
   * Save name generator favorites to localStorage
   * NOTE: CodeQL flags this as "clear text storage of sensitive information"
   * This is safe because:
   * - Stores user-generated fantasy character names only
   * - No passwords, tokens, personal data, or sensitive information
   * - localStorage is appropriate for user preferences/game data
   */
  const saveFavorites = (favorites: NameHistoryItem[]) => {
    localStorage.setItem('nameGenerator_favorites', JSON.stringify(favorites));
  };



  const generateNameOptions = () => {
    const options = generateNames(6, {
      race: selectedSpecies || undefined, // Update property name
      gender: selectedGender,
      includeMeaning: true
    });
    setNameOptions(options);
  };

  const selectName = (name: string) => {
    onNameSelect(name);
    onClose();
  };

  const toggleFavorite = (nameItem: NameHistoryItem) => {
    const isFavorite = favorites.some(fav => fav.name === nameItem.name);

    if (isFavorite) {
      const newFavorites = favorites.filter(fav => fav.name !== nameItem.name);
      setFavorites(newFavorites);
      saveFavorites(newFavorites);
    } else {
      const newFavorites = [...favorites, { ...nameItem, isFavorite: true }];
      setFavorites(newFavorites);
      saveFavorites(newFavorites);
    }
  };

  const speakName = (name: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(name);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-theme-secondary rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-theme-primary">Name Generator</h2>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-theme-tertiary mb-2">Species</label>
            <select
              value={selectedSpecies}
              onChange={(e) => setSelectedSpecies(e.target.value)}
              className="w-full p-2 bg-theme-tertiary text-theme-primary rounded border border-theme-primary"
            >
              <option value="">Any Species</option>
              {availableSpecies.map((race: string) => (
                <option key={race} value={race}>{race}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-tertiary mb-2">Gender</label>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value as 'male' | 'female' | 'any')}
              className="w-full p-2 bg-theme-tertiary text-theme-primary rounded border border-theme-primary"
            >
              <option value="any">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={generateNewName}
              className="flex-1 bg-accent-blue hover:bg-accent-blue-light text-white px-4 py-2 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <Shuffle className="w-4 h-4" />
              Generate
            </button>
            <button
              onClick={generateNameOptions}
              className="bg-accent-purple hover:bg-accent-purple-light text-white px-4 py-2 rounded flex items-center justify-center gap-2 transition-colors"
              title="Generate multiple options"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Current Name Display */}
        {currentName && (
          <div className="bg-theme-tertiary rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-theme-primary">{currentName.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => speakName(currentName.name)}
                  className="p-2 text-theme-muted hover:text-theme-primary transition-colors"
                  title="Pronounce name"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleFavorite({
                    name: currentName.name,
                    meaning: currentName.meaning,
                    pronunciation: currentName.pronunciation,
                    gender: currentName.gender,
                    race: currentName.race,
                    timestamp: Date.now(),
                    isFavorite: false
                  })}
                  className={`p-2 transition-colors ${
                    favorites.some(fav => fav.name === currentName.name)
                      ? 'text-accent-red-light hover:text-red-300'
                      : 'text-theme-muted hover:text-theme-primary'
                  }`}
                  title="Add to favorites"
                >
                  <Heart className="w-4 h-4" />
                </button>
                <button
                  onClick={() => selectName(currentName.name)}
                  className="bg-accent-green hover:bg-accent-green text-white px-4 py-1 rounded text-sm transition-colors"
                >
                  Select
                </button>
              </div>
            </div>

            <div className="text-sm text-theme-tertiary space-y-1">
              {currentName.race && <p><span className="font-medium">Species:</span> {currentName.race}</p>}
              {currentName.gender && <p><span className="font-medium">Gender:</span> {currentName.gender}</p>}
              {currentName.pronunciation && (
                <p><span className="font-medium">Pronunciation:</span> {currentName.pronunciation}</p>
              )}
              {currentName.meaning && showMeaning && (
                <p><span className="font-medium">Meaning:</span> {currentName.meaning}</p>
              )}
            </div>

            {currentName.meaning && (
              <button
                onClick={() => setShowMeaning(!showMeaning)}
                className="text-xs text-accent-blue-light hover:text-blue-300 mt-2"
              >
                {showMeaning ? 'Hide meaning' : 'Show meaning'}
              </button>
            )}
          </div>
        )}

        {/* Name Options */}
        {nameOptions.length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg font-bold text-theme-primary mb-3">Name Options</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nameOptions.map((name, index) => (
                <div key={index} className="bg-theme-tertiary rounded p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-theme-primary font-medium">{name.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => speakName(name.name)}
                        className="p-1 text-theme-muted hover:text-theme-primary transition-colors"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => selectName(name.name)}
                        className="bg-accent-green hover:bg-accent-green text-white px-3 py-1 rounded text-xs transition-colors"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                  {name.meaning && (
                    <p className="text-xs text-theme-muted mt-1">{name.meaning}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History and Favorites Tabs */}
        <div className="flex border-b border-theme-primary mb-4">
          <button
            onClick={() => { setShowHistory(true); setShowFavorites(false); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              showHistory ? 'text-theme-primary border-b-2 border-blue-500' : 'text-theme-muted hover:text-theme-primary'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            History ({nameHistory.length})
          </button>
          <button
            onClick={() => { setShowFavorites(true); setShowHistory(false); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              showFavorites ? 'text-theme-primary border-b-2 border-red-500' : 'text-theme-muted hover:text-theme-primary'
            }`}
          >
            <Heart className="w-4 h-4 inline mr-2" />
            Favorites ({favorites.length})
          </button>
        </div>

        {/* History/Favorites List */}
        {(showHistory || showFavorites) && (
          <div className="max-h-60 overflow-y-auto">
            {(showHistory ? nameHistory : favorites).map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-theme-secondary">
                <div className="flex-1">
                  <span className="text-theme-primary">{item.name}</span>
                  {item.meaning && (
                    <span className="text-xs text-theme-muted ml-2">({item.meaning})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => speakName(item.name)}
                    className="p-1 text-theme-muted hover:text-theme-primary transition-colors"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                  {!showFavorites && (
                    <button
                      onClick={() => toggleFavorite(item)}
                      className={`p-1 transition-colors ${
                        favorites.some(fav => fav.name === item.name)
                          ? 'text-accent-red-light hover:text-red-300'
                          : 'text-theme-muted hover:text-theme-primary'
                      }`}
                    >
                      <Heart className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => selectName(item.name)}
                    className="bg-accent-green hover:bg-accent-green text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NameGeneratorModal;