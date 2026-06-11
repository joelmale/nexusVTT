import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  AbilityKey,
  Character,
  CharacterCreationState,
  Mob,
  MobGroup,
  AbilityScores,
  Equipment,
  CharacterImportSource,
  CharacterExportFormat,
  SkillMap,
} from '@/types/character';
import type { PlayerCharacter } from '@/types/game';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useGameStore } from '@/stores/gameStore';
import {
  createEmptyCharacter,
  calculateAbilityModifier,
  calculateProficiencyBonus,
  STANDARD_SKILLS,
} from '@/types/character';

interface CharacterState {
  // Characters
  characters: Character[];
  activeCharacterId: string | null;

  // Character Creation
  creationState: CharacterCreationState | null;

  // Mobs (DM only)
  mobs: Mob[];
  mobGroups: MobGroup[];
  selectedMobs: string[]; // For combat

  // Import/Export
  supportedImports: CharacterImportSource[];
  supportedExports: CharacterExportFormat[];
}

interface CharacterStore extends CharacterState {
  // Character Management
  createCharacter: (playerId: string) => string;
  createQuickCharacter: (
    data: {
      name: string;
      class: string;
      level: number;
      race?: string;
      background?: string;
    },
    playerId: string,
  ) => Promise<string>;
  updateCharacter: (characterId: string, updates: Partial<Character>) => void;
  deleteCharacter: (characterId: string) => void;
  clearCharacters: () => void;
  setActiveCharacter: (characterId: string | null) => void;
  getCharacter: (characterId: string) => Character | undefined;
  getCharactersByPlayer: (playerId: string) => Character[];

  // Character Stats Calculation
  updateAbilityScore: (
    characterId: string,
    ability: keyof AbilityScores,
    score: number,
  ) => void;
  updateSkillProficiency: (
    characterId: string,
    skillName: string,
    proficient: boolean,
    expertise?: boolean,
  ) => void;
  updateSavingThrowProficiency: (
    characterId: string,
    ability: AbilityKey,
    proficient: boolean,
  ) => void;
  recalculateStats: (characterId: string) => void;

  // Equipment Management
  addEquipment: (characterId: string, equipment: Omit<Equipment, 'id'>) => void;
  updateEquipment: (
    characterId: string,
    equipmentSlug: string,
    updates: { name?: string; quantity?: number; equipped?: boolean },
  ) => void;
  removeEquipment: (characterId: string, equipmentSlug: string) => void;
  equipItem: (characterId: string, equipmentSlug: string) => void;
  unequipItem: (characterId: string, equipmentSlug: string) => void;

  // Combat Integration
  addCharacterToCombat: (characterId: string) => void;
  removeCharacterFromCombat: (characterId: string) => void;
  updateCharacterHP: (
    characterId: string,
    current: number,
    temporary?: number,
  ) => void;

  // Character Creation Wizard
  startCharacterCreation: (
    playerId: string,
    method: 'guided' | 'manual' | 'import',
  ) => void;
  updateCreationState: (updates: Partial<CharacterCreationState>) => void;
  nextCreationStep: () => void;
  previousCreationStep: () => void;
  completeCharacterCreation: () => Promise<{
    id: string;
    character: Character;
  } | null>;
  cancelCharacterCreation: () => void;

  // Mob Management (DM only)
  addMob: (mob: Omit<Mob, 'id'>) => string;
  updateMob: (mobId: string, updates: Partial<Mob>) => void;
  deleteMob: (mobId: string) => void;
  getMob: (mobId: string) => Mob | undefined;

  // Mob Groups
  createMobGroup: (name: string, mobIds: string[]) => string;
  updateMobGroup: (groupId: string, updates: Partial<MobGroup>) => void;
  deleteMobGroup: (groupId: string) => void;

  // Combat Preparation
  selectMobForCombat: (mobId: string) => void;
  deselectMobForCombat: (mobId: string) => void;
  clearSelectedMobs: () => void;
  getSelectedMobs: () => Mob[];

  // Import/Export
  importCharacter: (source: string, data: unknown) => Promise<string>;
  importCharactersFromFiles: (files: File[] | FileList) => Promise<{ successful: number; failed: number; errors: string[] }>;
  exportCharacter: (characterId: string, format: string) => Promise<string>;

  // Utility
  reset: () => void;
}

const initialState: CharacterState = {
  characters: [],
  activeCharacterId: null,
  creationState: null,
  mobs: [],
  mobGroups: [],
  selectedMobs: [],
  supportedImports: [
    {
      type: 'forge',
      name: '5e Character Forge',
      description: 'Import from 5e Character Forge',
      icon: '⚒️',
      supported: true,
    },
    {
      type: 'json',
      name: 'Nexus VTT JSON',
      description: 'Native Nexus character format',
      icon: '📄',
      supported: true,
    },
    {
      type: 'ddb',
      name: 'D&D Beyond',
      description: 'Import from D&D Beyond character sheet',
      icon: '🐉',
      supported: false, // Future implementation
    },
    {
      type: 'roll20',
      name: 'Roll20',
      description: 'Import from Roll20 character sheet',
      icon: '🎲',
      supported: false, // Future implementation
    },
    {
      type: 'google-sheets',
      name: 'Google Sheets',
      description: 'Import from Google Sheets template',
      icon: '📊',
      supported: false, // Future implementation
    },
    {
      type: 'pdf',
      name: 'PDF Character Sheet',
      description: 'Extract data from fillable PDF',
      icon: '📋',
      supported: false, // Future implementation
    },
  ],
  supportedExports: [
    {
      type: 'json',
      name: 'Nexus VTT JSON',
      description: 'Native format for backup/sharing',
      icon: '📄',
    },
    {
      type: 'pdf',
      name: 'PDF Character Sheet',
      description: 'Printable character sheet',
      icon: '📋',
    },
    {
      type: 'text',
      name: 'Text Summary',
      description: 'Human-readable character summary',
      icon: '📝',
    },
  ],
};

export const useCharacterStore = create<CharacterStore>()(
  immer((set, get) => ({
    ...initialState,

    // Character Management
    createCharacter: (playerId) => {
      const character = createEmptyCharacter(playerId) as Character;

      set((state) => {
        state.characters.push(character);
        console.log('state.characters', state.characters);
      });

      return character.id!;
    },

    createQuickCharacter: async (data, playerId) => {
      // Import helper functions dynamically to avoid circular dependencies
      const { getHitDieForClass, estimateHP } = await import(
        '@/utils/characterHelpers'
      );
      const baseCharacter = createEmptyCharacter(playerId);

      const characterId = crypto.randomUUID();
      const now = Date.now();

      const hitDie = getHitDieForClass(data.class);
      const hp = estimateHP(data.class, data.level, 0);

      // Create minimal character with placeholder stats
      const quickCharacter: Character = {
        id: characterId,
        playerId,
        name: data.name,
        level: data.level,
        race: data.race || 'Unknown',
        species: data.race || 'Unknown',
        class: data.class,
        background: data.background || 'Adventurer',
        alignment: 'Neutral',
        edition: '2014',
        inspiration: false,
        proficiencyBonus: baseCharacter.proficiencyBonus || 2,
        armorClass: 10,
        hitPoints: hp,
        maxHitPoints: hp,
        temporaryHitPoints: 0,
        hitDice: {
          current: data.level,
          max: data.level,
          dieType: hitDie,
        },
        speed: 30,
        initiative: 0,
        abilities: {
          STR: { score: 10, modifier: 0 },
          DEX: { score: 10, modifier: 0 },
          CON: { score: 10, modifier: 0 },
          INT: { score: 10, modifier: 0 },
          WIS: { score: 10, modifier: 0 },
          CHA: { score: 10, modifier: 0 },
        },
        skills: baseCharacter.skills,
        languages: baseCharacter.languages,
        inventory: [],
        currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
        experiencePoints: 0,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      };

      // Add to store
      set((state) => {
        state.characters.push(quickCharacter);
      });

      console.log('💾 Quick character created:', quickCharacter.name);
      return characterId;
    },

    updateCharacter: (characterId, updates) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character) {
          Object.assign(character, updates);
          character.updatedAt = new Date().toISOString();

          // Recalculate dependent stats if ability scores changed
          if (updates.abilities) {
            get().recalculateStats(characterId);
          }
        }
      }),

    deleteCharacter: (characterId) =>
      set((state) => {
        const index = state.characters.findIndex((c) => c.id === characterId);
        if (index !== -1) {
          state.characters.splice(index, 1);
          if (state.activeCharacterId === characterId) {
            state.activeCharacterId = null;
          }
        }
      }),

    clearCharacters: () =>
      set((state) => {
        state.characters = [];
        state.activeCharacterId = null;
      }),

    setActiveCharacter: (characterId) =>
      set((state) => {
        state.activeCharacterId = characterId;
      }),

    getCharacter: (characterId) => {
      return get().characters.find((c) => c.id === characterId);
    },

    getCharactersByPlayer: (playerId) => {
      return get().characters.filter(
        (c) => !c.playerId || c.playerId === playerId,
      );
    },

    // Character Stats Calculation
    updateAbilityScore: (characterId, ability, score) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character && character.abilities) {
          character.abilities[ability].score = Math.max(1, Math.min(30, score));
          character.abilities[ability].modifier =
            calculateAbilityModifier(score);
          character.updatedAt = new Date().toISOString();
        }
      }),

    updateSkillProficiency: (
      characterId,
      skillName,
      proficient,
      expertise = false,
    ) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character && character.skills) {
          const skill = character.skills[skillName] || {
            value: 0,
            proficient: false,
          };
          skill.proficient = proficient;
          skill.expertise = expertise && proficient;
          character.skills[skillName] = skill;
          character.updatedAt = new Date().toISOString();
          get().recalculateStats(characterId);
        }
      }),

    updateSavingThrowProficiency: (characterId, ability, proficient) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character) {
          if (!character.savingThrowProficiencies) {
            character.savingThrowProficiencies = {
              STR: false, DEX: false, CON: false,
              INT: false, WIS: false, CHA: false,
            };
          }
          character.savingThrowProficiencies[ability] = proficient;
          character.updatedAt = new Date().toISOString();
        }
      }),

    recalculateStats: (characterId) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (!character || !character.abilities) return;

        const proficiencyBonus = calculateProficiencyBonus(
          character.level || 1,
        );
        character.proficiencyBonus = proficiencyBonus;

        Object.values(character.abilities).forEach((ability) => {
          ability.modifier = calculateAbilityModifier(ability.score);
        });

        if (character.skills) {
          Object.entries(character.skills).forEach(([skillName, skill]) => {
            const abilityKey = STANDARD_SKILLS.find(
              (entry) => entry.name === skillName,
            )?.ability;
            const abilityModifier = abilityKey
              ? character.abilities[abilityKey].modifier
              : 0;
            const profBonus = skill.proficient ? proficiencyBonus : 0;
            const expertiseBonus = skill.expertise ? proficiencyBonus : 0;
            skill.value = abilityModifier + profBonus + expertiseBonus;
            character.skills[skillName] = skill;
          });
        }

        character.initiative = character.abilities.DEX?.modifier ?? 0;

        character.updatedAt = new Date().toISOString();
      }),

    // Equipment Management
    addEquipment: (characterId, equipmentData) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character) {
          const equipmentSlug = equipmentData.name
            .toLowerCase()
            .replace(/\s+/g, '-');
          character.inventory = character.inventory || [];
          character.inventory.push({
            equipmentSlug,
            name: equipmentData.name,
            equipped: equipmentData.equipped,
            quantity: equipmentData.quantity,
          });
          character.updatedAt = new Date().toISOString();
        }
      }),

    updateEquipment: (characterId, equipmentSlug, updates) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character && character.inventory) {
          const equipment = character.inventory.find(
            (e) => e.equipmentSlug === equipmentSlug,
          );
          if (equipment) {
            if (updates.name !== undefined) {
              equipment.name = updates.name;
              equipment.equipmentSlug = updates.name
                .toLowerCase()
                .replace(/\s+/g, '-');
            }
            if (typeof updates.quantity === 'number') {
              equipment.quantity = updates.quantity;
            }
            if (typeof updates.equipped === 'boolean') {
              equipment.equipped = updates.equipped;
            }
            character.updatedAt = new Date().toISOString();
          }
        }
      }),

    removeEquipment: (characterId, equipmentSlug) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character && character.inventory) {
          const index = character.inventory.findIndex(
            (e) => e.equipmentSlug === equipmentSlug,
          );
          if (index !== -1) {
            character.inventory.splice(index, 1);
            character.updatedAt = new Date().toISOString();
          }
        }
      }),

    equipItem: (characterId, equipmentSlug) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character && character.inventory) {
          const equipment = character.inventory.find(
            (e) => e.equipmentSlug === equipmentSlug,
          );
          if (equipment) {
            equipment.equipped = true;
            character.updatedAt = new Date().toISOString();
          }
        }
      }),

    unequipItem: (characterId, equipmentSlug) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character && character.inventory) {
          const equipment = character.inventory.find(
            (e) => e.equipmentSlug === equipmentSlug,
          );
          if (equipment) {
            equipment.equipped = false;
            character.updatedAt = new Date().toISOString();
          }
        }
      }),

    // Combat Integration
    addCharacterToCombat: (characterId) => {
      const character = get().getCharacter(characterId);
      if (character) {
        // Add to initiative tracker

        const { addEntry } = useInitiativeStore.getState();
        addEntry({
          name: character.name,
          type: 'player',
          initiative: character.initiative || 0,
          maxHP: character.maxHitPoints || character.hitPoints || 1,
          currentHP: character.hitPoints || 1,
          tempHP: character.temporaryHitPoints || 0,
          armorClass: character.armorClass || 10,
          conditions: [],
          isActive: false,
          isReady: false,
          isDelayed: false,
          notes: '',
          deathSaves: { successes: 0, failures: 0 },
          initiativeModifier: character.initiative || 0,
          dexterityModifier: character.abilities?.DEX?.modifier || 0,
          playerId: character.playerId,
        });
      }
    },

    removeCharacterFromCombat: (characterId) => {
      const character = get().getCharacter(characterId);
      if (character) {
        // Remove from initiative tracker

        const { entries, removeEntry } = useInitiativeStore.getState();
        const entry = entries.find((e) => e.playerId === character.playerId);
        if (entry) {
          removeEntry(entry.id);
        }
      }
    },

    updateCharacterHP: (characterId, current, temporary = 0) =>
      set((state) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character) {
          const maxHP = character.maxHitPoints ?? current;
          character.hitPoints = Math.max(0, Math.min(maxHP, current));
          character.temporaryHitPoints = Math.max(0, temporary);
          character.updatedAt = new Date().toISOString();
        }
      }),

    // Character Creation Wizard
    startCharacterCreation: (playerId, method) =>
      set((state) => {
        state.creationState = {
          playerId,
          step: 1,
          totalSteps: method === 'guided' ? 8 : 4,
          character: createEmptyCharacter(playerId),
          method,
          isComplete: false,
        };
      }),

    updateCreationState: (updates) =>
      set((state) => {
        if (state.creationState) {
          Object.assign(state.creationState, updates);
        }
      }),

    nextCreationStep: () =>
      set((state) => {
        if (
          state.creationState &&
          state.creationState.step < state.creationState.totalSteps
        ) {
          state.creationState.step += 1;
        }
      }),

    previousCreationStep: () =>
      set((state) => {
        if (state.creationState && state.creationState.step > 1) {
          state.creationState.step -= 1;
        }
      }),

    completeCharacterCreation: async () => {
      // Get the current state
      const { creationState, characters } = get();

      if (creationState && creationState.character) {
        // This is the original, "frozen" character object from the state
        const baseCharacter = creationState.character as Character;

        const finalSkills: SkillMap = {};
        const shouldBuildDefaults =
          !baseCharacter.skills || Object.keys(baseCharacter.skills).length === 0;

        if (shouldBuildDefaults) {
          STANDARD_SKILLS.forEach((skill) => {
            finalSkills[skill.name] = {
              proficient: false,
              value: baseCharacter.abilities![skill.ability].modifier,
            };
          });
        } else {
          Object.assign(finalSkills, baseCharacter.skills);
        }

        // Assemble a completely NEW character object with all the final properties
        const completedCharacter = {
          ...baseCharacter, // Copy all original properties
          id: baseCharacter.id || crypto.randomUUID(), // Add or overwrite properties
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          skills: finalSkills, // Add the prepared skills array
        };

        // Update the state using the new, non-frozen object
        set({
          // Create a new array instead of mutating the old one with .push()
          characters: [...characters, completedCharacter],
          creationState: null,
          activeCharacterId: completedCharacter.id,
        });

        // Recalculate stats using the new character's ID
        get().recalculateStats(completedCharacter.id);

        // Save to IndexedDB
        try {
          const { getLinearFlowStorage } = await import(
            '@/services/linearFlowStorage'
          );
          const storage = getLinearFlowStorage();

          // Convert character to the format expected by the storage system (PlayerCharacter)
          const characterForStorage: PlayerCharacter = {
            id: completedCharacter.id,
            name: completedCharacter.name,
            race: completedCharacter.race || '',
            class: completedCharacter.class || '',
            background: completedCharacter.background || '',
            level: completedCharacter.level,
            stats: {
              strength: completedCharacter.abilities?.STR?.score || 10,
              dexterity: completedCharacter.abilities?.DEX?.score || 10,
              constitution: completedCharacter.abilities?.CON?.score || 10,
              intelligence: completedCharacter.abilities?.INT?.score || 10,
              wisdom: completedCharacter.abilities?.WIS?.score || 10,
              charisma: completedCharacter.abilities?.CHA?.score || 10,
            },
            createdAt: Date.parse(completedCharacter.createdAt || '') || Date.now(),
            playerId: storage['getBrowserId'](), // Use browser ID as player ID for storage
          };

          storage.saveCharacter(characterForStorage);
          console.log(
            '💾 Character saved to IndexedDB:',
            completedCharacter.name,
          );
        } catch (error) {
          console.error('❌ Failed to save character to IndexedDB:', error);
          // Continue anyway - character is still in memory
        }

        // Return the new character object and ID
        return { id: completedCharacter.id, character: completedCharacter };
      }

      // Return null if no character was in the creation state
      return null;
    },

    cancelCharacterCreation: () =>
      set((state) => {
        state.creationState = null;
      }),

    // Mob Management
    addMob: (mobData) => {
      const mob = { ...mobData, id: crypto.randomUUID() };
      set((state) => {
        state.mobs.push(mob);
      });
      return mob.id;
    },

    updateMob: (mobId, updates) =>
      set((state) => {
        const mob = state.mobs.find((m) => m.id === mobId);
        if (mob) {
          Object.assign(mob, updates);
        }
      }),

    deleteMob: (mobId) =>
      set((state) => {
        const index = state.mobs.findIndex((m) => m.id === mobId);
        if (index !== -1) {
          state.mobs.splice(index, 1);
          // Remove from selected mobs
          const selectedIndex = state.selectedMobs.indexOf(mobId);
          if (selectedIndex !== -1) {
            state.selectedMobs.splice(selectedIndex, 1);
          }
        }
      }),

    getMob: (mobId) => {
      return get().mobs.find((m) => m.id === mobId);
    },

    // Mob Groups
    createMobGroup: (name, mobIds) => {
      const group: MobGroup = {
        id: crypto.randomUUID(),
        name,
        mobs: mobIds.map((id) => get().getMob(id)).filter(Boolean) as Mob[],
        environment: '',
        encounterLevel: 'Medium',
      };

      set((state) => {
        state.mobGroups.push(group);
      });

      return group.id;
    },

    updateMobGroup: (groupId, updates) =>
      set((state) => {
        const group = state.mobGroups.find((g) => g.id === groupId);
        if (group) {
          Object.assign(group, updates);
        }
      }),

    deleteMobGroup: (groupId) =>
      set((state) => {
        const index = state.mobGroups.findIndex((g) => g.id === groupId);
        if (index !== -1) {
          state.mobGroups.splice(index, 1);
        }
      }),

    // Combat Preparation
    selectMobForCombat: (mobId) =>
      set((state) => {
        if (!state.selectedMobs.includes(mobId)) {
          state.selectedMobs.push(mobId);
        }
      }),

    deselectMobForCombat: (mobId) =>
      set((state) => {
        const index = state.selectedMobs.indexOf(mobId);
        if (index !== -1) {
          state.selectedMobs.splice(index, 1);
        }
      }),

    clearSelectedMobs: () =>
      set((state) => {
        state.selectedMobs = [];
      }),

    getSelectedMobs: () => {
      const state = get();
      return state.selectedMobs
        .map((id) => state.mobs.find((m) => m.id === id))
        .filter(Boolean) as Mob[];
    },

    // Import/Export
    importCharacter: async (source, data) => {
      const { characterImportService } = await import('@/services/characterImport');
      const { user } = useGameStore.getState();

      const result = await characterImportService.importFromData(
        data,
        source,
        user.id,
      );

      if (!result.success) {
        throw new Error(result.error || 'Import failed');
      }

      if (!result.character) {
        throw new Error('No character data in import result');
      }

      // Add the imported character to the store
      const character = {
        ...(result.character as Character),
        playerId: (result.character as Character).playerId || user.id,
      };
      set((state) => {
        state.characters.push(character);
      });

      return character.id;
    },

    importCharactersFromFiles: async (files) => {
      const { characterImportService } = await import('@/services/characterImport');
      const { user, isAuthenticated } = useGameStore.getState();

      const batchResult = await characterImportService.importFromFiles(
        files,
        user.id,
      );

      const errors: string[] = [];

      // Process successful imports
      for (const result of batchResult.results) {
        if (result.success && result.character) {
          const character = {
            ...(result.character as Character),
            playerId: (result.character as Character).playerId || user.id,
          };

          // Add to store
          set((state) => {
            state.characters.push(character);
          });

          if (isAuthenticated) {
            try {
              const response = await fetch('/api/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  name: character.name,
                  data: character,
                }),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to save character');
              }
            } catch (error) {
              errors.push(
                `Failed to save ${character.name} to your account: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`,
              );
            }
          }
        } else if (result.error) {
          errors.push(result.error);
        }
      }

      return {
        successful: batchResult.successful,
        failed: batchResult.failed,
        errors,
      };
    },

    exportCharacter: async (characterId, format) => {
      const character = get().getCharacter(characterId);
      if (!character) {
        throw new Error('Character not found');
      }

      switch (format) {
        case 'json':
          return JSON.stringify(character, null, 2);
        case 'text':
          return `Character: ${character.name}\nLevel ${character.level}\n...`; // Simplified
        default:
          throw new Error(`Export format ${format} not supported`);
      }
    },

    // Utility
    reset: () => set(() => ({ ...initialState })),
  })),
);

// Helper hooks
export const useCharacters = () => {
  const store = useCharacterStore();
  return {
    characters: store.characters,
    activeCharacter: store.activeCharacterId
      ? store.getCharacter(store.activeCharacterId)
      : null,
    createCharacter: store.createCharacter,
    updateCharacter: store.updateCharacter,
    deleteCharacter: store.deleteCharacter,
    setActiveCharacter: store.setActiveCharacter,
  };
};

export const useCharacterCreation = () => {
  const store = useCharacterStore();
  return {
    creationState: store.creationState,
    startCharacterCreation: store.startCharacterCreation,
    updateCreationState: store.updateCreationState,
    nextCreationStep: store.nextCreationStep,
    previousCreationStep: store.previousCreationStep,
    completeCharacterCreation: store.completeCharacterCreation,
    cancelCharacterCreation: store.cancelCharacterCreation,
  };
};

export const useMobs = () => {
  const store = useCharacterStore();
  return {
    mobs: store.mobs,
    mobGroups: store.mobGroups,
    selectedMobs: store.getSelectedMobs(),
    addMob: store.addMob,
    updateMob: store.updateMob,
    deleteMob: store.deleteMob,
    selectMobForCombat: store.selectMobForCombat,
    deselectMobForCombat: store.deselectMobForCombat,
    clearSelectedMobs: store.clearSelectedMobs,
  };
};
