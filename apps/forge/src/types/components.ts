// Shared component interfaces extracted from App.tsx
import { Character, CharacterCreationData, Equipment, Feature } from './dnd';
import { DiceRoll } from '../services/diceService';

export interface CharacterSheetProps {
  character: Character;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit?: () => void;
  setRollResult: (result: {
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>
  }) => void;
  onDiceRoll: (roll: DiceRoll) => void;
  onToggleInspiration: (characterId: string) => void;
  onFeatureClick: (feature: string | Feature) => void;
  onLongRest: (characterId: string) => void;
  onShortRest: (characterId: string) => void;
  onLevelUp: (characterId: string) => void;
  onLevelDown: (characterId: string) => void;
  onUpdateCharacter: (character: Character) => void;
  onEquipArmor: (characterId: string, armorSlug: string) => void;
  onEquipWeapon: (characterId: string, weaponSlug: string) => void;
  onUnequipItem: (characterId: string, itemSlug: string) => void;
  onAddItem: (characterId: string, equipmentSlug: string, quantity?: number) => void;
  onRemoveItem: (characterId: string, equipmentSlug: string, quantity?: number) => void;
  setEquipmentModal: (item: Equipment | null) => void;
  onOpenDiceTray?: () => void;
}

export interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCharacterCreated: () => void;
  setRollResult: (result: { text: string; value: number | null }) => void;
}

export interface StepProps {
  data: CharacterCreationData;
  updateData: (updates: Partial<CharacterCreationData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  stepIndex: number;
}

export interface EquipmentPackDisplayProps {
  pack: {
    name: string;
    startingGold?: number;
    items: Array<{
      name: string;
      quantity: number;
      equipped?: boolean;
    }>;
    recommendedFor?: string[];
    description?: string;
  };
  isSelected?: boolean;
  onClick?: () => void;
  showRecommendation?: boolean;
  characterClass?: string;
}

export interface RandomizeButtonProps {
  onClick: () => void;
  title?: string;
  className?: string;
}

export interface RandomizeAllButtonProps {
  onClick: () => void;
  className?: string;
}

// Character List Component Props
export interface CharacterListProps {
  characters: Character[];
  selectedCharacterIds: Set<string>;
  onCharacterSelect: (id: string) => void;
  onCharacterView: (id: string) => void;
  onCharacterDelete: (id: string) => void;
}


// Import/Export Controls Props
export interface ImportExportControlsProps {
  characters: Character[];
  selectedCharacterIds: Set<string>;
  onImport: (characters: Character[]) => void;
}