import React, { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Edit3, Sparkles, Heart, Shield, Zap, HelpCircle, Pencil } from 'lucide-react';
import { CharacterProfile } from '../data/characterProfiles';
import { loadClasses, getAllSpecies, BACKGROUNDS, getModifier, getCantripsByClass, getLeveledSpellsByClass } from '../services/dataService';
import { SpellSelectionData, Edition } from '../types/dnd';
import { getSpellcastingType } from '../utils/spellUtils';
import { assignAbilityScoresByClass } from '../utils/abilityScoreUtils';
import SkillTooltip from './SkillTooltip';
import SpellEditModal from './SpellEditModal';
import SkillEditModal from './SkillEditModal';
import AbilityScoreEditModal from './AbilityScoreEditModal';

interface PersonalitySummaryProps {
  profile: CharacterProfile;
  selectedClass?: string;
  selectedSpecies?: string; // Renamed from selectedRace
  selectedBackground?: string;
  spellSelection?: SpellSelectionData;
  onSpellSelectionChange?: (selection: SpellSelectionData) => void;
  customSkills?: string[] | null;
  onSkillsChange?: (skills: string[]) => void;
  customAbilities?: Record<string, number> | null;
  onAbilitiesChange?: (abilities: Record<string, number>) => void;
  onContinue: () => void;
  onBack: () => void;
  edition: Edition; // Added edition
}

const PersonalitySummary: React.FC<PersonalitySummaryProps> = ({
  profile,
  selectedClass,
  selectedSpecies, // Renamed from selectedRace
  selectedBackground,
  spellSelection,
  onSpellSelectionChange,
  customSkills,
  onSkillsChange,
  customAbilities,
  onAbilitiesChange,
  onContinue,
  onBack,
  edition // Added edition
}) => {


  // Editable state
  const [editingClass, setEditingClass] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState(false); // Renamed from editingRace
  const [editingBackground, setEditingBackground] = useState(false);
  const [showArrayModal, setShowArrayModal] = useState(false);
  const [showSpellModal, setShowSpellModal] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showAbilityModal, setShowAbilityModal] = useState(false);

  const [currentClass, setCurrentClass] = useState(selectedClass || profile.recommendedClasses[0]?.class || '');
  const [currentSpecies, setCurrentSpecies] = useState(selectedSpecies || profile.recommendedRaces[0]?.race || ''); // Renamed from currentRace
  const [currentBackground, setCurrentBackground] = useState(selectedBackground || profile.recommendedBackgrounds[0]?.background || '');

  // Extract base class name (remove subclass in parentheses)
  const extractBaseName = (fullName: string): string => {
    const parenIndex = fullName.indexOf(' (');
    return parenIndex > 0 ? fullName.substring(0, parenIndex) : fullName;
  };

  // Calculate base abilities (separate from characterPreview so it can be used in modals)
  const baseAbilities = useMemo(() => {
    const allClasses = loadClasses(edition); // Pass edition
    const baseClassName = extractBaseName(currentClass);
    const selectedClassData = allClasses.find(c => c.name === baseClassName);

    // Use custom abilities if user edited them, otherwise assign based on class priorities
    return customAbilities || (selectedClassData ? assignAbilityScoresByClass(selectedClassData.slug) : { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 });
  }, [currentClass, customAbilities, edition]);

  // Calculate character preview
  const characterPreview = useMemo(() => {
    const allClasses = loadClasses(edition); // Pass edition
    const baseClassName = extractBaseName(currentClass);
    const selectedClassData = allClasses.find(c => c.name === baseClassName);

    // Calculate modifiers
    const abilities = {
      STR: { score: baseAbilities.STR, modifier: getModifier(baseAbilities.STR) },
      DEX: { score: baseAbilities.DEX, modifier: getModifier(baseAbilities.DEX) },
      CON: { score: baseAbilities.CON, modifier: getModifier(baseAbilities.CON) },
      INT: { score: baseAbilities.INT, modifier: getModifier(baseAbilities.INT) },
      WIS: { score: baseAbilities.WIS, modifier: getModifier(baseAbilities.WIS) },
      CHA: { score: baseAbilities.CHA, modifier: getModifier(baseAbilities.CHA) }
    };

    // Use custom skills if user edited them, otherwise auto-select
    let proficientSkills: string[];
    if (customSkills) {
      proficientSkills = customSkills;
    } else {
      // Get proficient skills from class (take first N skills as defaults)
      const numSkills = selectedClassData?.num_skill_choices || 0;
      const classSkills = selectedClassData?.skill_proficiencies?.slice(0, numSkills) || [];

      // Get background skills
      // Note: In a full implementation, we'd filter BACKGROUNDS by edition too, but here we just match by name
      const backgroundData = BACKGROUNDS.find(bg => bg.name === currentBackground);
      const backgroundSkills = backgroundData?.skill_proficiencies || [];

      // Combine and deduplicate skills
      proficientSkills = [...new Set([...classSkills, ...backgroundSkills])];
    }

    return {
      abilities,
      proficientSkills,
      hitDie: selectedClassData?.hit_die || 8,
      armorClass: 10 + abilities.DEX.modifier // Base AC + Dex modifier
    };
  }, [currentClass, currentBackground, customSkills, baseAbilities, edition]);

  // Compute spell information for display
  const spellInfo = useMemo(() => {
    const allClasses = loadClasses(edition); // Pass edition
    const extractBaseName = (fullName: string): string => {
      const parenIndex = fullName.indexOf(' (');
      return parenIndex > 0 ? fullName.substring(0, parenIndex) : fullName;
    };
    const baseClassName = extractBaseName(currentClass);
    const selectedClassData = allClasses.find(c => c.name === baseClassName);

    if (!selectedClassData) return null;

    const spellcastingType = getSpellcastingType(selectedClassData.slug);
    if (!spellcastingType || !spellSelection) return null;

    const availableCantrips = getCantripsByClass(selectedClassData.slug);
    const availableSpells = getLeveledSpellsByClass(selectedClassData.slug, 1);

    const cantripNames = spellSelection.selectedCantrips
      .map(slug => availableCantrips.find(s => s.slug === slug)?.name)
      .filter(Boolean) as string[];

    let spellNames: string[] = [];
    let spellType = '';

    if (spellcastingType === 'known') {
      spellNames = (spellSelection.knownSpells || [])
        .map(slug => availableSpells.find(s => s.slug === slug)?.name)
        .filter(Boolean) as string[];
      spellType = 'Known Spells';
    } else if (spellcastingType === 'prepared') {
      spellNames = (spellSelection.preparedSpells || [])
        .map(slug => availableSpells.find(s => s.slug === slug)?.name)
        .filter(Boolean) as string[];
      spellType = 'Prepared Spells';
    } else if (spellcastingType === 'wizard') {
      const spellbookNames = (spellSelection.spellbook || [])
        .map(slug => availableSpells.find(s => s.slug === slug)?.name)
        .filter(Boolean) as string[];
      const preparedNames = (spellSelection.preparedSpells || [])
        .map(slug => availableSpells.find(s => s.slug === slug)?.name)
        .filter(Boolean) as string[];

      return {
        hasspells: true,
        cantrips: cantripNames,
        spellbook: spellbookNames,
        prepared: preparedNames,
        spellcastingType,
        classSlug: selectedClassData.slug
      };
    }

    return {
      hasSpells: cantripNames.length > 0 || spellNames.length > 0,
      cantrips: cantripNames,
      spells: spellNames,
      spellType,
      spellcastingType,
      classSlug: selectedClassData.slug
    };
  }, [currentClass, spellSelection, edition]);

  // Get actual data for dropdowns
  const availableClasses = loadClasses(edition).map(cls => cls.name).sort();
  const availableSpecies = getAllSpecies(edition).map(species => species.name).sort(); // Renamed from availableRaces
  const availableBackgrounds = ['Acolyte', 'Criminal', 'Entertainer', 'Folk Hero', 'Guild Artisan', 'Hermit', 'Noble', 'Outlander', 'Sage', 'Sailor', 'Soldier', 'Urchin'];

  const handleContinue = useCallback(() => {
    onContinue();
  }, [onContinue]);

  const getProfileIcon = () => {
    switch (profile.name.toLowerCase()) {
      case 'the guardian': return <Shield className="w-6 h-6 text-accent-green-light" />;
      case 'the precisionist': return <Zap className="w-6 h-6 text-accent-blue-light" />;
      case 'the survivor': return <Sparkles className="w-6 h-6 text-accent-yellow-light" />;
      case 'the scholar': return <Sparkles className="w-6 h-6 text-accent-purple-light" />;
      case 'the prodigy': return <Heart className="w-6 h-6 text-pink-400" />;
      case 'the oracle': return <Shield className="w-6 h-6 text-accent-blue-light" />;
      case 'the wildheart': return <Sparkles className="w-6 h-6 text-accent-green-light" />;
      default: return <Sparkles className="w-6 h-6 text-accent-purple-light" />;
    }
  };

  return (
    <div className="min-h-screen bg-theme-primary text-white font-sans">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-4 py-2 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Personality</span>
          </button>
          <h1 className="text-3xl font-bold text-accent-purple-light">Character Summary</h1>
          <div className="w-40"></div> {/* Spacer */}
        </div>

        {/* Personality Profile Header */}
        <div className="bg-theme-secondary rounded-xl p-6 mb-8">
          <div className="flex items-center space-x-3 mb-4">
            {getProfileIcon()}
            <h2 className="text-2xl font-bold text-accent-yellow-light">You Are {profile.name}</h2>
          </div>
          <p className="text-theme-tertiary leading-relaxed">{profile.description}</p>
        </div>

        {/* Editable Selections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Class Selection */}
          <div className="bg-theme-secondary rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-accent-green-light">Class</h3>
              <button
                onClick={() => setEditingClass(!editingClass)}
                className="text-theme-muted hover:text-white transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {editingClass ? (
              <select
                value={currentClass}
                onChange={(e) => setCurrentClass(e.target.value)}
                className="w-full p-2 bg-theme-tertiary border border-theme-primary rounded text-white"
              >
                {availableClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            ) : (
              <div className="text-white font-medium">{currentClass}</div>
            )}

            <div className="mt-3 text-xs text-theme-muted">
              {profile.recommendedClasses.find(c => c.class === currentClass)?.reason ||
               "Selected based on your personality preferences"}
            </div>
          </div>

          {/* Species Selection */}
          <div className="bg-theme-secondary rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-accent-blue-light">Species</h3>
              <button
                onClick={() => setEditingSpecies(!editingSpecies)}
                className="text-theme-muted hover:text-white transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {editingSpecies ? (
              <select
                value={currentSpecies}
                onChange={(e) => setCurrentSpecies(e.target.value)}
                className="w-full p-2 bg-theme-tertiary border border-theme-primary rounded text-white"
              >
                {availableSpecies.map(species => (
                  <option key={species} value={species}>{species}</option>
                ))}
              </select>
            ) : (
              <div className="text-white font-medium">{currentSpecies}</div>
            )}

            <div className="mt-3 text-xs text-theme-muted">
              {profile.recommendedRaces.find(r => r.race === currentSpecies)?.reason ||
               "Selected based on your personality preferences"}
            </div>
          </div>

          {/* Background Selection */}
          <div className="bg-theme-secondary rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-accent-purple-light">Background</h3>
              <button
                onClick={() => setEditingBackground(!editingBackground)}
                className="text-theme-muted hover:text-white transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {editingBackground ? (
              <select
                value={currentBackground}
                onChange={(e) => setCurrentBackground(e.target.value)}
                className="w-full p-2 bg-theme-tertiary border border-theme-primary rounded text-white"
              >
                {availableBackgrounds.map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            ) : (
              <div className="text-white font-medium">{currentBackground}</div>
            )}

            <div className="mt-3 text-xs text-theme-muted">
              {profile.recommendedBackgrounds.find(b => b.background === currentBackground)?.reason ||
               "Selected based on your personality preferences"}
            </div>
          </div>
        </div>

        {/* Character Preview */}
        <div className="bg-theme-secondary rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-accent-blue-light mb-4">Character Preview</h3>

          {/* Ability Scores */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-accent-yellow-light">Ability Scores</h4>
              {onAbilitiesChange && (
                <button
                  onClick={() => setShowAbilityModal(true)}
                  className="text-theme-muted hover:text-white transition-colors p-1"
                  aria-label="Edit ability scores"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {Object.entries(characterPreview.abilities).map(([ability, data]) => (
                <div key={ability} className="bg-theme-tertiary p-3 rounded text-center">
                  <div className="text-xs text-theme-muted uppercase">{ability}</div>
                  <div className="text-lg font-bold text-accent-yellow-light">{data.score}</div>
                  <div className="text-sm text-accent-green-light">
                    {data.modifier >= 0 ? '+' : ''}{data.modifier}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-theme-muted">
                Using standard array distribution. These can be adjusted during character creation.
              </p>
              <button
                onClick={() => setShowArrayModal(true)}
                className="text-theme-muted hover:text-white transition-colors"
                aria-label="Learn about standard array"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Combat Stats */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-red-300 mb-3">Combat Stats</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-theme-tertiary p-3 rounded text-center">
                <div className="text-xs text-theme-muted">Hit Die</div>
                <div className="text-lg font-bold text-red-300">d{characterPreview.hitDie}</div>
              </div>
              <div className="bg-theme-tertiary p-3 rounded text-center">
                <div className="text-xs text-theme-muted">Armor Class</div>
                <div className="text-lg font-bold text-blue-300">{characterPreview.armorClass}</div>
              </div>
              <div className="bg-theme-tertiary p-3 rounded text-center">
                <div className="text-xs text-theme-muted">Hit Points</div>
                <div className="text-lg font-bold text-green-300">{characterPreview.hitDie}</div>
              </div>
              <div className="bg-theme-tertiary p-3 rounded text-center">
                <div className="text-xs text-theme-muted">Proficiency</div>
                <div className="text-lg font-bold text-accent-yellow-light">+2</div>
              </div>
            </div>
          </div>

          {/* Proficient Skills */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-purple-300">Proficient Skills</h4>
              {onSkillsChange && (
                <button
                  onClick={() => setShowSkillModal(true)}
                  className="text-theme-muted hover:text-white transition-colors p-1"
                  aria-label="Edit skills"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {characterPreview.proficientSkills.map((skill, idx) => (
                <SkillTooltip key={idx} skillName={skill}>
                  <span className="px-3 py-1 bg-purple-700 text-purple-200 text-sm rounded cursor-help transition-all hover:bg-accent-purple">
                    {skill}
                  </span>
                </SkillTooltip>
              ))}
            </div>
            <p className="text-xs text-theme-muted mt-2">
              These skills were chosen from a pool of the best stats given your choices.
            </p>
          </div>

          {/* Spells Section (if spellcaster) */}
          {spellInfo && (spellInfo.hasSpells || spellInfo.hasspells) && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-blue-300">Spells</h4>
                <button
                  onClick={() => setShowSpellModal(true)}
                  className="text-theme-muted hover:text-white transition-colors p-1"
                  aria-label="Edit spells"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {/* Cantrips */}
              {spellInfo.cantrips && spellInfo.cantrips.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-sm font-semibold text-theme-muted mb-2">Cantrips</h5>
                  <div className="flex flex-wrap gap-2">
                    {spellInfo.cantrips.map((spell, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-700 text-blue-200 text-sm rounded">
                        {spell}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Wizard: Spellbook + Prepared */}
              {spellInfo.spellcastingType === 'wizard' && (
                <>
                  {spellInfo.spellbook && spellInfo.spellbook.length > 0 && (
                    <div className="mb-3">
                      <h5 className="text-sm font-semibold text-theme-muted mb-2">Spellbook</h5>
                      <div className="flex flex-wrap gap-2">
                        {spellInfo.spellbook.map((spell, idx) => (
                          <span key={idx} className="px-3 py-1 bg-purple-700 text-purple-200 text-sm rounded">
                            {spell}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {spellInfo.prepared && spellInfo.prepared.length > 0 && (
                    <div className="mb-3">
                      <h5 className="text-sm font-semibold text-theme-muted mb-2">Prepared</h5>
                      <div className="flex flex-wrap gap-2">
                        {spellInfo.prepared.map((spell, idx) => (
                          <span key={idx} className="px-3 py-1 bg-accent-green-dark text-green-200 text-sm rounded">
                            {spell}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Known/Prepared Casters */}
              {spellInfo.spellcastingType !== 'wizard' && spellInfo.spells && spellInfo.spells.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-sm font-semibold text-theme-muted mb-2">{spellInfo.spellType}</h5>
                  <div className="flex flex-wrap gap-2">
                    {spellInfo.spells.map((spell, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-700 text-purple-200 text-sm rounded">
                        {spell}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-theme-muted mt-2">
                Auto-selected based on your class. Click the pencil to customize.
              </p>
            </div>
          )}
        </div>

        {/* Key Stats Recommendations */}
        <div className="bg-theme-secondary rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-accent-red-light mb-4">Recommended Ability Score Focus</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {profile.keyStats.map((stat, idx) => (
              <div key={idx} className="bg-theme-tertiary p-3 rounded text-center">
                <div className="text-accent-yellow-light font-medium">{stat}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-theme-muted mt-3">
            These priorities will help optimize your character for the playstyle that matches your personality.
          </p>
        </div>

        {/* Final Question */}
        <div className="bg-theme-secondary rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-accent-yellow-light mb-3">One Final Question</h3>
          <p className="text-lg text-theme-tertiary italic">{profile.finalQuestion}</p>
          <p className="text-xs text-theme-disabled mt-2">
            Take a moment to reflect on this question as you create your character.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white transition-colors flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Personality
          </button>
          <button
            onClick={handleContinue}
            className="px-6 py-3 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white font-semibold transition-colors flex items-center"
          >
            Continue to Customization
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>

      {/* Standard Array Info Modal */}
      {showArrayModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-theme-secondary rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-accent-yellow-light">Standard Array</h3>
              <button
                onClick={() => setShowArrayModal(false)}
                className="text-theme-muted hover:text-white transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="mb-4">
              <div className="flex justify-center gap-2 mb-4">
                {[15, 14, 13, 12, 10, 8].map((score, idx) => (
                  <div key={idx} className="bg-theme-tertiary px-3 py-2 rounded text-center">
                    <div className="text-lg font-bold text-accent-yellow-light">{score}</div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-theme-tertiary mb-4 leading-relaxed">
              The standard array is a method for determining ability scores for your new D&D character.
              This method gives you 6 predetermined scores: <span className="font-bold text-accent-yellow-light">15, 14, 13, 12, 10, and 8</span>.
            </p>

            <p className="text-sm text-theme-tertiary mb-4 leading-relaxed">
              To use this method, assign each standard array number to one of the 6 ability scores:
              <span className="font-semibold"> Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma</span>.
            </p>

            <p className="text-sm text-theme-muted italic">
              The personality wizard automatically assigns these values based on your class and playstyle preferences,
              but you can redistribute them in the next step if you want to customize further.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowArrayModal(false)}
                className="px-4 py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spell Edit Modal */}
      {spellInfo && spellSelection && onSpellSelectionChange && (
        <SpellEditModal
          classSlug={spellInfo.classSlug}
          level={1}
          currentSelection={spellSelection}
          abilities={baseAbilities}
          isOpen={showSpellModal}
          onClose={() => setShowSpellModal(false)}
          onSave={(newSelection) => {
            onSpellSelectionChange(newSelection);
            setShowSpellModal(false);
          }}
        />
      )}

      {/* Skill Edit Modal */}
      {onSkillsChange && (
        <SkillEditModal
          classSlug={loadClasses().find(c => c.name === currentClass.split(' (')[0])?.slug || ''}
          backgroundSlug={currentBackground}
          currentSkills={characterPreview.proficientSkills}
          isOpen={showSkillModal}
          onClose={() => setShowSkillModal(false)}
          onSave={(skills) => {
            onSkillsChange(skills);
            setShowSkillModal(false);
          }}
        />
      )}

      {/* Ability Score Edit Modal */}
      {onAbilitiesChange && (
        <AbilityScoreEditModal
          currentScores={baseAbilities}
          isOpen={showAbilityModal}
          onClose={() => setShowAbilityModal(false)}
          onSave={(abilities) => {
            onAbilitiesChange(abilities);
            setShowAbilityModal(false);
          }}
        />
      )}
    </div>
  );
};

export default PersonalitySummary;
