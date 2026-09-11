import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Save, X, AlertCircle } from 'lucide-react';
import { Character } from '../types/dnd';
import { loadClasses, loadSpecies, BACKGROUNDS } from '../services/dataService';
import { buildCompleteSpellcasting } from '../utils/characterEditUtils';

interface CharacterEditFormProps {
  character?: Character; // If provided, we're editing; if not, we're creating
  onSave: (character: Character) => void;
  onCancel: () => void;
  isCreating?: boolean;
  edition?: '2014' | '2024'; // Edition to use for new characters
}

interface FormData {
  // Basic Info
  name: string;
  level: number;
  species: string;
  class: string;
  background: string;
  alignment: string;
  edition: '2014' | '2024';

  // Ability Scores
  abilities: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };

  // Combat Stats
  hitPoints: number;
  maxHitPoints: number;
  armorClass: number;
  initiative: number;
  speed: number;
  proficiencyBonus: number;

  // Skills (proficiencies)
  skills: Record<string, { proficient: boolean; expertise: boolean; modifier: number }>;

  // Saving Throws
  savingThrows: Record<string, boolean>; // true if proficient

  // Class-specific selections
  num_instrument_choices?: number;
  selectedMusicalInstruments: string[];

  // Languages
  languages: string[];

  // Equipment & Inventory
  equipment: Array<{ name: string; quantity: number }>;
  currency: { cp: number; sp: number; gp: number; pp: number };

  // Spells (simplified for now)
  spellcasting?: {
    ability: 'INT' | 'WIS' | 'CHA';
    cantripsKnown: string[];
    spellsKnown: string[];
  };

  // Features & Traits
  featuresAndTraits: {
    personality: string;
    ideals: string;
    bonds: string;
    flaws: string;
    classFeatures: string[];
    speciesTraits: string[];
    backgroundFeatures: Array<{name: string, description: string}>;
    musicalInstrumentProficiencies: string[];
  };
}

const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const SKILL_NAMES = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
  'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
  'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
  'Sleight of Hand', 'Stealth', 'Survival'
];

// Map skills to their governing abilities
const SKILL_TO_ABILITY: Record<string, string> = {
  'Acrobatics': 'DEX',
  'Animal Handling': 'WIS',
  'Arcana': 'INT',
  'Athletics': 'STR',
  'Deception': 'CHA',
  'History': 'INT',
  'Insight': 'WIS',
  'Intimidation': 'CHA',
  'Investigation': 'INT',
  'Medicine': 'WIS',
  'Nature': 'INT',
  'Perception': 'WIS',
  'Performance': 'CHA',
  'Persuasion': 'CHA',
  'Religion': 'INT',
  'Sleight of Hand': 'DEX',
  'Stealth': 'DEX',
  'Survival': 'WIS'
};

const getAbilityForSkill = (skill: string): string => {
  return SKILL_TO_ABILITY[skill] || 'STR';
};

export const CharacterEditForm: React.FC<CharacterEditFormProps> = ({
  character,
  onSave,
  onCancel,
  isCreating = false,
  edition = '2024'
}) => {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Auto-calculated derived stats
  const derivedStats = useMemo(() => {
    if (!formData) return null;

    const proficiencyBonus = Math.floor((formData.level - 1) / 4) + 2;

    // Calculate ability modifiers
    const abilityModifiers = {
      STR: Math.floor((formData.abilities.STR - 10) / 2),
      DEX: Math.floor((formData.abilities.DEX - 10) / 2),
      CON: Math.floor((formData.abilities.CON - 10) / 2),
      INT: Math.floor((formData.abilities.INT - 10) / 2),
      WIS: Math.floor((formData.abilities.WIS - 10) / 2),
      CHA: Math.floor((formData.abilities.CHA - 10) / 2),
    };

    // Calculate saving throws (base modifier + proficiency if proficient)
    const savingThrows = {
      STR: abilityModifiers.STR + (formData.savingThrows.STR ? proficiencyBonus : 0),
      DEX: abilityModifiers.DEX + (formData.savingThrows.DEX ? proficiencyBonus : 0),
      CON: abilityModifiers.CON + (formData.savingThrows.CON ? proficiencyBonus : 0),
      INT: abilityModifiers.INT + (formData.savingThrows.INT ? proficiencyBonus : 0),
      WIS: abilityModifiers.WIS + (formData.savingThrows.WIS ? proficiencyBonus : 0),
      CHA: abilityModifiers.CHA + (formData.savingThrows.CHA ? proficiencyBonus : 0),
    };

    // Calculate skill modifiers (base modifier + proficiency if proficient)
    const skillModifiers: Record<string, number> = {};
    SKILL_NAMES.forEach(skill => {
      const abilityKey = getAbilityForSkill(skill);
      const baseModifier = abilityModifiers[abilityKey as keyof typeof abilityModifiers];
      const proficient = formData.skills[skill]?.proficient || false;
      const expertise = formData.skills[skill]?.expertise || false;

      if (expertise) {
        skillModifiers[skill] = baseModifier + (proficiencyBonus * 2);
      } else if (proficient) {
        skillModifiers[skill] = baseModifier + proficiencyBonus;
      } else {
        skillModifiers[skill] = baseModifier;
      }
    });

    // Calculate initiative (DEX modifier)
    const initiative = abilityModifiers.DEX;

    // Calculate AC (base 10 + DEX modifier + any armor/shields - simplified for now)
    const ac = 10 + abilityModifiers.DEX; // TODO: Add armor calculations

    return {
      proficiencyBonus,
      abilityModifiers,
      savingThrows,
      skillModifiers,
      initiative,
      ac
    };
  }, [formData]);

  // Load available options
  const classes = useMemo(() => loadClasses(formData?.edition), [formData?.edition]);
  const species = loadSpecies();
  const backgrounds = BACKGROUNDS;

  // Initialize form data
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (character) {
        // Editing existing character - populate with current data
        setFormData({
          name: character.name,
          level: character.level,
          species: character.species,
          class: character.class,
          background: character.background,
          alignment: character.alignment,
          edition: character.edition,

          abilities: {
            STR: character.abilities.STR.score,
            DEX: character.abilities.DEX.score,
            CON: character.abilities.CON.score,
            INT: character.abilities.INT.score,
            WIS: character.abilities.WIS.score,
            CHA: character.abilities.CHA.score,
          },

          hitPoints: character.hitPoints,
          maxHitPoints: character.maxHitPoints,
          armorClass: character.armorClass,
          initiative: character.initiative || 0,
          speed: character.speed || 30,
          proficiencyBonus: character.proficiencyBonus,

          skills: SKILL_NAMES.reduce((acc, skill) => {
            acc[skill] = {
              proficient: false, // TODO: Get from character data
              expertise: false,
              modifier: 0 // TODO: Calculate based on ability + proficiency
            };
            return acc;
          }, {} as Record<string, { proficient: boolean; expertise: boolean; modifier: number }>),

          savingThrows: {
            STR: false, // TODO: Get from character data
            DEX: false,
            CON: false,
            INT: false,
            WIS: false,
            CHA: false
          },

          num_instrument_choices: 0, // Will be set based on class
          selectedMusicalInstruments: character?.featuresAndTraits.musicalInstrumentProficiencies || [],

          languages: character?.languages || [],

          equipment: [], // TODO: Get from character inventory
          currency: character.currency || { cp: 0, sp: 0, gp: 0, pp: 0 },

          spellcasting: character.spellcasting ? {
            ability: character.spellcasting.ability,
            cantripsKnown: character.spellcasting.cantripsKnown,
            spellsKnown: character.spellcasting.spellsKnown || []
          } : undefined,

          featuresAndTraits: character.featuresAndTraits
        });
      } else {
        // Creating new character - start with defaults
        setFormData({
          name: '',
          level: 1,
          species: '',
          class: '',
          background: '',
          alignment: 'Neutral Good',
          edition,

          abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },

          hitPoints: 8,
          maxHitPoints: 8,
          armorClass: 10,
          initiative: 0,
          speed: 30,
          proficiencyBonus: 2,

          skills: SKILL_NAMES.reduce((acc, skill) => {
            acc[skill] = { proficient: false, expertise: false, modifier: 0 };
            return acc;
          }, {} as Record<string, { proficient: boolean; expertise: boolean; modifier: number }>),

          savingThrows: { STR: false, DEX: false, CON: false, INT: false, WIS: false, CHA: false },

          num_instrument_choices: 0,
          selectedMusicalInstruments: [],

          languages: [],

          equipment: [],
          currency: { cp: 0, sp: 0, gp: 0, pp: 0 },

          featuresAndTraits: {
            personality: '',
            ideals: '',
            bonds: '',
            flaws: '',
            classFeatures: [],
            speciesTraits: [],
            backgroundFeatures: [],
            musicalInstrumentProficiencies: []
          }
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [character, edition]);

  const updateFormData = useCallback((updates: Partial<FormData>) => {
    if (!formData) return;
    setFormData({ ...formData, ...updates });
    setIsDirty(true);
  }, [formData]);

  // Update class-specific options when class changes
  useEffect(() => {
    if (formData?.class) {
      const selectedClass = classes.find(c => c.name === formData.class);
      if (selectedClass) {
        const frame = requestAnimationFrame(() => {
          updateFormData({
            num_instrument_choices: selectedClass.num_instrument_choices || 0
          });
        });
        return () => cancelAnimationFrame(frame);
      }
    }
    return undefined;
  }, [formData?.class, classes, updateFormData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Basic required fields
    if (!formData?.name.trim()) newErrors.name = 'Character name is required';
    if (!formData?.species) newErrors.species = 'Species selection is required';
    if (!formData?.class) newErrors.class = 'Class selection is required';
    if (!formData?.background) newErrors.background = 'Background selection is required';

    // Validate ability scores
    ABILITY_NAMES.forEach(ability => {
      const score = formData?.abilities[ability as keyof typeof formData.abilities];
      if (score !== undefined) {
        if (score < 1 || score > 30) {
          newErrors[`ability_${ability}`] = 'Ability scores must be between 1-30';
        }
      }
    });

    // Validate level
    if (formData && (formData.level < 1 || formData.level > 20)) {
      newErrors.level = 'Character level must be between 1-20';
    }

    // Validate HP
    if (formData) {
      if (formData.hitPoints < 0) {
        newErrors.hitPoints = 'Current HP cannot be negative';
      }
      if (formData.maxHitPoints < 1) {
        newErrors.maxHitPoints = 'Maximum HP must be at least 1';
      }
      if (formData.hitPoints > formData.maxHitPoints) {
        newErrors.hitPoints = 'Current HP cannot exceed maximum HP';
      }
    }

    // Validate combat stats
    if (formData) {
      if (formData.armorClass < 0) {
        newErrors.armorClass = 'Armor Class cannot be negative';
      }
      if (Math.abs(formData.initiative) > 10) {
        newErrors.initiative = 'Initiative modifier seems unreasonable';
      }
    }

    // Validate currency (should not be negative)
    if (formData) {
      Object.entries(formData.currency).forEach(([type, amount]) => {
        if (amount < 0) {
          newErrors[`currency_${type}`] = `${type.toUpperCase()} cannot be negative`;
        }
      });
    }

    // Cross-field validation
    if (formData) {
      // Check if ability score total is reasonable (standard array is 72-76)
      const totalAbilityScore = ABILITY_NAMES.reduce((sum, ability) =>
        sum + formData.abilities[ability as keyof typeof formData.abilities], 0
      );
      if (totalAbilityScore < 60) {
        newErrors.abilities = 'Total ability scores seem too low for a playable character';
      } else if (totalAbilityScore > 120) {
        newErrors.abilities = 'Total ability scores seem unreasonably high';
      }

      // Check for class-specific requirements
      if (formData.class) {
        const selectedClass = classes.find(c => c.name === formData.class);
        if (selectedClass) {
          // Check if character meets basic class requirements
          if (formData.level >= selectedClass.hit_die && formData.hitPoints < formData.level) {
            newErrors.hitPoints = `HP seems too low for a level ${formData.level} ${formData.class}`;
          }
        }
      }

      // Check for musical instrument proficiencies (bards should have some)
      if (formData.class === 'Bard' && formData.num_instrument_choices && formData.num_instrument_choices > 0) {
        const selectedInstruments = formData.selectedMusicalInstruments.length;
        if (selectedInstruments === 0) {
          newErrors.instruments = 'Bards should select musical instrument proficiencies';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!formData || !validateForm()) return;

    // Convert form data to Character object
    const characterData: Character = {
      id: character?.id || `manual_${Date.now()}`,
      name: formData.name,
      species: formData.species,
      class: formData.class,
      level: formData.level,
      alignment: formData.alignment,
      background: formData.background,
      edition: formData.edition,

      abilities: {
        STR: { score: formData.abilities.STR, modifier: Math.floor((formData.abilities.STR - 10) / 2) },
        DEX: { score: formData.abilities.DEX, modifier: Math.floor((formData.abilities.DEX - 10) / 2) },
        CON: { score: formData.abilities.CON, modifier: Math.floor((formData.abilities.CON - 10) / 2) },
        INT: { score: formData.abilities.INT, modifier: Math.floor((formData.abilities.INT - 10) / 2) },
        WIS: { score: formData.abilities.WIS, modifier: Math.floor((formData.abilities.WIS - 10) / 2) },
        CHA: { score: formData.abilities.CHA, modifier: Math.floor((formData.abilities.CHA - 10) / 2) },
      },

      hitPoints: formData.hitPoints,
      maxHitPoints: formData.maxHitPoints,
      armorClass: formData.armorClass,
      initiative: formData.initiative,
      speed: formData.speed,
      proficiencyBonus: formData.proficiencyBonus,

      hitDice: character?.hitDice || { current: formData.level, max: formData.level, dieType: 8 },

      skills: character?.skills || {
        Acrobatics: { value: 0, proficient: false },
        AnimalHandling: { value: 0, proficient: false },
        Arcana: { value: 0, proficient: false },
        Athletics: { value: 0, proficient: false },
        Deception: { value: 0, proficient: false },
        History: { value: 0, proficient: false },
        Insight: { value: 0, proficient: false },
        Intimidation: { value: 0, proficient: false },
        Investigation: { value: 0, proficient: false },
        Medicine: { value: 0, proficient: false },
        Nature: { value: 0, proficient: false },
        Perception: { value: 0, proficient: false },
        Performance: { value: 0, proficient: false },
        Persuasion: { value: 0, proficient: false },
        Religion: { value: 0, proficient: false },
        SleightOfHand: { value: 0, proficient: false },
        Stealth: { value: 0, proficient: false },
        Survival: { value: 0, proficient: false }
      },

      inspiration: character?.inspiration || false,

      // TODO: Properly populate these from form data
      languages: [],
      inventory: [],
      currency: formData.currency,

      spellcasting: buildCompleteSpellcasting(formData.spellcasting, {
        class: formData.class,
        level: formData.level,
        abilities: formData.abilities,
        proficiencyBonus: formData.proficiencyBonus
      }),

      featuresAndTraits: formData.featuresAndTraits,

      // TODO: Add other required fields
      subclass: character?.subclass || null,
      divineOrder: character?.divineOrder,
      primalOrder: character?.primalOrder,
      pactBoon: character?.pactBoon,
      expertiseSkills: character?.expertiseSkills || [],
      selectedFightingStyle: character?.selectedFightingStyle,
      selectedFeats: character?.selectedFeats || [],
      srdFeatures: character?.srdFeatures,
      resources: character?.resources || []
    };

    onSave(characterData);
  };

  if (!formData) {
    return <div className="flex justify-center items-center h-64">
      <div className="text-theme-muted">Loading character data...</div>
    </div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-theme-primary text-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-accent-red-light">
          {isCreating ? 'Create Character' : 'Edit Character'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="px-4 py-2 bg-accent-green hover:bg-accent-green-light rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Character
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-600 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-400" />
          <span className="text-yellow-200">You have unsaved changes</span>
        </div>
      )}

      {/* Character Sheet Form - Classic D&D Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT COLUMN - Basic Info + Ability Scores */}
        <div className="col-span-4 space-y-4">
          {/* Basic Info */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-accent-yellow-light">Basic Information</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Character Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  className={`w-full px-3 py-2 bg-theme-tertiary border rounded ${
                    errors.name ? 'border-red-500' : 'border-theme-primary'
                  } text-white`}
                />
                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">Level</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.level}
                    onChange={(e) => updateFormData({ level: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-theme-tertiary border border-theme-primary rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">Edition</label>
                  <select
                    value={formData.edition}
                    onChange={(e) => updateFormData({ edition: e.target.value as '2014' | '2024' })}
                    className="w-full px-3 py-2 bg-theme-tertiary border border-theme-primary rounded text-white"
                  >
                    <option value="2024">D&D 2024</option>
                    <option value="2014">D&D 2014</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Species</label>
                <select
                  value={formData.species}
                  onChange={(e) => updateFormData({ species: e.target.value })}
                  className={`w-full px-3 py-2 bg-theme-tertiary border rounded text-white ${
                    errors.species ? 'border-red-500' : 'border-theme-primary'
                  }`}
                >
                  <option value="">Select Species</option>
                  {species.map(s => (
                    <option key={s.slug} value={s.name}>{s.name}</option>
                  ))}
                </select>
                {errors.species && <p className="text-red-400 text-sm mt-1">{errors.species}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Class</label>
                <select
                  value={formData.class}
                  onChange={(e) => updateFormData({ class: e.target.value })}
                  className={`w-full px-3 py-2 bg-theme-tertiary border rounded text-white ${
                    errors.class ? 'border-red-500' : 'border-theme-primary'
                  }`}
                >
                  <option value="">Select Class</option>
                  {classes.map(c => (
                    <option key={c.slug} value={c.name}>{c.name}</option>
                  ))}
                </select>
                {errors.class && <p className="text-red-400 text-sm mt-1">{errors.class}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Background</label>
                <select
                  value={formData.background}
                  onChange={(e) => updateFormData({ background: e.target.value })}
                  className={`w-full px-3 py-2 bg-theme-tertiary border rounded text-white ${
                    errors.background ? 'border-red-500' : 'border-theme-primary'
                  }`}
                >
                  <option value="">Select Background</option>
                  {backgrounds.map(bg => (
                    <option key={bg.name} value={bg.name}>{bg.name}</option>
                  ))}
                </select>
                {errors.background && <p className="text-red-400 text-sm mt-1">{errors.background}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Alignment</label>
                <select
                  value={formData.alignment}
                  onChange={(e) => updateFormData({ alignment: e.target.value })}
                  className="w-full px-3 py-2 bg-theme-tertiary border border-theme-primary rounded text-white"
                >
                  <option>Lawful Good</option>
                  <option>Neutral Good</option>
                  <option>Chaotic Good</option>
                  <option>Lawful Neutral</option>
                  <option>True Neutral</option>
                  <option>Chaotic Neutral</option>
                  <option>Lawful Evil</option>
                  <option>Neutral Evil</option>
                  <option>Chaotic Evil</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ability Scores */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-accent-yellow-light">Ability Scores</h3>
            <div className="grid grid-cols-2 gap-3">
              {ABILITY_NAMES.map(ability => (
                <div key={ability} className="text-center">
                  <div className="text-sm font-medium text-theme-muted mb-1">{ability}</div>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.abilities[ability as keyof typeof formData.abilities]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      updateFormData({
                        abilities: {
                          ...formData.abilities,
                          [ability]: value
                        }
                      });
                    }}
                    className={`w-full px-3 py-2 bg-theme-tertiary border rounded text-center text-white font-bold text-lg ${
                      errors[`ability_${ability}`] ? 'border-red-500' : 'border-theme-primary'
                    }`}
                  />
                  <div className="text-xs text-theme-muted mt-1">
                    Modifier: {(() => {
                      const modifier = derivedStats?.abilityModifiers[ability as keyof typeof derivedStats.abilityModifiers] || 0;
                      return (modifier >= 0 ? '+' : '') + modifier;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-accent-yellow-light">Skills</h3>
            <div className="space-y-2">
              {SKILL_NAMES.map(skill => (
                <div key={skill} className="flex items-center justify-between">
                  <span className="text-sm">{skill}</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-16 px-2 py-1 bg-theme-tertiary border border-theme-primary rounded text-white text-center ${
                      (derivedStats?.skillModifiers[skill] || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {(() => {
                        const modifier = derivedStats?.skillModifiers[skill] || 0;
                        return (modifier >= 0 ? '+' : '') + modifier;
                      })()}
                    </span>
                    <input
                      type="checkbox"
                      checked={formData.skills[skill]?.proficient || false}
                      onChange={(e) => {
                        updateFormData({
                          skills: {
                            ...formData.skills,
                            [skill]: {
                              ...formData.skills[skill],
                              proficient: e.target.checked
                            }
                          }
                        });
                      }}
                      className="w-4 h-4"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN - Combat & Skills */}
        <div className="col-span-5 space-y-4">
          {/* Combat Stats */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-accent-yellow-light">Combat Statistics</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Hit Points</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    value={formData.hitPoints}
                    onChange={(e) => updateFormData({ hitPoints: parseInt(e.target.value) || 0 })}
                    className={`w-16 px-2 py-2 bg-theme-tertiary border rounded text-white text-center ${
                      errors.hitPoints ? 'border-red-500' : 'border-theme-primary'
                    }`}
                    placeholder="HP"
                  />
                  <span className="text-theme-muted self-center text-sm">/</span>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxHitPoints}
                    onChange={(e) => updateFormData({ maxHitPoints: parseInt(e.target.value) || 1 })}
                    className="w-16 px-2 py-2 bg-theme-tertiary border border-theme-primary rounded text-white text-center"
                    placeholder="Max"
                  />
                </div>
                {errors.hitPoints && <p className="text-red-400 text-sm mt-1">{errors.hitPoints}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">Armor Class</label>
                  <div className="flex">
                    <span className="flex-1 px-3 py-2 bg-theme-disabled border border-theme-primary rounded-l text-white text-center font-bold">
                      {derivedStats?.ac || 10}
                    </span>
                    <span className="px-3 py-2 bg-theme-tertiary border-t border-r border-b border-theme-primary rounded-r text-theme-muted text-sm flex items-center">
                      (10 + DEX)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">Initiative</label>
                  <div className="flex">
                    <span className="flex-1 px-3 py-2 bg-theme-disabled border border-theme-primary rounded-l text-white text-center">
                      {(() => {
                        const initiative = derivedStats?.initiative || 0;
                        return (initiative >= 0 ? '+' : '') + initiative;
                      })()}
                    </span>
                    <span className="px-3 py-2 bg-theme-tertiary border-t border-r border-b border-theme-primary rounded-r text-theme-muted text-sm flex items-center">
                      (DEX)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">Proficiency Bonus</label>
                  <div className="flex">
                    <span className="flex-1 px-3 py-2 bg-theme-disabled border border-theme-primary rounded-l text-white text-center font-bold">
                      +{derivedStats?.proficiencyBonus || 2}
                    </span>
                    <span className="px-3 py-2 bg-theme-tertiary border-t border-r border-b border-theme-primary rounded-r text-theme-muted text-sm flex items-center">
                      (Level {formData.level})
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">Passive Perception</label>
                  <div className="flex">
                    <span className="flex-1 px-3 py-2 bg-theme-disabled border border-theme-primary rounded text-white text-center font-bold">
                      {(() => {
                        const wisMod = derivedStats?.abilityModifiers.WIS || 0;
                        const perceptionProf = formData.skills['Perception']?.proficient || false;
                        const profBonus = derivedStats?.proficiencyBonus || 2;
                        const passive = 10 + wisMod + (perceptionProf ? profBonus : 0);
                        return passive;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Saving Throws */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-accent-yellow-light">Saving Throws</h3>
            <div className="grid grid-cols-2 gap-3">
              {ABILITY_NAMES.map(ability => (
                <div key={ability} className="flex items-center justify-between">
                  <span className="text-sm">{ability}</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-16 px-2 py-1 bg-theme-tertiary border border-theme-primary rounded text-white text-center ${
                      (derivedStats?.savingThrows[ability as keyof typeof derivedStats.savingThrows] || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {(() => {
                        const save = derivedStats?.savingThrows[ability as keyof typeof derivedStats.savingThrows] || 0;
                        return (save >= 0 ? '+' : '') + save;
                      })()}
                    </span>
                    <input
                      type="checkbox"
                      checked={formData.savingThrows[ability as keyof typeof formData.savingThrows] || false}
                      onChange={(e) => {
                        updateFormData({
                          savingThrows: {
                            ...formData.savingThrows,
                            [ability]: e.target.checked
                          }
                        });
                      }}
                      className="w-4 h-4"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>



          {/* Musical Instrument Proficiencies */}
          <div className={`bg-theme-secondary rounded-lg p-4 ${formData.class !== 'Bard' ? 'opacity-50' : ''}`}>
            <h3 className={`text-lg font-bold mb-3 ${formData.class === 'Bard' ? 'text-accent-yellow-light' : 'text-theme-muted'}`}>
              Musical Instruments ({formData.selectedMusicalInstruments.length} / {(formData.num_instrument_choices || 0)} selected)
            </h3>
            {formData.class === 'Bard' ? (
              <>
                <p className="text-xs text-theme-muted mb-3">
                  Select {(formData.num_instrument_choices || 0)} musical instrument{(formData.num_instrument_choices || 0) !== 1 ? 's' : ''} for proficiency.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {['Lute', 'Flute', 'Drum', 'Horn', 'Viol', 'Lyre', 'Pan Flute', 'Shawm'].map(instrument => {
                    const isSelected = formData.selectedMusicalInstruments.includes(instrument);
                    const canSelect = formData.selectedMusicalInstruments.length < (formData.num_instrument_choices || 0);

                    return (
                      <button
                        key={instrument}
                        onClick={() => {
                          if (isSelected) {
                            // Remove instrument
                            updateFormData({
                              selectedMusicalInstruments: formData.selectedMusicalInstruments.filter(i => i !== instrument)
                            });
                          } else if (canSelect) {
                            // Add instrument
                            updateFormData({
                              selectedMusicalInstruments: [...formData.selectedMusicalInstruments, instrument]
                            });
                          }
                        }}
                        className={`p-2 rounded-lg text-left border-2 transition-all text-sm ${
                          isSelected
                            ? 'bg-accent-purple-darker border-purple-500 text-white'
                            : canSelect
                              ? 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary text-theme-primary'
                              : 'bg-theme-disabled border-theme-primary opacity-50 cursor-not-allowed text-theme-muted'
                        }`}
                      >
                        {instrument}
                      </button>
                    );
                  })}
                </div>
                {formData.selectedMusicalInstruments.length < (formData.num_instrument_choices || 0) && (
                  <div className="text-xs text-accent-yellow-light mt-2">
                    ⚠️ Please select {((formData.num_instrument_choices || 0) - formData.selectedMusicalInstruments.length)} more musical instrument{((formData.num_instrument_choices || 0) - formData.selectedMusicalInstruments.length) !== 1 ? 's' : ''}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-theme-muted italic">* Character is not a Bard</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - Features & Equipment */}
        <div className="col-span-3 space-y-4">
          {/* Personality Traits */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-accent-yellow-light">Personality</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Personality</label>
                <textarea
                  value={formData.featuresAndTraits.personality}
                  onChange={(e) => updateFormData({
                    featuresAndTraits: {
                      ...formData.featuresAndTraits,
                      personality: e.target.value
                    }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 bg-theme-tertiary border border-theme-primary rounded text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Ideals</label>
                <textarea
                  value={formData.featuresAndTraits.ideals}
                  onChange={(e) => updateFormData({
                    featuresAndTraits: {
                      ...formData.featuresAndTraits,
                      ideals: e.target.value
                    }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 bg-theme-tertiary border border-theme-primary rounded text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Bonds</label>
                <textarea
                  value={formData.featuresAndTraits.bonds}
                  onChange={(e) => updateFormData({
                    featuresAndTraits: {
                      ...formData.featuresAndTraits,
                      bonds: e.target.value
                    }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 bg-theme-tertiary border border-theme-primary rounded text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Flaws</label>
                <textarea
                  value={formData.featuresAndTraits.flaws}
                  onChange={(e) => updateFormData({
                    featuresAndTraits: {
                      ...formData.featuresAndTraits,
                      flaws: e.target.value
                    }
                  })}
                  rows={2}
                  className="w-full px-3 py-2 bg-theme-tertiary border border-theme-primary rounded text-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Languages */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-accent-yellow-light">Languages</h3>
            <div className="space-y-3">
              {/* Language dropdowns - start with 3, can add more */}
              {[0, 1, 2, ...Array(Math.max(0, (formData.languages?.length || 0) - 3))].map((index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={formData.languages?.[index] || ''}
                    onChange={(e) => {
                      const newLanguages = [...(formData.languages || [])];
                      newLanguages[index] = e.target.value;
                      // Remove empty entries at the end
                      while (newLanguages.length > 0 && !newLanguages[newLanguages.length - 1]) {
                        newLanguages.pop();
                      }
                      updateFormData({ languages: newLanguages });
                    }}
                    className="flex-1 px-3 py-2 bg-theme-tertiary border border-theme-primary rounded text-white"
                  >
                    <option value="">Select Language</option>
                    <option value="Common">Common</option>
                    <option value="Dwarvish">Dwarvish</option>
                    <option value="Elvish">Elvish</option>
                    <option value="Giant">Giant</option>
                    <option value="Gnomish">Gnomish</option>
                    <option value="Goblin">Goblin</option>
                    <option value="Halfling">Halfling</option>
                    <option value="Orc">Orc</option>
                    <option value="Abyssal">Abyssal</option>
                    <option value="Celestial">Celestial</option>
                    <option value="Draconic">Draconic</option>
                    <option value="Deep Speech">Deep Speech</option>
                    <option value="Infernal">Infernal</option>
                    <option value="Primordial">Primordial</option>
                    <option value="Sylvan">Sylvan</option>
                    <option value="Undercommon">Undercommon</option>
                  </select>
                  {index >= 3 && (
                    <button
                      onClick={() => {
                        const newLanguages = [...(formData.languages || [])];
                        newLanguages.splice(index, 1);
                        updateFormData({ languages: newLanguages });
                      }}
                      className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-sm"
                      title="Remove language"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {/* Add more languages button */}
              <button
                onClick={() => {
                  const newLanguages = [...(formData.languages || []), ''];
                  updateFormData({ languages: newLanguages });
                }}
                className="w-full px-3 py-2 bg-theme-tertiary hover:bg-theme-quaternary border border-theme-primary rounded text-theme-primary hover:text-white transition-colors"
              >
                + Add Another Language
              </button>
            </div>
          </div>

          {/* Equipment & Currency */}
          <div className="bg-theme-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-accent-yellow-light">Equipment & Currency</h3>

            {/* Currency */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-theme-muted mb-2">Currency</h4>
              <div className="grid grid-cols-4 gap-2">
                {(['cp', 'sp', 'gp', 'pp'] as const).map(currency => (
                  <div key={currency}>
                    <label className="block text-xs text-theme-muted mb-1 uppercase">{currency}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.currency[currency]}
                      onChange={(e) => updateFormData({
                        currency: {
                          ...formData.currency,
                          [currency]: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-2 py-1 bg-theme-tertiary border border-theme-primary rounded text-white text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment List - Simplified for now */}
            <div>
              <h4 className="text-sm font-medium text-theme-muted mb-2">Equipment</h4>
              <div className="text-sm text-theme-muted">
                Equipment management will be implemented in the next phase
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
