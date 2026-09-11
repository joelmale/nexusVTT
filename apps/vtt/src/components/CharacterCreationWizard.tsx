import React, { useState, useMemo, useEffect } from 'react';
import { useCharacterCreation } from '@/stores/characterStore';
import {
  generateRandomCharacter,
  randomizeName,
  randomizeRace,
  randomizeClass,
  randomizeBackground,
  randomizeAlignment,
  randomizeAbilityScores,
  getAvailableRaces,
  getAvailableClasses,
  getAvailableBackgrounds,
  getAvailableAlignments,
} from '@/utils/characterGenerator';
import type { Character, AbilityScores } from '@/types/character';

interface CharacterCreationWizardProps {
  playerId: string;
  onComplete: (characterId: string, character?: Character) => void;
  onCancel: () => void;
  isModal?: boolean;
}

interface WizardStepProps {
  character: Partial<Character>;
  updateCharacter: (updates: Partial<Character>) => void;
  onNext: () => void;
  onPrevious: () => void;
  canProceed: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  playerId: string;
}

// =============================================================================
// STEP 1: CORE CONCEPT
// =============================================================================

const CoreConceptStep: React.FC<WizardStepProps> = ({
  character,
  updateCharacter,
  onNext: _onNext,
  onPrevious: _onPrevious,
  canProceed: _canProceed,
  isFirstStep: _isFirstStep,
  isLastStep: _isLastStep,
  playerId,
}) => {
  const handleRandomizeAll = () => {
    // Use playerId from props instead of character state to ensure it's always available
    const randomChar = generateRandomCharacter(playerId);
    updateCharacter({
      name: randomChar.name,
      race: randomChar.race,
      class: randomChar.class,
      background: randomChar.background,
      alignment: randomChar.alignment,
    });
  };

  const handleRandomizeName = () => {
    const newName = randomizeName(character.race);
    updateCharacter({ name: newName });
  };

  const handleRandomizeRace = () => {
    const newRace = randomizeRace();
    updateCharacter({ race: newRace });
  };

  const handleRandomizeClass = () => {
    const newClass = randomizeClass();
    updateCharacter({ class: newClass });
  };

  const handleRandomizeBackground = () => {
    const newBackground = randomizeBackground();
    updateCharacter({ background: newBackground });
  };

  const handleRandomizeAlignment = () => {
    const newAlignment = randomizeAlignment();
    updateCharacter({ alignment: newAlignment });
  };

  return (
    <div className="wizard-step core-concept-step">
      <div className="step-header">
        <h2>Character Concept</h2>
        <button
          className="randomize-all-btn"
          onClick={handleRandomizeAll}
          title="Randomize all fields"
        >
          🎲 Randomize All
        </button>
      </div>

      <div className="form-grid">
        {/* Character Name */}
        <div className="form-group">
          <label htmlFor="character-name">Character Name</label>
          <div className="input-with-dice">
            <input
              type="text"
              id="character-name"
              value={character.name || ''}
              onChange={(e) => updateCharacter({ name: e.target.value })}
              placeholder="Enter character name"
              className="form-input"
            />
            <button
              className="dice-btn"
              onClick={handleRandomizeName}
              title="Generate random name"
            >
              🎲
            </button>
          </div>
        </div>

        {/* Race */}
        <div className="form-group">
          <label htmlFor="character-race">Race</label>
          <div className="input-with-dice">
            <select
              id="character-race"
              value={character.race || ''}
              onChange={(e) => {
                const raceName = e.target.value;
                if (raceName) {
                  updateCharacter({ race: raceName });
                }
              }}
              className="form-select"
            >
              <option value="">Select a race</option>
              {getAvailableRaces().map((race) => (
                <option key={race} value={race}>
                  {race}
                </option>
              ))}
            </select>
            <button
              className="dice-btn"
              onClick={handleRandomizeRace}
              title="Random race"
            >
              🎲
            </button>
          </div>
        </div>

        {/* Class */}
        <div className="form-group">
          <label htmlFor="character-class">Class</label>
          <div className="input-with-dice">
            <select
              id="character-class"
              value={character.class || ''}
              onChange={(e) => {
                const className = e.target.value;
                if (className) {
                  updateCharacter({ class: className });
                }
              }}
              className="form-select"
            >
              <option value="">Select a class</option>
              {getAvailableClasses().map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            <button
              className="dice-btn"
              onClick={handleRandomizeClass}
              title="Random class"
            >
              🎲
            </button>
          </div>
        </div>

        {/* Background */}
        <div className="form-group">
          <label htmlFor="character-background">Background</label>
          <div className="input-with-dice">
            <select
              id="character-background"
              value={character.background || ''}
              onChange={(e) => {
                const backgroundName = e.target.value;
                if (backgroundName) {
                  updateCharacter({ background: backgroundName });
                }
              }}
              className="form-select"
            >
              <option value="">Select a background</option>
              {getAvailableBackgrounds().map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            <button
              className="dice-btn"
              onClick={handleRandomizeBackground}
              title="Random background"
            >
              🎲
            </button>
          </div>
        </div>

        {/* Alignment */}
        <div className="form-group">
          <label htmlFor="character-alignment">Alignment</label>
          <div className="input-with-dice">
            <select
              id="character-alignment"
              value={character.alignment || ''}
              onChange={(e) => updateCharacter({ alignment: e.target.value })}
              className="form-select"
            >
              <option value="">Select alignment</option>
              {getAvailableAlignments().map((alignment) => (
                <option key={alignment} value={alignment}>
                  {alignment}
                </option>
              ))}
            </select>
            <button
              className="dice-btn"
              onClick={handleRandomizeAlignment}
              title="Random alignment"
            >
              🎲
            </button>
          </div>
        </div>

        {/* Level */}
        <div className="form-group">
          <label htmlFor="character-level">Level</label>
          <input
            type="number"
            id="character-level"
            value={character.level || 1}
            onChange={(e) =>
              updateCharacter({ level: parseInt(e.target.value) || 1 })
            }
            min="1"
            max="20"
            className="form-input"
          />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// STEP 2: ABILITY SCORES
// =============================================================================

const AbilityScoresStep: React.FC<WizardStepProps> = ({
  character,
  updateCharacter,
  onNext: _onNext,
  onPrevious: _onPrevious,
  canProceed: _canProceed,
  isFirstStep: _isFirstStep,
  isLastStep: _isLastStep,
  playerId: _playerId,
}) => {
  const [generationMethod, setGenerationMethod] = useState<'4d6' | 'standard-array' | 'point-buy' | 'manual'>('4d6');
  const [pointBuyPool, setPointBuyPool] = useState(27);

  const handleRoll4d6 = () => {
    const newAbilities = randomizeAbilityScores();
    updateCharacter({ abilities: newAbilities });
  };

  const handleStandardArray = () => {
    const standardScores = [15, 14, 13, 12, 10, 8];
    const abilityNames: (keyof AbilityScores)[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const calculateModifier = (score: number) => Math.floor((score - 10) / 2);

    const newAbilities: AbilityScores = {} as AbilityScores;
    abilityNames.forEach((ability, index) => {
      const score = standardScores[index];
      newAbilities[ability] = {
        score,
        modifier: calculateModifier(score),
      };
    });

    updateCharacter({ abilities: newAbilities });
  };

  const handlePointBuy = () => {
    // Point buy starts with all 8s, player spends 27 points
    const newAbilities: AbilityScores = {
      STR: { score: 8, modifier: -1 },
      DEX: { score: 8, modifier: -1 },
      CON: { score: 8, modifier: -1 },
      INT: { score: 8, modifier: -1 },
      WIS: { score: 8, modifier: -1 },
      CHA: { score: 8, modifier: -1 },
    };

    updateCharacter({ abilities: newAbilities });
    setPointBuyPool(27);
  };

  const getPointCost = (score: number): number => {
    // Point buy cost table (scores 8-15)
    const costs: { [key: number]: number } = {
      8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
    };
    return costs[score] || 0;
  };

  const handleAbilityChange = (ability: keyof AbilityScores, score: number) => {
    if (!character.abilities) return;

    const calculateModifier = (score: number) => Math.floor((score - 10) / 2);
    const newModifier = calculateModifier(score);

    // If using point buy, check if player has enough points
    if (generationMethod === 'point-buy') {
      const newCost = getPointCost(score);

      // Calculate total points used across all abilities (excluding the one being changed)
      let totalUsed = 0;
      Object.entries(character.abilities).forEach(([abilityName, abilityData]) => {
        if (abilityName !== ability) {
          totalUsed += getPointCost(abilityData.score);
        }
      });
      totalUsed += newCost;

      if (totalUsed > 27) {
        alert('Not enough points! You can only spend 27 points total.');
        return;
      }

      setPointBuyPool(27 - totalUsed);
    }

    const updatedAbilities = {
      ...character.abilities,
      [ability]: {
        ...character.abilities[ability],
        score,
        modifier: newModifier,
      },
    };

    updateCharacter({ abilities: updatedAbilities });
  };

  const abilities = character.abilities || randomizeAbilityScores();

  return (
    <div className="wizard-step ability-scores-step">
      <div className="step-header">
        <h2>Ability Scores</h2>
        <div className="generation-method-selector">
          <button
            className={`method-btn ${generationMethod === '4d6' ? 'active' : ''}`}
            onClick={() => { setGenerationMethod('4d6'); handleRoll4d6(); }}
            title="Roll 4d6, drop lowest"
          >
            🎲 4d6 Drop Lowest
          </button>
          <button
            className={`method-btn ${generationMethod === 'standard-array' ? 'active' : ''}`}
            onClick={() => { setGenerationMethod('standard-array'); handleStandardArray(); }}
            title="Use standard array: 15, 14, 13, 12, 10, 8"
          >
            📊 Standard Array
          </button>
          <button
            className={`method-btn ${generationMethod === 'point-buy' ? 'active' : ''}`}
            onClick={() => { setGenerationMethod('point-buy'); handlePointBuy(); }}
            title="Point buy with 27 points"
          >
            🎯 Point Buy
          </button>
          <button
            className={`method-btn ${generationMethod === 'manual' ? 'active' : ''}`}
            onClick={() => setGenerationMethod('manual')}
            title="Set scores manually"
          >
            ✏️ Manual
          </button>
        </div>
      </div>

      {generationMethod === 'point-buy' && (
        <div className="point-buy-info">
          <p><strong>Points Remaining: {pointBuyPool} / 27</strong></p>
          <p className="help-text">Scores range from 8-15. Higher scores cost more points.</p>
        </div>
      )}

      <div className="abilities-grid">
        {Object.entries(abilities).map(([abilityName, abilityData]) => (
          <div key={abilityName} className="ability-score-group">
            <label className="ability-label">
              {{
                STR: 'Strength',
                DEX: 'Dexterity',
                CON: 'Constitution',
                INT: 'Intelligence',
                WIS: 'Wisdom',
                CHA: 'Charisma',
              }[abilityName] || abilityName}
            </label>
            <div className="ability-input-container">
              <input
                type="number"
                value={abilityData.score}
                onChange={(e) =>
                  handleAbilityChange(
                    abilityName as keyof AbilityScores,
                    parseInt(e.target.value) || 10,
                  )
                }
                min={generationMethod === 'point-buy' ? 8 : 1}
                max={generationMethod === 'point-buy' ? 15 : 20}
                className="ability-input"
              />
              <div className="ability-score-group__modifier">
                {abilityData.modifier >= 0 ? '+' : ''}
                {abilityData.modifier}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="ability-score-help">
        <p>
          <strong>4d6 Drop Lowest:</strong> Roll 4 six-sided dice, discard the lowest, sum the rest.
        </p>
        <p>
          <strong>Standard Array:</strong> Assign the fixed scores 15, 14, 13, 12, 10, 8 to your abilities.
        </p>
        <p>
          <strong>Point Buy:</strong> Start with all 8s and spend 27 points to increase scores (8-15).
        </p>
        <p>
          <strong>Manual:</strong> Set any scores you want (1-20).
        </p>
      </div>
    </div>
  );
};

// =============================================================================
// STEP 3: DETAILS & PERSONALITY
// =============================================================================

const DetailsStep: React.FC<WizardStepProps> = ({
  character,
  updateCharacter,
  onNext: _onNext,
  onPrevious: _onPrevious,
  canProceed: _canProceed,
  isFirstStep: _isFirstStep,
  isLastStep: _isLastStep,
  playerId: _playerId,
}) => {
  return (
    <div className="wizard-step details-step">
      <div className="step-header">
        <h2>Character Details</h2>
      </div>

      <div className="form-grid">
        {/* Combat Stats */}
        <div className="form-section">
          <h3>Combat Statistics</h3>

          <div className="form-group">
            <label htmlFor="armor-class">Armor Class</label>
            <input
              type="number"
              id="armor-class"
              value={character.armorClass || 10}
              onChange={(e) =>
                updateCharacter({ armorClass: parseInt(e.target.value) || 10 })
              }
              min="1"
              className="form-input"
              placeholder="Enter armor class"
              title="Armor Class"
            />
          </div>

          <div className="form-group">
            <label htmlFor="hit-points">Hit Points</label>
            <input
              type="number"
              id="hit-points"
              value={character.maxHitPoints || character.hitPoints || 1}
              onChange={(e) => {
                const maxHP = parseInt(e.target.value) || 1;
                updateCharacter({
                  hitPoints: maxHP,
                  maxHitPoints: maxHP,
                  temporaryHitPoints: 0,
                });
              }}
              min="1"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="speed">Speed (ft)</label>
            <input
              type="number"
              id="speed"
              value={character.speed || 30}
              onChange={(e) =>
                updateCharacter({ speed: parseInt(e.target.value) || 30 })
              }
              min="0"
              step="5"
              className="form-input"
            />
          </div>
        </div>

        {/* Personality Traits */}
        <div className="form-section">
          <h3>Personality</h3>

          <div className="form-group">
            <label htmlFor="personality-traits">Personality Traits</label>
            <textarea
              id="personality-traits"
              value={character.featuresAndTraits?.personality || ''}
              onChange={(e) =>
                updateCharacter({
                  featuresAndTraits: {
                    ...(character.featuresAndTraits || {}),
                    personality: e.target.value,
                  },
                })
              }
              placeholder="Describe your character's personality traits..."
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ideals">Ideals</label>
            <textarea
              id="ideals"
              value={character.featuresAndTraits?.ideals || ''}
              onChange={(e) =>
                updateCharacter({
                  featuresAndTraits: {
                    ...(character.featuresAndTraits || {}),
                    ideals: e.target.value,
                  },
                })
              }
              placeholder="What drives your character..."
              className="form-textarea"
              rows={2}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bonds">Bonds</label>
            <textarea
              id="bonds"
              value={character.featuresAndTraits?.bonds || ''}
              onChange={(e) =>
                updateCharacter({
                  featuresAndTraits: {
                    ...(character.featuresAndTraits || {}),
                    bonds: e.target.value,
                  },
                })
              }
              placeholder="Important connections and relationships..."
              className="form-textarea"
              rows={2}
            />
          </div>

          <div className="form-group">
            <label htmlFor="flaws">Flaws</label>
            <textarea
              id="flaws"
              value={character.featuresAndTraits?.flaws || ''}
              onChange={(e) =>
                updateCharacter({
                  featuresAndTraits: {
                    ...(character.featuresAndTraits || {}),
                    flaws: e.target.value,
                  },
                })
              }
              placeholder="Character weaknesses or vices..."
              className="form-textarea"
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// STEP 4: PROFICIENCIES & LANGUAGES
// =============================================================================

const ProficienciesStep: React.FC<WizardStepProps> = ({
  character,
  updateCharacter,
  onNext: _onNext,
  onPrevious: _onPrevious,
  canProceed: _canProceed,
  isFirstStep: _isFirstStep,
  isLastStep: _isLastStep,
  playerId: _playerId,
}) => {
  // D&D 5e Standard Languages
  const DND_LANGUAGES = [
    'Common',
    'Elvish',
    'Dwarvish',
    'Halfling',
    'Draconic',
    'Gnomish',
    'Orc',
    'Infernal',
    'Celestial',
    'Abyssal',
    'Primordial',
    'Sylvan',
    'Undercommon',
    'Giant',
    'Goblin',
    'Deep Speech',
  ];

  const handleLanguageToggle = (language: string) => {
    const currentLanguages = character.languages || ['Common'];
    const newLanguages = currentLanguages.includes(language)
      ? currentLanguages.filter((l) => l !== language)
      : [...currentLanguages, language];

    // Always keep Common
    if (!newLanguages.includes('Common')) {
      newLanguages.unshift('Common');
    }

    updateCharacter({ languages: newLanguages });
  };

  const currentLanguages = character.languages || ['Common'];

  return (
    <div className="wizard-step proficiencies-step">
      <div className="step-header">
        <h2>Proficiencies & Languages</h2>
      </div>

      <div className="form-grid">
        {/* Languages */}
        <div className="form-section">
          <h3>Languages</h3>
          <p className="form-help">
            Select additional languages your character knows. Common is always
            included.
          </p>
          <div className="proficiency-grid">
            {DND_LANGUAGES.map((language) => (
              <label key={language} className="proficiency-item">
                <input
                  type="checkbox"
                  checked={currentLanguages.includes(language)}
                  onChange={() => handleLanguageToggle(language)}
                  disabled={language === 'Common'}
                />
                <span className="proficiency-label">{language}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Tool/Armor/Weapon proficiencies are managed by imports for now. */}
      </div>
    </div>
  );
};

// =============================================================================
// STEP 5: EQUIPMENT & FEATURES
// =============================================================================

const EquipmentFeaturesStep: React.FC<WizardStepProps> = ({
  character,
  updateCharacter: _updateCharacter,
  onNext: _onNext,
  onPrevious: _onPrevious,
  canProceed: _canProceed,
  isFirstStep: _isFirstStep,
  isLastStep: _isLastStep,
  playerId: _playerId,
}) => {
  return (
    <div className="wizard-step equipment-features-step">
      <div className="step-header">
        <h2>Equipment & Features</h2>
      </div>

      <div className="form-grid">
        {/* Starting Equipment */}
        <div className="form-section">
          <h3>Starting Equipment</h3>
          <p className="form-help">
            Equipment is automatically assigned based on your class and
            background choices.
          </p>
          <div className="equipment-list">
            {character.inventory?.length ? (
              character.inventory.map((item, index) => (
                <div key={index} className="equipment-item">
                  <span className="equipment-name">{item.equipmentSlug}</span>
                  <span className="equipment-quantity">×{item.quantity}</span>
                </div>
              ))
            ) : (
              <p className="no-equipment">
                No inventory items assigned yet.
              </p>
            )}
          </div>
        </div>

        {/* Racial Features */}
        <div className="form-section">
          <h3>Racial Features</h3>
          <div className="features-list">
            {character.featuresAndTraits?.racialTraits?.length ? (
              character.featuresAndTraits.racialTraits.map((trait, index) => (
                <div key={index} className="feature-item">
                  <span className="feature-name">{trait}</span>
                </div>
              ))
            ) : (
              <p className="no-features">No racial traits available.</p>
            )}
          </div>
        </div>

        {/* Class Features */}
        <div className="form-section">
          <h3>Class Features</h3>
          <div className="features-list">
            {character.featuresAndTraits?.classFeatures?.length ? (
              character.featuresAndTraits.classFeatures.map((feature, index) => (
                <div key={index} className="feature-item">
                  <span className="feature-name">{feature}</span>
                </div>
              ))
            ) : (
              <p className="no-features">No class features available yet.</p>
            )}
          </div>
        </div>

        {/* Attacks */}
        <div className="form-section">
          <h3>Attacks</h3>
          <div className="attacks-list">
            {character.equippedWeapons?.length ? (
              character.equippedWeapons.map((attack, index) => (
                <div key={index} className="attack-item">
                  <span className="attack-name">
                    {attack.weaponSlug || 'Equipped weapon'}
                  </span>
                </div>
              ))
            ) : (
              <p className="no-attacks">No attacks configured yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// STEP 6: SPELLS & FINAL DETAILS
// =============================================================================

const FinalDetailsStep: React.FC<WizardStepProps> = ({
  character,
  updateCharacter,
  onNext: _onNext,
  onPrevious: _onPrevious,
  canProceed: _canProceed,
  isFirstStep: _isFirstStep,
  isLastStep: _isLastStep,
  playerId: _playerId,
}) => {
  // Check if character is a spellcaster
  const isSpellcaster = !!character.spellcasting;

  return (
    <div className="wizard-step final-details-step">
      <div className="step-header">
        <h2>Spells & Final Details</h2>
      </div>

      <div className="form-grid">
        {/* Spellcasting (if applicable) */}
        {isSpellcaster && (
          <div className="form-section">
            <h3>Spellcasting</h3>
            <div className="spellcasting-info">
              <div className="form-group">
                <label>Spellcasting Ability</label>
                <span className="info-value">
                  {character.spellcasting?.ability || 'Not set'}
                </span>
              </div>
              <div className="form-group">
                <label>Spell Save DC</label>
                <span className="info-value">
                  {character.spellcasting?.spellSaveDC || 'Not calculated'}
                </span>
              </div>
              <div className="form-group">
                <label>Spell Attack Bonus</label>
                <span className="info-value">
                  {character.spellcasting?.spellAttackBonus
                    ? (character.spellcasting.spellAttackBonus >= 0
                        ? '+'
                        : '') + character.spellcasting.spellAttackBonus
                    : 'Not calculated'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Experience Points */}
        <div className="form-section">
          <h3>Experience & Status</h3>
          <div className="form-group">
            <label htmlFor="experience-points">Experience Points</label>
            <input
              type="number"
              id="experience-points"
              value={character.experiencePoints || 0}
              onChange={(e) =>
                updateCharacter({
                  experiencePoints: parseInt(e.target.value) || 0,
                })
              }
              min="0"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={character.inspiration || false}
                onChange={(e) =>
                  updateCharacter({ inspiration: e.target.checked })
                }
              />
              <span>Inspiration</span>
            </label>
          </div>
        </div>

      </div>
    </div>
  );
};

// =============================================================================
// MAIN WIZARD COMPONENT
// =============================================================================

export const CharacterCreationWizard: React.FC<
  CharacterCreationWizardProps
> = ({ playerId, onComplete, onCancel, isModal = false }) => {
  const {
    creationState,
    updateCreationState,
    completeCharacterCreation,
    cancelCharacterCreation,
    startCharacterCreation,
  } = useCharacterCreation();

  const [currentStep, setCurrentStep] = useState(1);

  // Initialize character creation state when component mounts
  useEffect(() => {
    console.log('🎭 CharacterCreationWizard mounted', { creationState, playerId });
    if (!creationState) {
      console.log('🎭 Starting character creation for player:', playerId);
      startCharacterCreation(playerId, 'guided');
    }
  }, [creationState, startCharacterCreation, playerId]);
  const totalSteps = 6;

  // Determine if export should be enabled
  const canExport = useMemo(() => {
    // Must be on final step
    if (currentStep !== totalSteps) return false;

    const character = creationState?.character;
    if (!character) return false;

    // Check all required fields are filled
    return !!(
      character.name?.trim() &&
      character.race &&
      character.class &&
      character.abilities?.STR?.score &&
      character.abilities?.DEX?.score &&
      character.abilities?.CON?.score &&
      character.abilities?.INT?.score &&
      character.abilities?.WIS?.score &&
      character.abilities?.CHA?.score
    );
  }, [currentStep, totalSteps, creationState?.character]);

  // Creation state should be initialized by the launcher
  // Don't call startCharacterCreation here to avoid conflicts

  const character = creationState?.character || {};

  const updateCharacter = (updates: Partial<Character>) => {
    updateCreationState({
      character: { ...character, ...updates },
    });
  };

  const handleNext = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete character creation
      const result = await completeCharacterCreation();
      if (result) {
        onComplete(result.id, result.character);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = () => {
    cancelCharacterCreation();
    onCancel();
  };

  const handleRandomizeAll = () => {
    const randomChar = generateRandomCharacter(playerId);
    updateCreationState({ character: randomChar });
  };

  const handleExportCharacter = async () => {
    try {
      // Get the current character from creation state
      const currentCharacter = creationState?.character;
      if (!currentCharacter) {
        alert(
          'No character data available. Please complete character creation first.',
        );
        return;
      }

      // Export the character data directly as JSON
      const exportData = JSON.stringify(currentCharacter, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus-character-${currentCharacter.name || 'unnamed'}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Character exported successfully:', currentCharacter.name);
    } catch (error) {
      console.error('Failed to export character:', error);
      alert('Failed to export character. Please try again.');
    }
  };

  // Validation for each step
  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(
          character.name &&
          character.race &&
          character.class
        );
      case 2:
        return !!character.abilities;
      case 3:
        return true; // Details are optional
      case 4:
        return true; // Proficiencies are optional
      case 5:
        return true; // Equipment & features are optional
      case 6:
        return true; // Final details are optional
      default:
        return false;
    }
  };

  const renderCurrentStep = () => {
    const stepProps = {
      character,
      updateCharacter,
      onNext: handleNext,
      onPrevious: handlePrevious,
      canProceed: canProceedFromStep(currentStep),
      isFirstStep: currentStep === 1,
      isLastStep: currentStep === totalSteps,
      playerId,
    };

    switch (currentStep) {
      case 1:
        return <CoreConceptStep {...stepProps} />;
      case 2:
        return <AbilityScoresStep {...stepProps} />;
      case 3:
        return <DetailsStep {...stepProps} />;
      case 4:
        return <ProficienciesStep {...stepProps} />;
      case 5:
        return <EquipmentFeaturesStep {...stepProps} />;
      case 6:
        return <FinalDetailsStep {...stepProps} />;
      default:
        return null;
    }
  };

  const containerClass = isModal
    ? 'character-wizard-modal'
    : 'character-wizard-fullpage';

  return (
    <div
      className={`character-creation-wizard ${containerClass} theme-solid`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 'var(--z-top-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {isModal && <div className="modal-backdrop" onClick={handleCancel} />}

      <div className="wizard-container">
        {/* Header Bar */}
        <div className="wizard-header">
          {/* Header Left Navigation */}
          <div className="header-nav-left">
            <button
              className="nav-btn previous header-nav"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              ← Previous
            </button>
          </div>

          <div className="header-center">
            <div className="header-left">
              <h1>Create New Character</h1>
              <div className="wizard-progress">
                <div className="progress-steps">
                  {Array.from({ length: totalSteps }, (_, i) => (
                    <div
                      key={i + 1}
                      className={`progress-step ${i + 1 <= currentStep ? 'active' : ''} ${i + 1 < currentStep ? 'completed' : ''}`}
                    >
                      <div className="step-number">{i + 1}</div>
                      <div className="step-label">
                        {i + 1 === 1 && 'Core'}
                        {i + 1 === 2 && 'Abilities'}
                        {i + 1 === 3 && 'Details'}
                        {i + 1 === 4 && 'Proficiencies'}
                        {i + 1 === 5 && 'Equipment'}
                        {i + 1 === 6 && 'Final'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Header Right Navigation */}
          <div className="header-nav-right">
            <button
              className="randomize-everything-btn"
              onClick={handleRandomizeAll}
              title="Randomize entire character"
            >
              🎲 Random Character
            </button>
            <button
              className="nav-btn next header-nav"
              onClick={handleNext}
              disabled={!canProceedFromStep(currentStep)}
            >
              {currentStep === totalSteps ? 'Create Character' : 'Next →'}
            </button>
            <button
              className="export-btn header-nav"
              onClick={handleExportCharacter}
              title={
                !canExport
                  ? currentStep === totalSteps
                    ? 'Complete all required fields to export character'
                    : 'Complete character creation to enable export'
                  : 'Export character to JSON file'
              }
              disabled={!canExport}
            >
              💾 Export
            </button>
            <button className="cancel-btn" onClick={handleCancel}>
              ✕
            </button>
          </div>
        </div>

        {/* Main Character Sheet Layout */}
        <div className="character-sheet-main">
          {/* Character Preview Panel (Left/Top) */}
          <div className="character-preview-panel">
            <div className="character-summary">
              <div className="character-portrait">
                <div className="portrait-placeholder">🎭</div>
              </div>
              <div className="character-basics">
                <h2 className="character-name">
                  {character.name || 'Unnamed Character'}
                </h2>
                <div className="character-identity">
                  <span className="race">{character.race || 'Race'}</span>
                  <span className="separator">•</span>
                  <span className="class">
                    {character.class || 'Class'}
                  </span>
                  <span className="separator">•</span>
                  <span className="level">Level {character.level || 1}</span>
                </div>
                <div className="character-background">
                  {character.background || 'Background'}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
              <div className="combat-stats">
                <div className="stat-block">
                  <div className="stat-block-header">Armor Class</div>
                  <div className="stat-block-value">
                    {character.armorClass || 10}
                  </div>
                </div>

                <div className="stat-block">
                  <div className="stat-block-header">Hit Points</div>
                  <div className="stat-block-value">
                    {character.maxHitPoints || character.hitPoints || 8}
                  </div>
                </div>

                <div className="stat-block">
                  <div className="stat-block-header">Speed</div>
                  <div className="stat-block-value">
                    {character.speed || 30} ft.
                  </div>
                </div>
              </div>
            </div>

            {/* Ability Scores */}
            <div className="ability-scores-preview">
              <h3>Ability Scores</h3>
              <div className="abilities-grid">
                {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((ability) => {
                  const abilityData =
                    character.abilities?.[ability as keyof AbilityScores];
                  const score = abilityData?.score ?? 10;
                  const modifier =
                    abilityData?.modifier ?? Math.floor((score - 10) / 2);

                  return (
                    <div key={ability} className="ability-score">
                      <div className="ability-name">
                        {ability}
                      </div>
                      <div className="ability-value">{score}</div>
                      <div className="ability-scores-preview__modifier">
                        {modifier >= 0 ? '+' : ''}
                        {modifier}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step Content Panel (Right/Bottom) */}
          <div className="wizard-content-panel">
            <div className="wizard-content">{renderCurrentStep()}</div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="wizard-footer">
          <button
            className="nav-btn previous footer-nav"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            ← Previous
          </button>

          <div className="footer-center">
            Step {currentStep} of {totalSteps}
          </div>

          <button
            className="nav-btn next footer-nav"
            onClick={handleNext}
            disabled={!canProceedFromStep(currentStep)}
          >
            {currentStep === totalSteps ? 'Create Character' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};
