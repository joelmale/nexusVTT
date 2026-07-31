 
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Plus, Trash2, BookOpen, Shield, Download, Upload, Settings } from 'lucide-react';
// REFACTORED: Loader2 import removed - was unused
import { CharacterCreationWizard } from './components/CharacterCreationWizard';
import { LevelUpWizard } from './components/LevelUpWizard/LevelUpWizard';
import { CharacterSheet } from './components/CharacterSheet';
import NewCharacterModal from './components/NewCharacterModal';
import ManualEntryScreen from './components/ManualEntryScreen';
import PersonalityWizard from './components/PersonalityWizard';
import { MonsterLibrary, MonsterStatBlock, CreateMonsterModal, EmbeddableMonsterPage, EmbeddableEncounterPage } from './components/MonsterLibrary';
import { NPCLibrary } from './components/NPCLibrary';
import { SpellbookManager } from './components/SpellbookManager/SpellbookManager';
import { EncounterView } from './components/EncounterView';
import { EncounterManager } from './components/EncounterManager/EncounterManager.tsx';



import { DiceBox3D } from './components/DiceSystem/DiceBox3D';
import { RollHistoryModal, RollHistoryTicker } from './components/RollHistory';
import { RollResultOverlay } from './components/RollResultOverlay';
import { ScreenFlash } from './components/ScreenFlash';
import { FeatureModal } from './components/FeatureModal';
import { EquipmentDetailModal } from './components/EquipmentDetailModal';
import { ChooseCantripModal } from './components/ChooseCantripModal';
import ChooseSubclassModal from './components/ChooseSubclassModal';
import AbilityScoreIncreaseModal from './components/AbilityScoreIncreaseModal';
import { DiceRollerModal } from './components/DiceRollerModal';
import SettingsModal from './components/SettingsModal';
import { CharacterEditModal } from './components/CharacterEditModal';
import { RestingScreen } from './components/RestingScreen';
import { generateUUID, DiceRoll } from './services/diceService';
import { featureDescriptions } from './utils/featureDescriptions';
import { loadClasses, loadEquipment, loadFeatures, getSubclassesByClass, PROFICIENCY_BONUSES, getModifier, SPELL_SLOTS_BY_CLASS, AppSubclass } from './services/dataService';
import { getAllCharacters, addCharacter, deleteCharacter, updateCharacter } from './services/dbService';
import { resetResources } from './utils/resourceUtils';
import { APP_VERSION } from './version';
// REFACTORED: Language utilities moved to languageUtils.ts for the wizard
// Still used here in main App for character sheet display - can be removed once main app is refactored

import { Ability, Character, CharacterCreationData, Equipment, EquippedItem, Feature, Monster, UserMonster, Edition } from './types/dnd';

import { useDiceContext, useLayout } from './hooks';
import { TabNavigation, TabId } from './components/TabNavigation';











// --- D&D 5e Character Interface (Must be adhered to) ---







// --- Mock API Data and Ruleset Functions (Simulating dnd5eapi.co) ---





const EQUIPMENT_DATABASE: Equipment[] = loadEquipment();


// Sprint 3: Feat Database (loaded from JSON and SRD)
// FEAT_DATABASE is now imported directly from dataService where needed

// Sprint 4: Level-based Equipment Packages
// Based on DMG "Starting at Higher Levels" wealth guidelines







// Load classes from SRD
// const SRD_CLASSES = loadClasses();





// Helper to get all classes from categories and fill in defaults


// Sprint 2: Spell helper functions


// Load alignment data from JSON (combines SRD data with custom examples)

















// --- Utility Functions ---

const formatModifier = (mod: number): string => mod >= 0 ? `+${mod}` : `${mod}`;




// --- Character Creation Wizard Steps ---























// --- Main Wizard Component (Now in separate module) ---


/** Main Application Component */
const App: React.FC = () => {
  // Use DiceContext for dice rolling functionality
  const { rollHistory, latestRoll, rollDice, clearHistory, updateRollWithRealResults } = useDiceContext();

  // Use LayoutContext for layout mode
  const { layoutMode } = useLayout();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(new Set());
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

  // Monster Library state
  const [activeTab, setActiveTab] = useState<TabId>('characters');
  const [selectedMonster, setSelectedMonster] = useState<Monster | UserMonster | null>(null);
  const [editingMonster, setEditingMonster] = useState<UserMonster | null>(null);

  // Character editing state
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [showEncounterView, setShowEncounterView] = useState(false);
  const [showEncounterManager, setShowEncounterManager] = useState(false);
  const [currentEncounterId, setCurrentEncounterId] = useState<string>('');
  const [rollResult, setRollResult] = useState<{
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>
  }>({ text: 'Ready to Roll!', value: null });
  const [featureModal, setFeatureModal] = useState<{name: string, description: string, source?: string} | null>(null);
  const [equipmentModal, setEquipmentModal] = useState<Equipment | { slug: string } | null>(null);
  const [cantripModalState, setCantripModalState] = useState<{isOpen: boolean, characterId: string | null, characterClass: string | null}>({ isOpen: false, characterId: null, characterClass: null });
  const [subclassModalState, setSubclassModalState] = useState<{isOpen: boolean, characterId: string | null, characterClass: string | null}>({ isOpen: false, characterId: null, characterClass: null });
  const [asiModalState, setAsiModalState] = useState<{isOpen: boolean, characterId: string | null}>({ isOpen: false, characterId: null });
  const [levelUpWizardState, setLevelUpWizardState] = useState<{isOpen: boolean, characterId: string | null}>({ isOpen: false, characterId: null });

  // New character creation modal states
  const [isNewCharacterModalOpen, setIsNewCharacterModalOpen] = useState<boolean>(false);
  const [creationMethod, setCreationMethod] = useState<'manual' | 'wizard' | 'personality' | null>(null);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState<boolean>(false);
  const [selectedEdition, setSelectedEdition] = useState<Edition>('2024');

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isDiceTrayModalOpen, setIsDiceTrayModalOpen] = useState<boolean>(false);
  const [isResting, setIsResting] = useState<'short' | 'long' | null>(null);
  const [restChanges, setRestChanges] = useState<{
    hpRestored: number;
    hitDiceRestored: number;
    spellSlotsRestored: number;
    resourcesReset: string[];
  } | null>(null);

  // Roll result overlay state
  const [showRollOverlay, setShowRollOverlay] = useState(false);
  const [overlayRoll, setOverlayRoll] = useState<DiceRoll | null>(null);

  // Screen flash state for critical rolls
  const [screenFlashType, setScreenFlashType] = useState<'success' | 'failure' | null>(null);



  const selectedCharacter = useMemo(() => {
    return characters.find(c => c.id === selectedCharacterId);
  }, [characters, selectedCharacterId]);

  // Handle feature click
  const handleFeatureClick = useCallback((feature: string | Feature) => {
    const featureName = typeof feature === 'string' ? feature : feature.name;

    // Try to find the feature in SRD data first
    const allFeatures = loadFeatures();
    const srdFeature = allFeatures.find(f => f.name === featureName);

    if (srdFeature && srdFeature.desc && srdFeature.desc.length > 0) {
      setFeatureModal({
        name: featureName,
        description: srdFeature.desc.join('\n\n'),
        source: 'SRD'
      });
    } else {
      // Fallback to manual descriptions
      const featureDesc = featureDescriptions[featureName];
      if (featureDesc) {
        setFeatureModal({ name: featureName, ...featureDesc });
      } else {
        setFeatureModal({ name: featureName, description: 'No description available for this feature.' });
      }
    }
  }, []);



  // Handle dice roll - use DiceContext's rollDice function
  const handleDiceRoll = useCallback((roll: DiceRoll) => {
    rollDice(roll);
    // Overlay is now triggered by useEffect watching latestRoll
  }, [rollDice]);

  // Show overlay when latestRoll has completed results
  useEffect(() => {
    // Only show overlay when:
    // 1. latestRoll exists
    // 2. diceResults has been populated (length > 0)
    // 3. We're not already showing the overlay for this roll
    if (latestRoll &&
        latestRoll.diceResults.length > 0 &&
        overlayRoll?.id !== latestRoll.id) {

      setOverlayRoll(latestRoll);
      setShowRollOverlay(true);

      // Trigger screen flash for critical rolls
      if (latestRoll.critical === 'success') {
        setScreenFlashType('success');
      } else if (latestRoll.critical === 'failure') {
        setScreenFlashType('failure');
      }
    }
  }, [latestRoll, overlayRoll?.id]);

  // Load characters from IndexedDB
  // Helper function to synchronize equipped items with inventory
  const syncEquippedItems = useCallback((character: Character): Character => {
    const equippedArmor = character.inventory?.find(item =>
      item.equipped && loadEquipment().find(eq => eq.slug === item.equipmentSlug)?.armor_category &&
      loadEquipment().find(eq => eq.slug === item.equipmentSlug)?.armor_category !== 'Shield'
    )?.equipmentSlug;

    const equippedWeapons = character.inventory?.filter(item =>
      item.equipped && (
        loadEquipment().find(eq => eq.slug === item.equipmentSlug)?.weapon_category ||
        loadEquipment().find(eq => eq.slug === item.equipmentSlug)?.armor_category === 'Shield'
      )
    ).map(item => item.equipmentSlug) || [];

    return { ...character, equippedArmor, equippedWeapons };
  }, []);

  const loadCharacters = useCallback(async () => {
    try {
      const chars = await getAllCharacters();
      // Synchronize equipped items for each character
      const syncedChars = chars.map(syncEquippedItems);
      setCharacters(syncedChars);
    } catch {
      // Error loading characters
    }
  }, [syncEquippedItems]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  // Toggle character selection for export
  const toggleCharacterSelection = useCallback((id: string) => {
    setSelectedCharacterIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Delete all selected characters
  const handleDeleteSelectedCharacters = useCallback(async () => {
    if (selectedCharacterIds.size === 0) return;

    const selectedCount = selectedCharacterIds.size;
    const characterNames = characters
      .filter(c => selectedCharacterIds.has(c.id))
      .map(c => c.name)
      .join(', ');

    if (!window.confirm(`Are you sure you want to delete ${selectedCount} selected character${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.\n\nCharacters: ${characterNames}`)) {
      return;
    }

    try {
      // Delete all selected characters
      for (const characterId of selectedCharacterIds) {
        await deleteCharacter(characterId);
      }

      // Clear selection and reload characters
      setSelectedCharacterIds(new Set());
      setSelectedCharacterId(null);
      await loadCharacters();
      setRollResult({ text: `Successfully deleted ${selectedCount} character${selectedCount !== 1 ? 's' : ''}.`, value: null });
    } catch {
      setRollResult({ text: 'Error deleting selected characters.', value: null });
    }
  }, [selectedCharacterIds, characters, loadCharacters]);

  // CRUD Operations
  const handleDeleteCharacter = useCallback(async (id: string) => {
    const character = characters.find(c => c.id === id);
    const characterName = character?.name || 'this character';

    if (!window.confirm(`Are you sure you want to delete ${characterName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteCharacter(id);
      setSelectedCharacterId(null);
      setRollResult({ text: 'Character deleted successfully.', value: null });
      await loadCharacters();
    } catch {
      setRollResult({ text: 'Error deleting character.', value: null });
    }
  }, [characters, loadCharacters]);

  // Export selected characters (or all if none selected) as JSON
  const handleExportData = useCallback(() => {
    const charactersToExport = selectedCharacterIds.size > 0
      ? characters.filter(c => selectedCharacterIds.has(c.id))
      : characters;

    // Broadcast to parent or opener window for NexusVTT integration
    const messagePayload = {
      type: 'NEXUS_FORGE_EXPORT',
      payload: charactersToExport
    };
    
    if (window.parent !== window) {
      window.parent.postMessage(messagePayload, '*');
    } else if (window.opener) {
      window.opener.postMessage(messagePayload, '*');
    }

    const dataStr = JSON.stringify(charactersToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `5e_characters_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    const exportCount = charactersToExport.length;
    const message = selectedCharacterIds.size > 0
      ? `${exportCount} selected character${exportCount !== 1 ? 's' : ''} exported successfully!`
      : `All ${exportCount} character${exportCount !== 1 ? 's' : ''} exported successfully!`;
    setRollResult({ text: message, value: null });
  }, [characters, selectedCharacterIds]);

  // Import characters from JSON
  const handleImportData = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string) as Character[];

        // Validate imported data
        if (!Array.isArray(importedData)) {
          throw new Error('Invalid data format');
        }

        // Add each character
        for (const char of importedData) {
          // Generate new ID to avoid conflicts
          const newChar = { ...char, id: generateUUID() };
          await addCharacter(newChar);
        }

        await loadCharacters();
        setRollResult({ text: `Imported ${importedData.length} character(s)!`, value: null });
      } catch {
        setRollResult({ text: 'Error importing data. Check file format.', value: null });
      }
    };
    reader.readAsText(file);
  }, [loadCharacters]);

  const handleToggleInspiration = useCallback(async (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const updatedCharacter = { ...character, inspiration: !character.inspiration };

    try {
      await updateCharacter(updatedCharacter);
      // Optimistically update the state
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
    } catch {
      // Optionally revert state if DB update fails
    }
  }, [characters]);

  // Calculate specific rest changes for display
  const calculateRestChanges = (character: Character) => {
    const changes = {
      hpRestored: character.maxHitPoints - character.hitPoints,
      hitDiceRestored: character.hitDice.max - character.hitDice.current,
      spellSlotsRestored: 0,
      resourcesReset: [] as string[]
    };

    // Calculate spell slots restored
    if (character.spellcasting?.usedSpellSlots) {
      changes.spellSlotsRestored = character.spellcasting.usedSpellSlots.reduce((sum, used) => sum + used, 0);
    }

    // Calculate resources reset
    if (character.resources) {
      character.resources.forEach(resource => {
        if (resource.rechargeType === 'long-rest' || resource.rechargeType === 'short-rest') {
          if ((resource.currentUses || 0) < resource.maxUses) {
            changes.resourcesReset.push(resource.name);
          }
        }
      });
    }

    return changes;
  };

  const handleLongRest = useCallback(async (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) {
      return;
    }

    // Calculate specific changes for display
    const restChanges = calculateRestChanges(character);

    // Execute rest logic FIRST
    let updatedCharacter = { ...character };
    updatedCharacter.hitPoints = character.maxHitPoints;
    updatedCharacter.hitDice = {
      ...updatedCharacter.hitDice,
      current: updatedCharacter.hitDice.max,
    };
    // Reset Action Surge uses (legacy field)
    updatedCharacter.actionSurgeUsed = 0;

    // Reset all resources that recharge on long rest
    updatedCharacter = resetResources(updatedCharacter, 'long-rest');

    // Restore spell slots
    if (updatedCharacter.spellcasting) {
      updatedCharacter.spellcasting = {
        ...updatedCharacter.spellcasting,
        usedSpellSlots: Array(updatedCharacter.spellcasting.spellSlots.length).fill(0)
      };
    }

    // Save the rested character
    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
    } catch {
      return; // Don't show resting screen if save failed
    }

    // NOW show resting screen with specific changes
    setIsResting('long');
    setRestChanges(restChanges);
    // RestingScreen will handle completion via onComplete callback
  }, [characters]);

  const handleShortRest = useCallback(async (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    if (character.hitDice.current <= 0) {
      setRollResult({ text: "No hit dice remaining!", value: null });
      return;
    }

    const diceToSpendStr = prompt(`How many hit dice to spend? (Available: ${character.hitDice.current}/${character.hitDice.max})`);
    if (!diceToSpendStr) return;

    const diceToSpend = parseInt(diceToSpendStr, 10);
    if (isNaN(diceToSpend) || diceToSpend <= 0 || diceToSpend > character.hitDice.current) {
      setRollResult({ text: "Invalid number of hit dice.", value: null });
      return;
    }

    const allClasses = loadClasses();
    const classData = allClasses.find(c => c.name === character.class);
    if (!classData) return;

    const hitDie = classData.hit_die;
    const conModifier = character.abilities.CON.modifier;
    let hpRecovered = 0;
    for (let i = 0; i < diceToSpend; i++) {
      hpRecovered += Math.max(1, Math.floor(Math.random() * hitDie) + 1 + conModifier);
    }

    const newHP = Math.min(character.maxHitPoints, character.hitPoints + hpRecovered);
    const updatedCharacter = {
      ...character,
      hitPoints: newHP,
      hitDice: {
        ...character.hitDice,
        current: character.hitDice.current - diceToSpend,
      },
    };

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
      setRollResult({ text: `Recovered ${hpRecovered} HP.`, value: newHP });

    } catch {
      // Error taking short rest
    }
  }, [characters]);

  const handleLevelUp = useCallback(async (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    if (character.level >= 20) {
      setRollResult({ text: `${character.name} is already at max level!`, value: null });
      return;
    }

    // Open the Level-Up Wizard
    setLevelUpWizardState({ isOpen: true, characterId });
  }, [characters]);

  const handleLevelUpComplete = useCallback(async (updatedCharacter: Character) => {
    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c));
      setRollResult({ text: `${updatedCharacter.name} is now level ${updatedCharacter.level}!`, value: null });
    } catch {
      // Error saving level-up
      setRollResult({ text: 'Error saving level-up', value: null });
    }
  }, []);

  const handleLevelDown = useCallback(async (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    if (character.level <= 1) {
      setRollResult({ text: `${character.name} is already at level 1.`, value: null });
      return;
    }

    const newLevel = character.level - 1;
    const newProficiencyBonus = PROFICIENCY_BONUSES[newLevel - 1] || character.proficiencyBonus;

    const allClasses = loadClasses();
    const classData = allClasses.find(c => c.name === character.class);
    if (!classData) {
      return;
    }

    const hitDie = classData.hit_die;
    const conModifier = character.abilities.CON.modifier;
    const hpReduction = Math.max(1, Math.floor(hitDie / 2) + 1 + conModifier);

    const updatedCharacter = {
      ...character,
      level: newLevel,
      proficiencyBonus: newProficiencyBonus,
      maxHitPoints: Math.max(1, character.maxHitPoints - hpReduction),
      hitPoints: Math.max(1, character.maxHitPoints - hpReduction),
    };

    if (updatedCharacter.spellcasting) {
      const classSpellSlots = SPELL_SLOTS_BY_CLASS[classData.slug]?.[newLevel];
      if (classSpellSlots) {
        updatedCharacter.spellcasting = {
          ...updatedCharacter.spellcasting,
          spellSlots: classSpellSlots,
        };
      }

      const cantripChoiceAtLevel = updatedCharacter.spellcasting.cantripChoicesByLevel?.[character.level];
      if (cantripChoiceAtLevel) {
        updatedCharacter.spellcasting = {
          ...updatedCharacter.spellcasting,
          cantripsKnown: updatedCharacter.spellcasting.cantripsKnown.filter(c => c !== cantripChoiceAtLevel),
        };
        delete updatedCharacter.spellcasting.cantripChoicesByLevel?.[character.level];
      }
    }

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
      setRollResult({ text: `${character.name} is now level ${newLevel}.`, value: null });

    } catch {
      // Error leveling down character
    }
  }, [characters]);

  const handleUpdateCharacter = useCallback(async (updatedCharacter: Character) => {
    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c));
    } catch {
      // Error updating character
    }
  }, []);

  // New character creation handlers
  const handleSelectManualEntry = useCallback((edition: Edition) => {
    setIsNewCharacterModalOpen(false);
    setSelectedEdition(edition);
    setIsManualEntryOpen(true);
  }, []);

  const handleSelectWizard = useCallback((edition: Edition) => {
    setIsNewCharacterModalOpen(false);
    setSelectedEdition(edition);
    setCreationMethod('wizard');
    setIsWizardOpen(true);
  }, []);

  const handleSelectPersonality = useCallback((edition: Edition) => {
    setIsNewCharacterModalOpen(false);
    setSelectedEdition(edition);
    setCreationMethod('personality');
  }, []);

  const handlePersonalityComplete = useCallback(async (characterData: CharacterCreationData) => {
    // Validate received data
    if (!characterData) {
      setRollResult({
        text: 'Error: No character data received.',
        value: null
      });
      return;
    }

    if (!characterData.speciesSlug || !characterData.classSlug) {
      setRollResult({
        text: 'Error: Missing required character data.',
        value: null
      });
      return;
    }

    // Create the character directly from the summary screen
    try {
      const { calculateCharacterStats } = await import('./utils/characterCreationUtils');
      const { addCharacter } = await import('./services/dbService');
      const { generateUUID } = await import('./services/diceService');

      const character = calculateCharacterStats(characterData);

      const characterWithId = {
        ...character,
        id: generateUUID()
      };

      await addCharacter(characterWithId);

      await loadCharacters();

      setCreationMethod(null);

      setRollResult({
        text: `Character "${characterWithId.name || 'Unnamed Hero'}" created successfully from personality profile!`,
        value: null
      });
    } catch (error) {
      setRollResult({
        text: `Error creating character from personality profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        value: null
      });
    }
  }, [loadCharacters]);

  const handleBackToModal = useCallback(() => {
    setCreationMethod(null);
    setIsNewCharacterModalOpen(true);
  }, []);

  // Equipment management handlers
  const recalculateAC = useCallback((character: Character): number => {
    let armorClass = 10 + character.abilities.DEX.modifier; // Default unarmored

    if (character.equippedArmor) {
      const armor = EQUIPMENT_DATABASE.find(eq => eq.slug === character.equippedArmor);
      if (armor?.armor_class) {
        if (armor.armor_category === 'Light') {
          armorClass = armor.armor_class.base + character.abilities.DEX.modifier;
        } else if (armor.armor_category === 'Medium') {
          const dexBonus = Math.min(character.abilities.DEX.modifier, armor.armor_class.max_bonus || 2);
          armorClass = armor.armor_class.base + dexBonus;
        } else if (armor.armor_category === 'Heavy') {
          armorClass = armor.armor_class.base;
        }
      }
    }

    // Add shield bonus if equipped
    if (character.equippedWeapons?.some(slug => {
      const item = EQUIPMENT_DATABASE.find(eq => eq.slug === slug);
      return item?.armor_category === 'Shield';
    })) {
      armorClass += 2;
    }

    return armorClass;
  }, []);

  const handleEquipArmor = useCallback(async (characterId: string, armorSlug: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const armor = EQUIPMENT_DATABASE.find(eq => eq.slug === armorSlug);
    if (!armor || armor.equipment_category !== 'Armor') return;

    // Update character with new equipped armor and unequip other armor pieces
    const updatedCharacter = {
      ...character,
      equippedArmor: armorSlug,
      inventory: character.inventory?.map(item => {
        const eq = EQUIPMENT_DATABASE.find(eqItem => eqItem.slug === item.equipmentSlug);
        const isArmorItem = eq?.equipment_category === 'Armor' && eq?.armor_category !== 'Shield';

        if (item.equipmentSlug === armorSlug) {
          return { ...item, equipped: true };
        }

        if (isArmorItem) {
          return { ...item, equipped: false };
        }

        return item;
      }),
    };

    // Recalculate AC
    updatedCharacter.armorClass = recalculateAC(updatedCharacter);

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
    } catch {
      // Error equipping armor
    }
  }, [characters, recalculateAC]);

  const handleEquipWeapon = useCallback(async (characterId: string, weaponSlug: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const weapon = EQUIPMENT_DATABASE.find(eq => eq.slug === weaponSlug);
    // Allow both weapons and shields to be equipped as weapons
    if (!weapon?.weapon_category && weapon?.armor_category !== 'Shield') return;

    // Add weapon to equipped weapons (max 2)
    const equippedWeapons = character.equippedWeapons || [];
    if (!equippedWeapons.includes(weaponSlug)) {
      const updatedWeapons = [...equippedWeapons, weaponSlug].slice(0, 2); // Max 2 weapons

      const updatedCharacter = {
        ...character,
        equippedWeapons: updatedWeapons,
        inventory: character.inventory?.map(item =>
          item.equipmentSlug === weaponSlug ? { ...item, equipped: true } : item
        ),
      };

      try {
        await updateCharacter(updatedCharacter);
        setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
      } catch {
        // Error equipping weapon
      }
    }
  }, [characters]);

  const handleUnequipItem = useCallback(async (characterId: string, itemSlug: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const updatedCharacter = { ...character };

    // Check if it's armor
    if (character.equippedArmor === itemSlug) {
      updatedCharacter.equippedArmor = undefined;
      updatedCharacter.armorClass = recalculateAC(updatedCharacter);
    }

    // Check if it's a weapon
    if (character.equippedWeapons?.includes(itemSlug)) {
      updatedCharacter.equippedWeapons = character.equippedWeapons.filter(slug => slug !== itemSlug);
    }

    // Update inventory
    updatedCharacter.inventory = character.inventory?.map(item =>
      item.equipmentSlug === itemSlug ? { ...item, equipped: false } : item
    );

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
    } catch {
      // Error unequipping item
    }
  }, [characters, recalculateAC]);

  const handleAddItem = useCallback(async (characterId: string, equipmentSlug: string, quantity: number = 1) => {
    const equipment = EQUIPMENT_DATABASE.find(eq => eq.slug === equipmentSlug);
    if (!equipment) return;

    // Use functional state updates so multiple rapid calls accumulate correctly
    await new Promise<void>((resolve) => {
      setCharacters(prev => {
        const character = prev.find(c => c.id === characterId);
        if (!character) return prev;

        const existingItem = character.inventory?.find(item => item.equipmentSlug === equipmentSlug);
        let updatedInventory: EquippedItem[];
        if (existingItem) {
          updatedInventory = character.inventory!.map(item =>
            item.equipmentSlug === equipmentSlug ? { ...item, quantity: item.quantity + quantity } : item
          );
        } else {
          updatedInventory = [...(character.inventory || []), { equipmentSlug, quantity, equipped: false }];
        }

        const updatedCharacter = { ...character, inventory: updatedInventory };
        // Fire and forget persistence; resolve immediately so chained calls keep state in sync
        updateCharacter(updatedCharacter).catch(() => {});

        resolve();
        return prev.map(c => c.id === characterId ? updatedCharacter : c);
      });
    });
  }, []);

  const handleRemoveItem = useCallback(async (characterId: string, equipmentSlug: string, quantity: number = 1) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const existingItem = character.inventory?.find(item => item.equipmentSlug === equipmentSlug);
    if (!existingItem) return;

    let updatedInventory: EquippedItem[];
    if (existingItem.quantity <= quantity) {
      // Remove item entirely
      updatedInventory = character.inventory!.filter(item => item.equipmentSlug !== equipmentSlug);

      // Unequip if equipped
      if (character.equippedArmor === equipmentSlug) {
        character.equippedArmor = undefined;
      }
      if (character.equippedWeapons?.includes(equipmentSlug)) {
        character.equippedWeapons = character.equippedWeapons.filter(slug => slug !== equipmentSlug);
      }
    } else {
      // Decrease quantity
      updatedInventory = character.inventory!.map(item =>
        item.equipmentSlug === equipmentSlug ? { ...item, quantity: item.quantity - quantity } : item
      );
    }

    const updatedCharacter = { ...character, inventory: updatedInventory };
    updatedCharacter.armorClass = recalculateAC(updatedCharacter);

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
    } catch {
      // Error removing item
    }
  }, [characters, recalculateAC]);

  const handleCantripSelected = useCallback(async (cantripSlug: string) => {
    const { characterId } = cantripModalState;
    if (!characterId) return;

    const character = characters.find(c => c.id === characterId);
    if (!character || !character.spellcasting) return;

    const updatedCharacter = {
      ...character,
      spellcasting: {
        ...character.spellcasting,
        cantripsKnown: [...character.spellcasting.cantripsKnown, cantripSlug],
        cantripChoicesByLevel: {
          ...character.spellcasting.cantripChoicesByLevel,
          [character.level]: cantripSlug,
        },
      },
    };

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
      setCantripModalState({ isOpen: false, characterId: null, characterClass: null });
    } catch {
      // Error selecting cantrip
    }
  }, [characters, cantripModalState]);

  const handleSubclassSelected = useCallback(async (subclass: AppSubclass) => {
    const { characterId } = subclassModalState;
    if (!characterId) return;

    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const updatedCharacter = {
      ...character,
      subclass: subclass.slug,
    };

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
      setSubclassModalState({ isOpen: false, characterId: null, characterClass: null });
    } catch {
      // Error selecting subclass
    }
  }, [characters, subclassModalState]);

  const handleAsiApply = useCallback(async (increases: Partial<Record<Ability, number>>) => {
    const { characterId } = asiModalState;
    if (!characterId) return;

    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    const updatedAbilities = { ...character.abilities };
    for (const ability of Object.keys(increases) as Ability[]) {
      const increase = increases[ability] || 0;
      updatedAbilities[ability as keyof typeof updatedAbilities].score += increase;
      updatedAbilities[ability as keyof typeof updatedAbilities].modifier = getModifier(updatedAbilities[ability as keyof typeof updatedAbilities].score);
    }

    const updatedCharacter = {
      ...character,
      abilities: updatedAbilities,
    };

    try {
      await updateCharacter(updatedCharacter);
      setCharacters(prev => prev.map(c => c.id === characterId ? updatedCharacter : c));
      setAsiModalState({ isOpen: false, characterId: null });
    } catch {
      // Error applying ASI
    }
  }, [characters, asiModalState]);

  // Full-screen views (CharacterSheet or MonsterStatBlock)
  if (selectedCharacter) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex-1 overflow-auto">
           <CharacterSheet
              character={selectedCharacter}
              onClose={() => setSelectedCharacterId(null)}
              onDelete={handleDeleteCharacter}
              onEdit={() => setEditingCharacter(selectedCharacter)}
             setRollResult={setRollResult}
             onDiceRoll={handleDiceRoll}
             onToggleInspiration={handleToggleInspiration}
             onFeatureClick={handleFeatureClick}
             onLongRest={handleLongRest}
             onShortRest={handleShortRest}
             onLevelUp={handleLevelUp}
             onLevelDown={handleLevelDown}
             onUpdateCharacter={handleUpdateCharacter}
             onEquipArmor={handleEquipArmor}
             onEquipWeapon={handleEquipWeapon}
             onUnequipItem={handleUnequipItem}
             onAddItem={handleAddItem}
             onRemoveItem={handleRemoveItem}
             setEquipmentModal={setEquipmentModal}
               onOpenDiceTray={() => {
                 setIsDiceTrayModalOpen(true);
               }}
           />
        </div>
        <RollHistoryTicker rolls={rollHistory} layoutMode={layoutMode} />
        <DiceBox3D
          latestRoll={latestRoll}
          onRollResults={(rollId, diceValues, total) => {
            updateRollWithRealResults(rollId, diceValues, total);
          }}
        />
        <RollHistoryModal rolls={rollHistory} onClear={clearHistory} />
        <RollResultOverlay
          roll={overlayRoll}
          isVisible={showRollOverlay}
          onDismiss={() => setShowRollOverlay(false)}
        />
        <ScreenFlash
          type={screenFlashType}
          onComplete={() => setScreenFlashType(null)}
        />
        <FeatureModal feature={featureModal} onClose={() => setFeatureModal(null)} />
        <EquipmentDetailModal equipment={equipmentModal} onClose={() => setEquipmentModal(null)} />

        {/* Dice Roller Modal - needs to be here when character sheet is open */}
        <DiceRollerModal
          isOpen={isDiceTrayModalOpen}
           onClose={() => {
             setIsDiceTrayModalOpen(false);
           }}
        />

        {/* Level-Up Wizard - needs to be here when character sheet is open */}
        {levelUpWizardState.isOpen && levelUpWizardState.characterId === selectedCharacter.id && (
          <LevelUpWizard
            isOpen={levelUpWizardState.isOpen}
            character={selectedCharacter}
            onClose={() => setLevelUpWizardState({ isOpen: false, characterId: null })}
            onComplete={handleLevelUpComplete}
          />
        )}
      </div>
    );
  }

  if (selectedMonster) {
    return (
      <>
        <MonsterStatBlock
          monster={selectedMonster}
          onClose={() => setSelectedMonster(null)}
          onEdit={
            'isCustom' in selectedMonster && selectedMonster.isCustom
              ? () => {
                  setEditingMonster(selectedMonster);
                  setSelectedMonster(null);
                }
              : undefined
          }
        />
        {editingMonster && (
          <div className="fixed inset-0 z-[60]">
            <CreateMonsterModal
              isOpen={true}
              onClose={() => setEditingMonster(null)}
              editingMonster={editingMonster}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <Routes>
      <Route path="/monster/:monsterId" element={<EmbeddableMonsterPage />} />
      <Route path="/encounter/:encounterId" element={<EmbeddableEncounterPage />} />
      <Route path="*" element={
        <div className="min-h-screen bg-theme-primary text-white font-sans">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header and Controls */}
        <header className="mb-8 relative">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Action Buttons (only show for characters tab) */}
          {activeTab === 'characters' && (
            <div className="pt-4">
            <div className="flex flex-col space-y-3 md:space-y-0 md:flex-row md:space-x-3 w-full md:w-auto">
               <button
                onClick={() => setIsNewCharacterModalOpen(true)}
                className="w-full md:w-auto px-6 py-3 bg-accent-red hover:bg-accent-red-light rounded-xl text-white font-bold shadow-red-theme/50 shadow-lg transition-all flex items-center justify-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Character
              </button>
             <button
               onClick={handleExportData}
               disabled={characters.length === 0}
               className="w-full md:w-auto px-6 py-3 bg-accent-blue hover:bg-accent-blue-light rounded-xl text-white font-bold shadow-blue-800/50 shadow-lg transition-all flex items-center justify-center disabled:bg-theme-quaternary disabled:cursor-not-allowed"
             >
               <Download className="w-5 h-5 mr-2" />
               Export Data
             </button>
             <button
               onClick={handleDeleteSelectedCharacters}
               disabled={selectedCharacterIds.size === 0}
               className="w-full md:w-auto px-6 py-3 bg-accent-red-dark hover:bg-accent-red rounded-xl text-white font-bold shadow-red-900/50 shadow-lg transition-all flex items-center justify-center disabled:bg-theme-quaternary disabled:cursor-not-allowed"
               title={selectedCharacterIds.size > 0 ? `Delete ${selectedCharacterIds.size} selected character${selectedCharacterIds.size !== 1 ? 's' : ''}` : 'Select characters to delete'}
             >
               <Trash2 className="w-5 h-5 mr-2" />
               Delete Selected ({selectedCharacterIds.size})
             </button>
              <label className="w-full md:w-auto px-6 py-3 bg-accent-green hover:bg-accent-green rounded-xl text-white font-bold shadow-green-800/50 shadow-lg transition-all flex items-center justify-center cursor-pointer">
                <Upload className="w-5 h-5 mr-2" />
                Import Data
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-full md:w-auto px-4 py-3 bg-theme-quaternary hover:bg-theme-hover rounded-xl text-white font-bold shadow-theme-lg shadow-lg transition-all flex items-center justify-center"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            </div>
          )}
        </header>

        {/* Enhanced Dice Roll Display */}
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-xl transition-all duration-300 z-40 max-w-xs
          ${rollResult.value !== null ? 'bg-green-800/90 border border-green-500' : 'bg-theme-secondary/90 border border-theme-primary'}`}
        >
          <div className="text-sm font-semibold text-theme-tertiary">{rollResult.text}</div>
          {rollResult.value !== null && (
            <div className="text-4xl font-extrabold text-accent-yellow-light mt-1">
              {rollResult.value}
            </div>
          )}
          {rollResult.details && (
            <div className="mt-2 text-xs text-theme-muted">
              {rollResult.details.map((detail, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className={detail.kept ? 'text-accent-yellow-light font-semibold' : 'text-theme-disabled'}>
                    {detail.value}
                  </span>
                  {detail.critical && (
                    <span className="text-accent-red-light font-bold">
                      {detail.critical === 'success' ? '!' : '💀'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Content - Conditional based on active tab */}
        {activeTab === 'characters' ? (
          <section>
            <h2 className="text-2xl font-bold text-theme-secondary mb-4">Your Heroes ({characters.length})</h2>

          {characters.length === 0 ? (
            <div className="text-center p-12 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-secondary">
              <Shield className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-xl font-semibold text-theme-muted">Ready your destiny!</p>
              <p className="text-theme-disabled">Use the "New Character Wizard" button to start forging your hero.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((char) => (
                <div key={char.id} className="bg-theme-secondary rounded-xl shadow-xl hover:shadow-red-700/30 transition-shadow duration-300 overflow-hidden">
                  <div className="p-5">
                    {/* Checkbox for selection */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-grow">
                        <h3 className="text-2xl font-bold text-accent-red-light truncate">{char.name}</h3>
                        <p className="text-sm text-theme-muted mb-3">{char.species} | {char.class} (Level {char.level})</p>
                      </div>
                      <label className="flex items-center cursor-pointer ml-2" title="Select for export">
                        <input
                          type="checkbox"
                          checked={selectedCharacterIds.has(char.id)}
                          onChange={() => toggleCharacterSelection(char.id)}
                          className="w-5 h-5 text-accent-red bg-theme-tertiary border-theme-primary rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-medium bg-theme-tertiary/50 p-3 rounded-lg">
                       <div>AC: <span className="text-accent-yellow-light block text-lg font-bold">{char.armorClass}</span></div>
                       <div>HP: <span className="text-accent-green-light block text-lg font-bold">{char.hitPoints}</span></div>
                       <div>Prof: <span className="text-accent-yellow-light block text-lg font-bold">{formatModifier(char.proficiencyBonus)}</span></div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center mt-4 space-x-3">
                      <button
                         onClick={() => {
                           setSelectedCharacterId(char.id);
                         }}
                        className="flex-grow py-2 bg-accent-red hover:bg-accent-red-light rounded-lg text-white font-semibold transition-colors flex items-center justify-center text-sm"
                      >
                        <BookOpen className="w-4 h-4 mr-2" /> View Sheet
                      </button>
                      <button
                        onClick={() => handleDeleteCharacter(char.id)}
                        className="p-2 bg-theme-quaternary hover:bg-accent-red-dark rounded-lg transition-colors"
                        title="Delete Character"
                      >
                        <Trash2 className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </section>
        ) : activeTab === 'monsters' ? (
          showEncounterManager ? (
            <EncounterManager
              encounterId={currentEncounterId}
              onBack={() => setShowEncounterManager(false)}
            />
          ) : showEncounterView ? (
            <EncounterView
              onBack={() => setShowEncounterView(false)}
              onStartCombat={() => {
                // Get the current encounter ID from the saved encounters
                // For now, use a placeholder - this should be improved to get the actual saved encounter ID
                setCurrentEncounterId('current-encounter');
                setShowEncounterView(false);
                setShowEncounterManager(true);
              }}
            />
          ) : (
            <MonsterLibrary
              onSelectMonster={(monster) => setSelectedMonster(monster)}
              onViewEncounter={() => setShowEncounterView(true)}
              onStartCombat={(encounterId) => {
                setCurrentEncounterId(encounterId);
                setShowEncounterManager(true);
              }}
            />
          )
        ) : activeTab === 'npcs' ? (
          <NPCLibrary />
        ) : (
          <SpellbookManager selectedCharacter={selectedCharacter} />
        )}

        {/* New Character Creation Modal */}
        <NewCharacterModal
          isOpen={isNewCharacterModalOpen}
          onClose={() => setIsNewCharacterModalOpen(false)}
          onSelectManualEntry={handleSelectManualEntry}
          onSelectWizard={handleSelectWizard}
          onSelectPersonality={handleSelectPersonality}
        />

        {/* Manual Entry Modal */}
        <ManualEntryScreen
          isOpen={isManualEntryOpen}
          edition={selectedEdition}
          onClose={() => {
            setIsManualEntryOpen(false);
            setCreationMethod(null);
          }}
          onCharacterCreated={() => {
            // Refresh character list
            loadCharacters();
          }}
        />

        {/* Character Creation Wizard */}
        <CharacterCreationWizard
          isOpen={isWizardOpen}
          edition={selectedEdition}
          onClose={() => {
            setIsWizardOpen(false);
            setCreationMethod(null);
          }}
          onCharacterCreated={() => {
            loadCharacters();
            setCreationMethod(null);
          }}
          setRollResult={setRollResult}
        />

        {/* Personality Wizard */}
        {creationMethod === 'personality' && (
          <PersonalityWizard
            isOpen={creationMethod === 'personality'}
            edition={selectedEdition}
            onClose={() => setCreationMethod(null)}
            onComplete={handlePersonalityComplete}
            onBack={handleBackToModal}
          />
        )}

        {cantripModalState.isOpen && (() => {
          const character = characters.find(c => c.id === cantripModalState.characterId);
          if (!character || !character.spellcasting) return null;
          return (
            <ChooseCantripModal
              isOpen={cantripModalState.isOpen}
              onClose={() => setCantripModalState({ isOpen: false, characterId: null, characterClass: null })}
              characterClass={cantripModalState.characterClass!}
              knownCantrips={character.spellcasting.cantripsKnown}
              onCantripSelected={handleCantripSelected}
            />
          );
        })()}

        {subclassModalState.isOpen && (() => {
          const character = characters.find(c => c.id === subclassModalState.characterId);
          if (!character) return null;
          const subclasses = getSubclassesByClass(subclassModalState.characterClass!);
          return (
            <ChooseSubclassModal
              isOpen={subclassModalState.isOpen}
              onClose={() => setSubclassModalState({ isOpen: false, characterId: null, characterClass: null })}
              subclasses={subclasses}
              onSelect={handleSubclassSelected}
              characterClass={character.class}
            />
          );
        })()}

        {asiModalState.isOpen && (() => {
          const character = characters.find(c => c.id === asiModalState.characterId);
          if (!character) return null;
          return (
            <AbilityScoreIncreaseModal
              isOpen={asiModalState.isOpen}
              onClose={() => setAsiModalState({ isOpen: false, characterId: null })}
              onApply={handleAsiApply}
            />
          );
        })()}

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />

        {/* Dice Roller Modal */}
        <DiceRollerModal
          isOpen={isDiceTrayModalOpen}
           onClose={() => {
             setIsDiceTrayModalOpen(false);
           }}
        />

        {/* Character Edit Modal */}
        {editingCharacter && (
          <CharacterEditModal
            character={editingCharacter}
            isOpen={true}
            onClose={() => setEditingCharacter(null)}
            onSave={handleUpdateCharacter}
          />
        )}

        {/* Resting Screen */}
        {isResting && (
          <RestingScreen
            type={isResting}
            changes={restChanges || undefined}
            onComplete={() => {
              setIsResting(null);
              setRestChanges(null);
            }}
          />
        )}

        {/* Version Display */}
        <div className="fixed bottom-4 right-4 text-theme-muted text-sm opacity-50 hover:opacity-100 transition-opacity">
          v{APP_VERSION}
        </div>
      </div>
    </div>
      } />
    </Routes>
  );
};

export default App;
