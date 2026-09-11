import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { CharacterSheetProps } from '../../../types/components';
import {
  CharacterHeader,
  CombatStatsPanel,
  AbilityScores,
  SkillsSection,
  SavingThrows,
  AttacksAndActions,
  ExperiencePoints,
  AttunementSlots,
  Conditions,
  CoinManagement,
  SpellcastingSection,
  EquipmentSection,
  ProficienciesAndLanguages,
  FeaturesSection,
  ActiveEquipmentPanel
} from '../index';
import { SpellPreparationModal } from '../../SpellPreparationModal';
import { getSpellsForClass } from '../../../services/dataService';

/**
 * ClassicDndLayout
 *
 * Traditional D&D 5e character sheet layout with 3 columns:
 * - Left: Ability scores (large circles) + Skills
 * - Center: Combat stats, attacks, equipment
 * - Right: Features, proficiencies, personality traits
 */
export const ClassicDndLayout: React.FC<CharacterSheetProps> = ({
  character, onClose, onDelete, setRollResult, onDiceRoll, onToggleInspiration, onFeatureClick,
  onLongRest, onShortRest, onLevelUp, onLevelDown, onUpdateCharacter, onEquipArmor, onEquipWeapon, onUnequipItem,
  onAddItem, onRemoveItem, setEquipmentModal, onOpenDiceTray
}) => {
  const [showSpellPreparationModal, setShowSpellPreparationModal] = useState(false);



  const handleSpellPreparationSave = (preparedSpells: string[]) => {
    onUpdateCharacter({
      ...character,
      spellcasting: {
        ...character.spellcasting!,
        preparedSpells
      }
    });
  };

  return (
    <div className="p-4 md:p-8 bg-theme-primary text-white min-h-screen pb-24">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <CharacterHeader
          character={character}
          onClose={onClose}
          onDelete={onDelete}
          onShortRest={onShortRest}
          onLongRest={onLongRest}
          onLevelUp={onLevelUp}
          onLevelDown={onLevelDown}
          onOpenDiceTray={onOpenDiceTray}
        />

        {/* 3-Column Traditional Layout */}
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT COLUMN - Core Stats + Progression */}
          <div className="col-span-3">
            {/* Two-Column Layout within Left Panel */}
            <div className="grid grid-cols-12 gap-4">
              {/* LEFT SUB-COLUMN (35%) - Ability Scores */}
              <div className="col-span-4 bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
                <h2 className="text-sm font-bold text-center mb-4 text-theme-muted uppercase tracking-wider font-cinzel">
                  Ability Scores
                </h2>
                <AbilityScores
                  character={character}
                  setRollResult={setRollResult}
                  onDiceRoll={onDiceRoll}
                  onToggleInspiration={onToggleInspiration}
                  layoutMode="classic-dnd"
                />
              </div>

              {/* RIGHT SUB-COLUMN (65%) - Inspiration, Proficiency, Saving Throws, Skills */}
              <div className="col-span-8 space-y-4">
                {/* Inspiration and Proficiency - Stacked Vertically */}
                <div className="space-y-3">
                  {/* Inspiration */}
                  <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-theme-muted uppercase tracking-wider font-cinzel">
                        Inspiration
                      </h3>
                      <button
                        onClick={() => onToggleInspiration(character.id)}
                        className={`w-10 h-10 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                          character.inspiration ? 'bg-accent-yellow border-2 border-yellow-400' : 'bg-theme-quaternary hover:bg-theme-hover border-2 border-gray-500'
                        }`}
                        title={character.inspiration ? 'Remove Inspiration' : 'Grant Inspiration'}
                      >
                        {character.inspiration && <Zap className="w-5 h-5 text-gray-900" />}
                      </button>
                    </div>
                  </div>

                  {/* Proficiency Bonus */}
                  <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-theme-muted uppercase tracking-wider font-cinzel">
                        Proficiency
                      </h3>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-yellow-300 shadow-lg flex items-center justify-center">
                        <span className="text-xl font-bold text-gray-900">
                          +{character.proficiencyBonus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Saving Throws */}
                <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
                   <h3 className="text-sm font-bold text-center mb-3 text-theme-muted uppercase tracking-wider font-cinzel">
                     Saving Throws
                   </h3>
                  <SavingThrows
                    character={character}
                    setRollResult={setRollResult}
                    onDiceRoll={onDiceRoll}
                    onUpdateCharacter={onUpdateCharacter}
                    layoutMode="classic-dnd"
                   />
                </div>

                {/* Skills */}
                <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
                   <h3 className="text-sm font-bold text-center mb-4 text-theme-muted uppercase tracking-wider font-cinzel">
                     Skills
                   </h3>
                  <SkillsSection
                    character={character}
                    setRollResult={setRollResult}
                    onDiceRoll={onDiceRoll}
                    layoutMode="classic-dnd"
                  />
                </div>
              </div>
            </div>

             {/* Currency - Condensed */}
             <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-2 shadow-lg">
               <CoinManagement
                 character={character}
                 onUpdateCharacter={onUpdateCharacter}
                 compact={true}
               />
             </div>

            {/* Progression - Experience & Attunement */}
            <div className="bg-gradient-to-br from-theme-secondary/80 via-theme-tertiary/60 to-theme-secondary/80 border border-theme-border rounded-lg p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between pb-2 border-b border-theme-border">
                <h2 className="text-sm font-bold text-theme-primary uppercase tracking-wider font-cinzel">
                  Progression
                </h2>
                <span className="text-[11px] uppercase tracking-[0.16em] text-theme-muted font-semibold">
                  XP & Attunement
                </span>
              </div>
              <div className="space-y-3 pt-2">
                <ExperiencePoints
                  character={character}
                  onUpdateCharacter={onUpdateCharacter}
                />
                <div className="border-t border-theme-border/60 pt-3">
                  <AttunementSlots character={character} />
                </div>
              </div>
            </div>
          </div>

          {/* CENTER COLUMN - Combat Stats, Attacks, Equipment */}
          <div className="col-span-6 space-y-4">
            {/* Combat Stats Panel - AC, Initiative, Speed, HP, Hit Dice, Death Saves */}
            <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
               <CombatStatsPanel
                 character={character}
                 setRollResult={setRollResult}
                 onDiceRoll={onDiceRoll}
                 onUpdateCharacter={onUpdateCharacter}
                 layoutMode="classic-dnd"
               />
             </div>



            {/* Attacks & Actions */}
            <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
               <h2 className="text-sm font-bold mb-3 text-theme-muted uppercase tracking-wider font-cinzel">
                 Attacks & Spellcasting
               </h2>
                <AttacksAndActions
                  character={character}
                  setRollResult={setRollResult}
                  onDiceRoll={onDiceRoll}
                  onUpdateCharacter={onUpdateCharacter}
                  layoutMode="classic-dnd"
                />
             </div>

             {/* Spellcasting (if applicable) */}
             {character.spellcasting && (
               <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
                 <h2 className="text-sm font-bold mb-3 text-theme-muted uppercase tracking-wider font-cinzel">
                   Spellcasting
                 </h2>
                <SpellcastingSection
                  character={character}
                  onUpdateCharacter={onUpdateCharacter}
                  onSpellPreparation={() => setShowSpellPreparationModal(true)}
                />
              </div>
             )}

              {/* Inventory */}
             <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
                <h2 className="text-sm font-bold mb-3 text-theme-muted uppercase tracking-wider font-cinzel">
                  Inventory
                </h2>
              <EquipmentSection
                character={character}
                onUpdateCharacter={onUpdateCharacter}
                onEquipArmor={onEquipArmor}
                onEquipWeapon={onEquipWeapon}
                onUnequipItem={onUnequipItem}
                onAddItem={onAddItem}
                onRemoveItem={onRemoveItem}
                setEquipmentModal={setEquipmentModal}
              />
            </div>


          </div>

          {/* RIGHT COLUMN - Features, Proficiencies, Traits */}
          <div className="col-span-3 space-y-4">
              {/* Active Equipment */}
              <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
                 <h2 className="text-sm font-bold mb-3 text-theme-muted uppercase tracking-wider font-cinzel">
                   Active Equipment
                 </h2>
                 <ActiveEquipmentPanel
                   character={character}
                   onUnequipItem={(itemSlug) => onUnequipItem(character.id, itemSlug)}
                 />
               </div>

              {/* Proficiencies & Languages */}
              <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
                <h2 className="text-sm font-bold mb-3 text-theme-muted uppercase tracking-wider font-cinzel">
                  Proficiencies & Languages
                </h2>
                <ProficienciesAndLanguages character={character} />
              </div>

              {/* Conditions */}
             <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-2 shadow-lg">
               <Conditions
                 character={character}
                 onUpdateCharacter={onUpdateCharacter}
               />
             </div>

             {/* Features & Traits */}
            <div className="bg-theme-secondary border border-theme-secondary rounded-lg p-4 shadow-lg">
               <h2 className="text-sm font-bold mb-3 text-theme-muted uppercase tracking-wider font-cinzel">
                 Features & Traits
               </h2>
              <FeaturesSection
                character={character}
                onFeatureClick={onFeatureClick}
                layoutMode="classic-dnd"
              />
             </div>
           </div>
        </div>

        {/* Spell Preparation Modal */}
        {character.spellcasting?.spellcastingType === 'prepared' && (
          <SpellPreparationModal
            character={character}
            availableSpells={getSpellsForClass(character.class)}
            isOpen={showSpellPreparationModal}
            onClose={() => setShowSpellPreparationModal(false)}
            onSave={handleSpellPreparationSave}
          />
        )}
      </div>
    </div>
  );
};
