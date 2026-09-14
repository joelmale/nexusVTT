import React from 'react';
import { CharacterSheetProps } from '../../../types/components';
import {
  CharacterHeader,
  SavingThrows,
  CombatStatsPanel,
  AttacksAndActions,
  SpellcastingSection,
  EquipmentSection,
  ProficienciesAndLanguages,
  PaperCurrencyPanel,
  OfficialSkillsList,
  PaperAbilityScoresPanel,
} from '../index';

/**
 * PaperSheetLayout - Classic D&D 5e Paper Character Sheet Layout
 *
 * Mimics the official Wizards of the Coast paper character sheet design.
 * Layout matches the traditional 3-column structure with character info at top.
 */
export const PaperSheetLayout: React.FC<CharacterSheetProps> = (props) => {
  const { character } = props;



  return (
    <div className="paper-sheet-layout bg-[#f5ebd2] p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Character Action Header */}
      <CharacterHeader
        character={character}
        onClose={props.onClose}
        onDelete={props.onDelete}
        onShortRest={props.onShortRest}
        onLongRest={props.onLongRest}
        onLevelUp={props.onLevelUp}
        onLevelDown={props.onLevelDown}
        onOpenDiceTray={props.onOpenDiceTray}
      />

      {/* Character Header Information */}
      <div className="character-info-banner bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-4 shadow-md">
        <div className="grid grid-cols-12 gap-3">
          {/* Character Name - Large */}
          <div className="col-span-3">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-1">Character Name</div>
            <div className="text-2xl font-cinzel font-bold text-[#1e140a]">{character.name}</div>
          </div>

          {/* Class & Level */}
          <div className="col-span-2">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-1">Class & Level</div>
            <div className="text-lg font-eb-garamond font-semibold text-[#1e140a]">
              {character.class} {character.level}
            </div>
          </div>

          {/* Background */}
          <div className="col-span-2">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-1">Background</div>
            <div className="text-lg font-eb-garamond font-semibold text-[#1e140a]">{character.background}</div>
          </div>

          {/* Species */}
          <div className="col-span-2">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-1">Species</div>
            <div className="text-lg font-eb-garamond font-semibold text-[#1e140a]">{character.species}</div>
          </div>

          {/* Alignment */}
          <div className="col-span-2">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-1">Alignment</div>
            <div className="text-lg font-eb-garamond font-semibold text-[#1e140a]">{character.alignment}</div>
          </div>

          {/* Experience Points */}
          <div className="col-span-1">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-1">XP</div>
            <div className="text-lg font-eb-garamond font-semibold text-[#1e140a]">
              {character.experiencePoints || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Main Character Sheet Grid - 3 Columns */}
      <div className="grid grid-cols-12 gap-4">
        {/* ========================================
            LEFT COLUMN - Proficiency, Abilities, Saves, Skills
            ======================================== */}
        <div className="col-span-3 space-y-4">
          {/* Inspiration & Proficiency Bonus - AT TOP */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => props.onToggleInspiration(character.id)}
                  className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center transition-all ${
                    character.inspiration
                      ? 'bg-[#8b4513] border-[#1e140a] text-[#fcf6e3]'
                      : 'border-[#3d2817] hover:border-[#8b4513]'
                  }`}
                >
                  {character.inspiration && '✓'}
                </button>
                <span className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide">Inspiration</span>
              </div>
            </div>
            <div className="text-center py-2 bg-[#f5ebd2] rounded-sm border border-[#1e140a]/20">
              <div className="text-xs text-[#3d2817] font-cinzel font-bold uppercase mb-1 tracking-wide">Proficiency Bonus</div>
              <div className="text-2xl font-cinzel font-bold text-[#8b4513]">+{character.proficiencyBonus}</div>
            </div>
          </div>

          {/* Passive Perception */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide">Passive Wisdom (Perception)</span>
              <span className="text-2xl font-cinzel font-bold text-[#8b4513]">
                {10 + (character.skills.Perception?.value || 0)}
              </span>
            </div>
          </div>

          {/* Ability Scores */}
          <PaperAbilityScoresPanel
            character={character}
            setRollResult={props.setRollResult}
            onDiceRoll={props.onDiceRoll}
            onToggleInspiration={props.onToggleInspiration}
          />

          {/* Saving Throws */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-2 pb-1 border-b border-[#1e140a]/20">
              Saving Throws
            </div>
            <SavingThrows
              character={character}
              setRollResult={props.setRollResult}
              onDiceRoll={props.onDiceRoll}
            />
          </div>

          {/* Skills */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-2 pb-1 border-b border-[#1e140a]/20">
              Skills
            </div>
            <OfficialSkillsList
              character={character}
              setRollResult={props.setRollResult}
              onDiceRoll={props.onDiceRoll}
            />
          </div>
        </div>

        {/* ========================================
            CENTER COLUMN - Combat Stats, HP, Attacks
            ======================================== */}
        <div className="col-span-5 space-y-4">
          {/* Combat Stats Panel */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-4 shadow-md">
            <CombatStatsPanel
              character={character}
              setRollResult={props.setRollResult}
              onDiceRoll={props.onDiceRoll}
              onUpdateCharacter={props.onUpdateCharacter}
            />
          </div>

          {/* Attacks & Spellcasting */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-4 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-3 pb-2 border-b border-[#1e140a]/20">
              Attacks & Spellcasting
            </div>
            <AttacksAndActions
              character={character}
              setRollResult={props.setRollResult}
              onDiceRoll={props.onDiceRoll}
              onUpdateCharacter={props.onUpdateCharacter}
              layoutMode="paper-sheet"
            />
          </div>

          {/* Spellcasting Section (if character is a spellcaster) */}
          {character.spellcasting && (
            <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-4 shadow-md">
            <SpellcastingSection
              character={character}
              onUpdateCharacter={props.onUpdateCharacter}
              onSpellPreparation={() => {}}
            />
            </div>
          )}

          {/* Equipment */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-4 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-3 pb-2 border-b border-[#1e140a]/20">
              Equipment
            </div>
            <EquipmentSection
              character={character}
              onUpdateCharacter={props.onUpdateCharacter}
              onEquipArmor={props.onEquipArmor}
              onEquipWeapon={props.onEquipWeapon}
              onUnequipItem={props.onUnequipItem}
              onAddItem={props.onAddItem}
              onRemoveItem={props.onRemoveItem}
              setEquipmentModal={props.setEquipmentModal}
              layoutMode="paper-sheet"
            />
          </div>
        </div>

        {/* ========================================
            RIGHT COLUMN - Personality, Features
            ======================================== */}
        <div className="col-span-4 space-y-4">
          {/* Personality Traits */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-2">Personality Traits</div>
            <div className="min-h-[60px] p-2 bg-[#f5ebd2] rounded-sm border border-[#1e140a]/20 text-sm homemade-apple-regular text-[#3d2817] whitespace-pre-wrap">
              {character.featuresAndTraits?.personality || 'Not set'}
            </div>
          </div>

          {/* Ideals */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-2">Ideals</div>
            <div className="min-h-[50px] p-2 bg-[#f5ebd2] rounded-sm border border-[#1e140a]/20 text-sm homemade-apple-regular text-[#3d2817] whitespace-pre-wrap">
              {character.featuresAndTraits?.ideals || 'Not set'}
            </div>
          </div>

          {/* Bonds */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-2">Bonds</div>
            <div className="min-h-[50px] p-2 bg-[#f5ebd2] rounded-sm border border-[#1e140a]/20 text-sm homemade-apple-regular text-[#3d2817] whitespace-pre-wrap">
              {character.featuresAndTraits?.bonds || 'Not set'}
            </div>
          </div>

          {/* Flaws */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-2">Flaws</div>
            <div className="min-h-[50px] p-2 bg-[#f5ebd2] rounded-sm border border-[#1e140a]/20 text-sm homemade-apple-regular text-[#3d2817] whitespace-pre-wrap">
              {character.featuresAndTraits?.flaws || 'Not set'}
            </div>
          </div>

          {/* Species Traits */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-2">Species Traits</div>
            <div className="min-h-[60px] p-2 bg-[#f5ebd2] rounded-sm border border-[#1e140a]/20 text-sm space-y-1">
              {character.featuresAndTraits?.speciesTraits && character.featuresAndTraits.speciesTraits.length > 0 ? (
                character.featuresAndTraits.speciesTraits.map((trait, index) => (
                  <div key={index} className="homemade-apple-regular text-[#3d2817] text-xs leading-tight">
                    • {trait}
                  </div>
                ))
              ) : (
                <div className="homemade-apple-regular text-[#3d2817]/50 italic">No species traits</div>
              )}
            </div>
            </div>

           {/* Musical Instrument Proficiencies */}
           {character.featuresAndTraits?.musicalInstrumentProficiencies && character.featuresAndTraits.musicalInstrumentProficiencies.length > 0 && (
             <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
               <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-2">Musical Instruments</div>
               <div className="min-h-[40px] p-2 bg-[#f5ebd2] rounded-sm border border-[#1e140a]/20 text-sm space-y-1">
                 {character.featuresAndTraits.musicalInstrumentProficiencies.map((instrument, index) => (
                   <div key={index} className="homemade-apple-regular text-[#3d2817] text-xs leading-tight">
                     • {instrument}
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* Proficiencies & Languages */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-4 shadow-md">
            <div className="text-xs font-cinzel font-bold text-[#3d2817] uppercase tracking-wide mb-3 pb-2 border-b border-[#1e140a]/20">
              Other Proficiencies & Languages
            </div>
            <ProficienciesAndLanguages character={character} />
          </div>

          {/* Currency */}
          <div className="bg-[#fcf6e3] border-2 border-[#1e140a] rounded-sm p-3 shadow-md">
            <PaperCurrencyPanel
              character={character}
              onUpdateCharacter={props.onUpdateCharacter}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
