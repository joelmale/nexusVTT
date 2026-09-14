import React, { useState, useEffect } from 'react';
import { Shield, Sword, Dice6, Trophy, Zap, AlertTriangle, Coins, Sparkles, Package, Star, Activity, Dumbbell, ListChecks } from 'lucide-react';
import { CharacterSheetProps } from '../../../types/components';
import { Character } from '../../../types/dnd';
import { DiceRoll } from '../../../services/diceService';
import {
  CharacterHeader,
  CharacterStats,
  AbilityScores,
  SkillsSection,
  SavingThrows,
  AttacksAndActions,
  HitDice,
  ExperiencePoints,
  Conditions,
  CoinManagement,
  CollapsibleSection,
  SpellcastingSection,
  EquipmentSection,
  FeaturesSection
} from '../index';
import { getSpellsForClass } from '../../../services/dataService';
import { SpellPreparationModal } from '../../SpellPreparationModal';

export const ModernStackedLayout: React.FC<CharacterSheetProps> = ({
  character, onClose, onDelete, setRollResult, onDiceRoll, onToggleInspiration, onFeatureClick,
  onLongRest, onShortRest, onLevelUp, onLevelDown, onUpdateCharacter, onEquipArmor, onEquipWeapon, onUnequipItem,
  onAddItem, onRemoveItem, setEquipmentModal, onOpenDiceTray
}) => {
  const [showSpellPreparationModal, setShowSpellPreparationModal] = useState(false);
  const [adjustMode, setAdjustMode] = useState(false);
  const [panelOrder, setPanelOrder] = useState<string[]>([
    'coreStats', 'abilityScores', 'skills', 'savingThrows',
    'attacks', 'hitDice', 'experience', 'attunement',
    'proficiencies', 'languages', 'conditions', 'coin',
    'spellcasting', 'equipment', 'features'
  ]);
  const [draggedPanel, setDraggedPanel] = useState<string | null>(null);



  // Collapse state management
  const getDefaultCollapsedState = (character: Character) => ({
    'coreStats': false,      // Always expanded - AC, HP, Initiative, etc.
    'abilityScores': false,  // Always expanded - STR, DEX, CON, etc.
    'skills': false,         // Always expanded - frequently referenced
    'savingThrows': false, // Core combat info
    'attacks': true,     // Collapsed by default
    'hitDice': character.hitDice.current === character.hitDice.max, // Collapse if full
    'experience': character.level >= 20, // Collapse if max level
    'attunement': character.level < 6, // Collapse if no slots
    'proficiencies': true,
    'languages': true,   // Languages collapsed by default
    'conditions': !character.conditions?.length, // Expand if has conditions
    'coin': true,
    'spellcasting': !character.spellcasting,
    'equipment': true,
    'features': true
  });

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(`character-${character.id}-collapsed-sections`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall back to defaults if parsing fails
        return getDefaultCollapsedState(character);
      }
    }
    return getDefaultCollapsedState(character);
  });

  // Save preferences
  useEffect(() => {
    localStorage.setItem(`character-${character.id}-collapsed-sections`, JSON.stringify(collapsedSections));
  }, [collapsedSections, character.id]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const expandAll = () => {
    setCollapsedSections(Object.keys(collapsedSections).reduce((acc, key) => ({
      ...acc,
      [key]: false
    }), {}));
  };

  const collapseAll = () => {
    setCollapsedSections(Object.keys(collapsedSections).reduce((acc, key) => ({
      ...acc,
      [key]: true
    }), {}));
  };

  const toggleAdjustMode = () => {
    if (!adjustMode) {
      // Enter adjust mode - collapse all panels
      collapseAll();
      setAdjustMode(true);
    } else {
      // Exit adjust mode
      setAdjustMode(false);
      setDraggedPanel(null);
    }
  };

  const handleDragStart = (panelId: string) => {
    setDraggedPanel(panelId);
  };

  const handleDragEnd = () => {
    setDraggedPanel(null);
  };

  const handleDrop = (targetPanelId: string) => {
    if (!draggedPanel || draggedPanel === targetPanelId) return;

    const draggedIndex = panelOrder.indexOf(draggedPanel);
    const targetIndex = panelOrder.indexOf(targetPanelId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...panelOrder];
    // Remove dragged item
    newOrder.splice(draggedIndex, 1);
    // Insert at target position
    newOrder.splice(targetIndex, 0, draggedPanel);

    setPanelOrder(newOrder);
    setDraggedPanel(null);
  };

  const getPanelConfig = (panelId: string) => {
    const configs = {
      coreStats: {
        title: 'Core Stats',
        icon: Activity,
        className: 'border-red-500 bg-red-900',
        badge: `${character.hitPoints}/${character.maxHitPoints} HP`,
        content: (
          <CharacterStats
            character={character}
            setRollResult={setRollResult}
            onDiceRoll={onDiceRoll}
            onUpdateCharacter={onUpdateCharacter}
          />
        )
      },
      abilityScores: {
        title: 'Ability Scores',
        icon: Dumbbell,
        className: 'border-blue-500 bg-blue-900',
        content: (
          <AbilityScores
            character={character}
            setRollResult={setRollResult}
            onDiceRoll={onDiceRoll}
            onToggleInspiration={onToggleInspiration}
          />
        )
      },
      skills: {
        title: 'Skills',
        icon: ListChecks,
        className: 'border-green-500 bg-green-900',
        content: (
          <SkillsSection
            character={character}
            setRollResult={setRollResult}
            onDiceRoll={onDiceRoll}
          />
        )
      },
      savingThrows: {
        title: 'Saving Throws',
        icon: Shield,
        className: 'border-yellow-500 bg-yellow-900',
        content: (
          <SavingThrows
            character={character}
            setRollResult={setRollResult}
            onDiceRoll={onDiceRoll}
          />
        )
      },
      attacks: {
        title: 'Attacks & Actions',
        icon: Sword,
        className: 'border-orange-500 bg-orange-900',
        content: (
          <AttacksAndActions
            character={character}
            setRollResult={setRollResult}
            onDiceRoll={onDiceRoll as (roll: DiceRoll & { description: string; damageNotation?: string; damageType?: string }) => void}
            onUpdateCharacter={onUpdateCharacter}
            layoutMode="modern"
          />
        )
      },
      hitDice: {
        title: 'Hit Dice',
        icon: Dice6,
        className: 'border-accent-purple bg-purple-900',
        badge: `${character.hitDice.current}/${character.hitDice.max}`,
        content: (
          <HitDice
            character={character}
            onUpdateCharacter={onUpdateCharacter}
          />
        )
      },
      experience: {
        title: 'Experience',
        icon: Trophy,
        className: 'border-cyan-500 bg-cyan-900',
        badge: character.level >= 20 ? 'Max Level' : `${character.experiencePoints} XP`,
        content: (
          <ExperiencePoints
            character={character}
            onUpdateCharacter={onUpdateCharacter}
          />
        )
      },
      attunement: {
        title: 'Attunement Slots',
        icon: Sparkles,
        className: 'border-pink-500 bg-pink-900',
        badge: character.level >= 6 ? `${character.level >= 17 ? 3 : character.level >= 11 ? 2 : 1}/3` : 'Locked',
        content: (
          <div className="text-sm text-theme-tertiary">
            <p>Attunement slots available based on character level.</p>
            <p>Level 6-10: 1 slot, Level 11-16: 2 slots, Level 17+: 3 slots</p>
          </div>
        )
      },
      proficiencies: {
        title: 'Proficiencies',
        icon: Star,
        className: 'border-indigo-500 bg-indigo-900',
        content: (
          <div className="text-sm text-theme-tertiary">
            <p>Armor: {character.proficiencies?.armor?.join(', ') || 'None'}</p>
            <p>Weapons: {character.proficiencies?.weapons?.join(', ') || 'None'}</p>
            <p>Tools: {character.proficiencies?.tools?.join(', ') || 'None'}</p>
          </div>
        )
      },
      conditions: {
        title: 'Conditions',
        icon: AlertTriangle,
        className: 'border-accent-red bg-red-900',
        badge: character.conditions?.length || 0,
        content: (
          <Conditions
            character={character}
            onUpdateCharacter={onUpdateCharacter}
          />
        )
      },
      coin: {
        title: 'Coin & Equipment',
        icon: Coins,
        className: 'border-amber-500 bg-amber-900',
        content: (
          <CoinManagement
            character={character}
            onUpdateCharacter={onUpdateCharacter}
          />
        )
      },
      spellcasting: {
        title: 'Spellcasting',
        icon: Zap,
        className: 'border-violet-500 bg-violet-900',
        content: (
          <SpellcastingSection
            character={character}
            onUpdateCharacter={onUpdateCharacter}
            onSpellPreparation={() => setShowSpellPreparationModal(true)}
          />
        )
      },
      equipment: {
        title: 'Equipment',
        icon: Package,
        className: 'border-emerald-500 bg-emerald-900',
        content: (
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
        )
      },
      features: {
        title: 'Features & Traits',
        icon: Star,
        className: 'border-rose-500 bg-rose-900',
        content: (
          <FeaturesSection
            character={character}
            onFeatureClick={onFeatureClick}
            layoutMode="modern-stacked"
          />
        )
      }
    };
    return configs[panelId as keyof typeof configs];
  };

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
      <div className="max-w-4xl mx-auto space-y-3">
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

        {/* Global Section Controls */}
        <div className="flex gap-2 mb-4 p-3 bg-theme-secondary/50 rounded-lg">
          <button
            onClick={expandAll}
            className="px-3 py-1 bg-accent-blue hover:bg-accent-blue-light rounded text-sm font-medium transition-colors"
            title="Expand all sections"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1 bg-theme-quaternary hover:bg-theme-hover rounded text-sm font-medium transition-colors"
            title="Collapse all sections"
          >
            Collapse All
          </button>
          <button
            onClick={toggleAdjustMode}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              adjustMode
                ? 'bg-accent-green hover:bg-accent-green text-white'
                : 'bg-accent-purple hover:bg-accent-purple-light text-white'
            }`}
            title={adjustMode ? 'Exit layout adjustment mode' : 'Enter layout adjustment mode'}
          >
            {adjustMode ? 'Done' : 'Adjust Layout'}
          </button>
          <span className="text-xs text-theme-muted self-center ml-4">
            {Object.values(collapsedSections).filter(Boolean).length} of {Object.keys(collapsedSections).length} sections collapsed
            {adjustMode && ' • Adjust Mode Active'}
          </span>
        </div>

        {/* Dynamic panel rendering based on custom order */}
        {panelOrder.map(panelId => {
          const config = getPanelConfig(panelId);
          if (!config) return null;

          return (
            <CollapsibleSection
              key={panelId}
              title={config.title}
              icon={config.icon}
              isCollapsed={collapsedSections[panelId] || (adjustMode && panelId !== 'coreStats' && panelId !== 'abilityScores')}
              onToggle={() => !adjustMode && toggleSection(panelId)}
              className={config.className}
              {...(('badge' in config) && { badge: config.badge })}
              isAdjustMode={adjustMode}
              panelId={panelId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              isDragged={draggedPanel === panelId}
            >
              {config.content}
            </CollapsibleSection>
          );
        })}

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
