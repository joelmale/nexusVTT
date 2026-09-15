import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SelectionPoolWidgetProps, SkillOption, WeaponOption, SelectionPoolConfig } from '../../../types/widgets';
import { loadEquipment } from '../../../services/dataService';
import { Equipment } from '../../../types/dnd';
import WeaponMasteryTooltip from '../../WeaponMasteryTooltip';

/**
 * SelectionPoolWidget
 *
 * Reusable component for selecting multiple items from a pool.
 * Used for: Expertise (skills/tools), Weapon Mastery (weapons)
 */
export const SelectionPoolWidget: React.FC<SelectionPoolWidgetProps> = ({
  feature,
  data,
  currentSelection,
  onSelectionChange,
}) => {
  const config = feature.widget_config;

  // ============================================================================
  // Get Available Options Based on Source (Memoized for Performance)
  // ============================================================================

  /**
   * Get skill and tool options for Expertise
   */
  const skillAndToolOptions = useMemo((): SkillOption[] => {
    const options: SkillOption[] = [];

    // Add background skills
    if (data.backgroundSkills) {
      data.backgroundSkills.forEach(skill => {
        options.push({
          id: skill,
          name: formatSkillName(skill),
          type: 'skill',
          source: 'background',
        });
      });
    }

    // Add class skills
    data.selectedSkills.forEach(skill => {
      if (!options.some(opt => opt.id === skill)) {
        options.push({
          id: skill,
          name: formatSkillName(skill),
          type: 'skill',
          source: 'class',
        });
      }
    });

    // Add overflow skills
    if (data.overflowSkills) {
      data.overflowSkills.forEach(skill => {
        if (!options.some(opt => opt.id === skill)) {
          options.push({
            id: skill,
            name: formatSkillName(skill),
            type: 'skill',
            source: 'class',
          });
        }
      });
    }

    // Add specific tools
    if (config.include_tools) {
      config.include_tools.forEach(tool => {
        options.push({
          id: tool,
          name: formatToolName(tool),
          type: 'tool',
          source: 'class',
        });
      });
    }

    return options;
  }, [data.backgroundSkills, data.selectedSkills, data.overflowSkills, config.include_tools]);

  /**
   * Get weapon options for Weapon Mastery
   */
  const weaponOptions = useMemo((): WeaponOption[] => {
    /**
     * Check if character is proficient with a weapon (internal helper)
     */
    function isWeaponProficient(weapon: Equipment): boolean {
      const classSlug = data.classSlug?.toLowerCase();

      if (weapon.weapon_category === 'Simple') {
        return true;
      }

      if (weapon.weapon_category === 'Martial') {
        const properties = weapon.properties?.map(p => p.index) || [];

        switch (classSlug) {
          case 'fighter':
          case 'paladin':
          case 'barbarian':
          case 'ranger':
            return true;

          case 'rogue':
            return properties.includes('finesse') || properties.includes('light');

          case 'bard': {
            const allowedBardWeapons = ['rapier', 'longsword', 'shortsword', 'scimitar'];
            return allowedBardWeapons.includes(weapon.index);
          }

          default:
            return false;
        }
      }

      return false;
    }

    /**
     * Check if weapon is melee (internal helper)
     */
    function isWeaponMelee(weapon: Equipment): boolean {
      const properties = weapon.properties?.map(p => p.index) || [];
      const isRanged = weapon.weapon_range === 'Ranged' || properties.includes('ammunition');
      return !isRanged;
    }

    const allEquipment = loadEquipment();

    // Filter by edition - only show weapons from the selected edition
    const editionFiltered = allEquipment.filter(eq => eq.year.toString() === data.edition);

    const weapons = editionFiltered.filter(eq => eq.equipment_category === 'Weapon');

    const proficientWeapons = weapons.filter(weapon => {
      if (!isWeaponProficient(weapon)) {
        return false;
      }

      if (config.filter === 'proficient_melee_weapons') {
        return isWeaponMelee(weapon);
      }

      return true;
    });

    return proficientWeapons.map(weapon => {
      const isTwoHanded = weapon.properties?.some(p => p.index === 'two-handed') || false;

      return {
        slug: weapon.index,
        name: weapon.name,
        damage: weapon.damage?.damage_dice || '—',
        properties: weapon.properties?.map(p => p.name) || [],
        mastery: weapon.mastery?.index,
        category: weapon.weapon_category?.toLowerCase() as 'simple' | 'martial',
        isTwoHanded,
        weaponRange: weapon.weapon_range || 'Melee',
      };
    });
  }, [data.edition, data.classSlug, config.filter]);

  /**
   * Get available options based on config source (Memoized)
   */
  const availableOptions = useMemo((): (SkillOption | WeaponOption)[] => {
    switch (config.source) {
      case 'skills_and_tools':
        return skillAndToolOptions;
      case 'weapons':
        return weaponOptions;
      case 'skills':
        return skillAndToolOptions.filter(opt => opt.type === 'skill');
      default:
        return [];
    }
  }, [config.source, skillAndToolOptions, weaponOptions]);

  // ============================================================================
  // Selection Handlers (Memoized for Performance)
  // ============================================================================

  const handleSelect = useCallback((id: string) => {
    if (currentSelection.includes(id)) {
      // Deselect
      onSelectionChange(currentSelection.filter(item => item !== id));
    } else if (currentSelection.length < config.count) {
      // Select
      onSelectionChange([...currentSelection, id]);
    }
  }, [currentSelection, config.count, onSelectionChange]);

  const isSelected = (id: string): boolean => {
    return currentSelection.includes(id);
  };

  const isMaxSelected = (): boolean => {
    return currentSelection.length >= config.count;
  };

  // ============================================================================
  // Rendering
  // ============================================================================

  // For weapons, render grouped UI
  if (config.source === 'weapons') {
    return <WeaponGroupedUI
      feature={feature}
      config={config}
      weapons={availableOptions as WeaponOption[]}
      currentSelection={currentSelection}
      handleSelect={handleSelect}
      isSelected={isSelected}
      isMaxSelected={isMaxSelected}
    />;
  }

  // For skills/tools, render original UI
  return (
    <div className="selection-pool-widget mb-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-amber-400 mb-2">
          {feature.name}
        </h3>
        <p className="text-gray-300 text-sm mb-3">
          {feature.desc}
        </p>
        <div className="text-amber-400 text-sm font-semibold">
          Selected: {currentSelection.length} / {config.count}
          {currentSelection.length === config.count && ' ✓'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {availableOptions.map((option) => {
          const optionId = (option as SkillOption).id;
          const selected = isSelected(optionId);
          const disabled = !selected && isMaxSelected();

          return (
            <SkillCard
              key={optionId}
              option={option as SkillOption}
              selected={selected}
              disabled={disabled}
              onClick={() => handleSelect(optionId)}
            />
          );
        })}
      </div>

      {currentSelection.length === 0 && (
        <div className="mt-4 text-amber-400 text-sm">
          ⚠️ Please select {config.count} weapons
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Weapon Grouped UI Component
// ============================================================================

interface WeaponGroupedUIProps {
  feature: { name: string; desc?: string };
  config: SelectionPoolConfig;
  weapons: WeaponOption[];
  currentSelection: string[];
  handleSelect: (id: string) => void;
  isSelected: (id: string) => boolean;
  isMaxSelected: () => boolean;
}

const WeaponGroupedUI: React.FC<WeaponGroupedUIProps> = ({
  feature,
  config,
  weapons,
  currentSelection,
  handleSelect,
  isSelected,
  isMaxSelected
}) => {
  // Group weapons
  const simpleMelee = weapons.filter(w => w.category === 'simple' && w.weaponRange === 'Melee');
  const simpleRanged = weapons.filter(w => w.category === 'simple' && w.weaponRange === 'Ranged');
  const martialMelee1H = weapons.filter(w => w.category === 'martial' && w.weaponRange === 'Melee' && !w.isTwoHanded);
  const martialMelee2H = weapons.filter(w => w.category === 'martial' && w.weaponRange === 'Melee' && w.isTwoHanded);
  const martialRanged = weapons.filter(w => w.category === 'martial' && w.weaponRange === 'Ranged');

  return (
    <div className="weapon-grouped-widget mb-6">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-amber-400 mb-2">
          {feature.name}
        </h3>
        <p className="text-gray-300 text-sm mb-3">
          {feature.desc}
        </p>
        <div className="text-amber-400 text-sm font-semibold">
          Selected: {currentSelection.length} / {config.count}
          {currentSelection.length === config.count && ' ✓'}
        </div>
      </div>

      {/* Weapon Groups */}
      <div className="space-y-3">
        {simpleMelee.length > 0 && (
          <WeaponGroup
            title="Simple Melee Weapons"
            weapons={simpleMelee}
            handleSelect={handleSelect}
            isSelected={isSelected}
            isMaxSelected={isMaxSelected}
            showMastery={config.show_mastery_property}
          />
        )}

        {simpleRanged.length > 0 && (
          <WeaponGroup
            title="Simple Ranged Weapons"
            weapons={simpleRanged}
            handleSelect={handleSelect}
            isSelected={isSelected}
            isMaxSelected={isMaxSelected}
            showMastery={config.show_mastery_property}
          />
        )}

        {martialMelee1H.length > 0 && (
          <WeaponGroup
            title="Martial Melee Weapons (1-Handed)"
            weapons={martialMelee1H}
            handleSelect={handleSelect}
            isSelected={isSelected}
            isMaxSelected={isMaxSelected}
            showMastery={config.show_mastery_property}
          />
        )}

        {martialMelee2H.length > 0 && (
          <WeaponGroup
            title="Martial Melee Weapons (2-Handed)"
            weapons={martialMelee2H}
            handleSelect={handleSelect}
            isSelected={isSelected}
            isMaxSelected={isMaxSelected}
            showMastery={config.show_mastery_property}
          />
        )}

        {martialRanged.length > 0 && (
          <WeaponGroup
            title="Martial Ranged Weapons"
            weapons={martialRanged}
            handleSelect={handleSelect}
            isSelected={isSelected}
            isMaxSelected={isMaxSelected}
            showMastery={config.show_mastery_property}
          />
        )}
      </div>

      {currentSelection.length === 0 && (
        <div className="mt-4 text-amber-400 text-sm">
          ⚠️ Please select {config.count} weapons
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Weapon Group Component (Collapsible)
// ============================================================================

interface WeaponGroupProps {
  title: string;
  weapons: WeaponOption[];
  handleSelect: (id: string) => void;
  isSelected: (id: string) => boolean;
  isMaxSelected: () => boolean;
  showMastery?: boolean;
}

const WeaponGroup: React.FC<WeaponGroupProps> = ({
  title,
  weapons,
  handleSelect,
  isSelected,
  isMaxSelected,
  showMastery
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const selectedCount = weapons.filter(w => isSelected(w.slug)).length;

  return (
    <div className="border border-gray-600 rounded-lg overflow-hidden">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold">{title}</span>
          <span className="text-sm text-gray-400">({weapons.length} weapons)</span>
          {selectedCount > 0 && (
            <span className="text-sm text-amber-400 font-semibold">
              ✓ {selectedCount} selected
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Weapons Grid */}
      {isExpanded && (
        <div className="p-3 bg-gray-900/30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {weapons.map((weapon) => {
              const selected = isSelected(weapon.slug);
              const disabled = !selected && isMaxSelected();

              return (
                <WeaponCard
                  key={weapon.slug}
                  option={weapon}
                  selected={selected}
                  disabled={disabled}
                  showMastery={showMastery || false}
                  onClick={() => handleSelect(weapon.slug)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

interface SkillCardProps {
  option: SkillOption;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}

const SkillCard: React.FC<SkillCardProps> = ({ option, selected, disabled, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        p-3 rounded-lg border-2 text-left transition-all
        ${selected
          ? 'border-amber-400 bg-amber-400/20 shadow-lg'
          : disabled
          ? 'border-gray-600 bg-gray-800/50 opacity-50 cursor-not-allowed'
          : 'border-gray-600 bg-gray-800/50 hover:border-amber-400/50 cursor-pointer'
        }
      `}
    >
      <div className="font-semibold text-white">
        {option.name}
        {selected && <span className="ml-2 text-amber-400">✓</span>}
      </div>
      <div className="text-xs text-gray-400 capitalize mt-1">
        {option.type} • {option.source}
      </div>
    </button>
  );
};

interface WeaponCardProps {
  option: WeaponOption;
  selected: boolean;
  disabled: boolean;
  showMastery: boolean;
  onClick: () => void;
}

const WeaponCard: React.FC<WeaponCardProps> = ({ option, selected, disabled, showMastery, onClick }) => {
  const cardContent = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        p-2 rounded-lg border-2 text-left transition-all text-sm w-full
        ${selected
          ? 'border-amber-400 bg-amber-400/20'
          : disabled
          ? 'border-gray-700 bg-gray-800/30 opacity-40 cursor-not-allowed'
          : 'border-gray-700 bg-gray-800/30 hover:border-amber-400/50 cursor-pointer'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div className="font-semibold text-white text-sm">
          {option.name}
          {selected && <span className="ml-1 text-amber-400">✓</span>}
        </div>
        {option.isTwoHanded && (
          <div className="text-[10px] text-gray-400 bg-gray-700 px-1 rounded">2H</div>
        )}
      </div>

      <div className="text-xs text-gray-400 mt-1">
        {option.damage}
      </div>

      {showMastery && option.mastery && (
        <div className="mt-1 pt-1 border-t border-gray-700">
          <div className="text-[10px] text-amber-400 font-semibold">
            {formatMasteryName(option.mastery)}
          </div>
        </div>
      )}
    </button>
  );

  // Wrap with tooltip if weapon has mastery
  if (showMastery && option.mastery) {
    return (
      <WeaponMasteryTooltip weapon={option}>
        {cardContent}
      </WeaponMasteryTooltip>
    );
  }

  return cardContent;
};

// ============================================================================
// Helper Functions
// ============================================================================

const formatSkillName = (skill: string): string => {
  const skillMap: Record<string, string> = {
    'Acrobatics': 'Acrobatics',
    'AnimalHandling': 'Animal Handling',
    'Arcana': 'Arcana',
    'Athletics': 'Athletics',
    'Deception': 'Deception',
    'History': 'History',
    'Insight': 'Insight',
    'Intimidation': 'Intimidation',
    'Investigation': 'Investigation',
    'Medicine': 'Medicine',
    'Nature': 'Nature',
    'Perception': 'Perception',
    'Performance': 'Performance',
    'Persuasion': 'Persuasion',
    'Religion': 'Religion',
    'SleightOfHand': 'Sleight of Hand',
    'Stealth': 'Stealth',
    'Survival': 'Survival',
  };

  return skillMap[skill] || skill;
};

const formatToolName = (tool: string): string => {
  return tool.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const formatMasteryName = (mastery: string): string => {
  return mastery.charAt(0).toUpperCase() + mastery.slice(1);
};
