import { calculatePreparationLimit } from '@nexus/rules-5e';
import { calculateCharacterStats } from '../../../utils/characterCreationUtils';
import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Shuffle } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import { CastingGrantChoices } from '../../CastingGrantChoices';
import { SpellPicker } from '../../SpellPicker/SpellPicker';
import {
  loadClasses,
  getCantripsByClass,
  getLeveledSpellsByClass,
  AppSpell,
  SPELLS_KNOWN_BY_CLASS,
} from '../../../services/dataService';
import { LevelResourceSummary } from '../components/LevelResourceSummary';
import SpellDetailsModal from '../../SpellDetailsModal';
import {
  getSpellcastingType,
  getAvailableSpellLevels,
} from '../../../utils/spellUtils';
import cantripsData from '../../../data/cantrips.json';
import {
  getWizardSpellbookSize,
  pruneSpellSelectionForClass,
} from '../../../utils/spellSelectionRules';

const RandomizeButton: React.FC<{
  onClick: () => void;
  title?: string;
  className?: string;
}> = ({ onClick, title = 'Randomize this section', className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-theme-primary text-sm font-medium transition-colors flex items-center gap-2 ${className}`}
      title={title}
    >
      <Shuffle className="w-4 h-4" />
      Randomize
    </button>
  );
};

export const Step4Spells: React.FC<StepProps> = ({
  data,
  updateData,
  nextStep,
  prevStep,
  getNextStepLabel,
}) => {
  const allClasses = loadClasses(data.edition);
  const selectedClass = allClasses.find((c) => c.slug === data.classSlug);
  const hasProcessedAutoAdvance = useRef(false);

  // Modal state
  const [selectedSpellForModal, setSelectedSpellForModal] =
    useState<AppSpell | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Picks made for a previous class must not keep counting after the class changes.
  useEffect(() => {
    const pruned = pruneSpellSelectionForClass(
      data.spellSelection,
      data.classSlug,
      data.edition,
    );
    if (pruned !== data.spellSelection) updateData({ spellSelection: pruned });
  }, [data.spellSelection, data.classSlug, data.edition, updateData]);

  // Auto-advance and validation effects (must be called before any conditional returns)
  useEffect(() => {
    if (
      !hasProcessedAutoAdvance.current &&
      (!selectedClass ||
        !selectedClass.spellcasting ||
        (selectedClass.spellcasting.cantripsKnown === 0 &&
          selectedClass.spellcasting.spellsKnownOrPrepared === 0))
    ) {
      hasProcessedAutoAdvance.current = true;
      nextStep();
    }
  }, [selectedClass, nextStep]);

  // If not a spellcaster or has no spells available, skip this step
  if (
    !selectedClass ||
    !selectedClass.spellcasting ||
    (selectedClass.spellcasting.cantripsKnown === 0 &&
      selectedClass.spellcasting.spellsKnownOrPrepared === 0)
  ) {
    return (
      <div className="text-center text-theme-muted">
        This class doesn't have spells available at level {data.level}.
        Advancing...
      </div>
    );
  }

  const spellcasting = selectedClass.spellcasting!;
  const spellbookSize = getWizardSpellbookSize(data.level);
  const spellcastingType = getSpellcastingType(
    selectedClass.slug,
    data.edition,
  );
  const availableCantrips = getCantripsByClass(data.classSlug, data.edition);

  // Get all available spell levels based on character level
  const availableSpellLevels = getAvailableSpellLevels(
    data.classSlug,
    data.level,
    data.edition,
  );

  // Get all spells from available levels
  const availableSpells: AppSpell[] = availableSpellLevels.flatMap((level) =>
    getLeveledSpellsByClass(data.classSlug, level, data.edition),
  );

  // Calculate level-aware cantrip and spell counts
  let cantripsKnownAtLevel =
    (cantripsData as Record<string, Record<string, number>>)[data.classSlug]?.[
      data.level
    ] || spellcasting.cantripsKnown;

  // 2024 Cleric Thaumaturge gets +1 cantrip
  if (
    data.classSlug === 'cleric' &&
    data.edition === '2024' &&
    data.divineOrder === 'thaumaturge'
  ) {
    cantripsKnownAtLevel += 1;
  }

  // 2024 Druid Magician gets +1 cantrip
  if (
    data.classSlug === 'druid' &&
    data.edition === '2024' &&
    data.primalOrder === 'magician'
  ) {
    cantripsKnownAtLevel += 1;
  }

  // Calculate max spells based on caster type
  let maxPreparedSpellsAtLevel: number;
  if (spellcastingType === 'prepared' || spellcastingType === 'wizard') {
    maxPreparedSpellsAtLevel = calculatePreparationLimit(
      data.classSlug,
      data.level,
      calculateCharacterStats(data).abilities[spellcasting.ability].modifier,
      data.edition,
    );
  } else if (spellcastingType === 'known') {
    // For known casters, use level-aware spells known data
    maxPreparedSpellsAtLevel =
      (SPELLS_KNOWN_BY_CLASS as Record<string, Record<string, number>>)[
        data.classSlug
      ]?.[data.level] || spellcasting.spellsKnownOrPrepared;
  } else {
    maxPreparedSpellsAtLevel = spellcasting.spellsKnownOrPrepared;
  }

  // Modal handlers
  const openSpellModal = (spell: AppSpell) => {
    setSelectedSpellForModal(spell);
    setIsModalOpen(true);
  };

  const closeSpellModal = () => {
    setSelectedSpellForModal(null);
    setIsModalOpen(false);
  };

  const selectSpellFromModal = () => {
    if (!selectedSpellForModal) return;

    // Determine which toggle function to call based on spell type and context
    if (selectedSpellForModal.level === 0) {
      // Cantrip
      handleCantripToggle(selectedSpellForModal.slug);
    } else {
      // Spell - determine the appropriate field based on spellcasting type
      let field: keyof typeof data.spellSelection = 'preparedSpells';
      if (spellcastingType === 'known') {
        field = 'knownSpells';
      } else if (spellcastingType === 'wizard') {
        // For wizard, check if we're in spellbook or daily prep mode
        // This is a simplification - in practice we'd need more context
        field = 'spellbook';
      }
      handleSpellToggle(selectedSpellForModal.slug, field);
    }

    // Close modal after selection
    closeSpellModal();
  };

  const handleCantripToggle = (spellSlug: string) => {
    const current = data.spellSelection.selectedCantrips;
    const isSelected = current.includes(spellSlug);

    if (isSelected) {
      // Deselect
      updateData({
        spellSelection: {
          ...data.spellSelection,
          selectedCantrips: current.filter((s) => s !== spellSlug),
        },
      });
    } else if (current.length < cantripsKnownAtLevel) {
      // Select (if under limit)
      updateData({
        spellSelection: {
          ...data.spellSelection,
          selectedCantrips: [...current, spellSlug],
        },
      });
    }
  };

  const handleSpellToggle = (
    spellSlug: string,
    field: keyof typeof data.spellSelection,
    maxOverride?: number,
  ) => {
    const current = (data.spellSelection[field] as string[]) || [];
    const isSelected = current.includes(spellSlug);

    // Determine max count based on field and spell type
    const maxCount =
      maxOverride ??
      (field === 'preparedSpells' || field === 'knownSpells'
        ? maxPreparedSpellsAtLevel
        : spellcasting.spellsKnownOrPrepared);

    if (isSelected) {
      // Deselect
      updateData({
        spellSelection: {
          ...data.spellSelection,
          [field]: current.filter((s) => s !== spellSlug),
        },
      });
    } else if (current.length < maxCount) {
      // Select (if under limit)
      updateData({
        spellSelection: {
          ...data.spellSelection,
          [field]: [...current, spellSlug],
        },
      });
    }
  };

  const cantripsComplete =
    data.spellSelection.selectedCantrips.length === cantripsKnownAtLevel;

  let spellsComplete = false;
  if (spellcastingType === 'known') {
    spellsComplete =
      (data.spellSelection.knownSpells?.length || 0) ===
      maxPreparedSpellsAtLevel;
  } else if (spellcastingType === 'prepared') {
    spellsComplete =
      (data.spellSelection.preparedSpells?.length || 0) ===
      maxPreparedSpellsAtLevel;
  } else if (spellcastingType === 'wizard') {
    const spellbookComplete =
      (data.spellSelection.spellbook?.length || 0) === spellbookSize;
    const dailyPreparedMax = calculatePreparationLimit(
      data.classSlug,
      data.level,
      calculateCharacterStats(data).abilities.INT.modifier,
      data.edition,
    );
    const dailyComplete =
      (data.spellSelection.dailyPrepared?.length || 0) === dailyPreparedMax;
    spellsComplete = spellbookComplete && dailyComplete;
  }

  const allSelectionsComplete = cantripsComplete && spellsComplete;

  // Generate validation feedback messages
  const getValidationMessages = (): string[] => {
    const messages: string[] = [];

    // Check cantrips
    if (!cantripsComplete) {
      const remaining =
        cantripsKnownAtLevel - data.spellSelection.selectedCantrips.length;
      messages.push(
        remaining > 0
          ? `Pick ${remaining} more cantrip${remaining !== 1 ? 's' : ''}`
          : `Remove ${-remaining} cantrip${remaining !== -1 ? 's' : ''}`,
      );
    }

    // Check spells based on type
    if (spellcastingType === 'known') {
      if (!spellsComplete) {
        const current = data.spellSelection.knownSpells?.length || 0;
        const remaining = maxPreparedSpellsAtLevel - current;
        messages.push(
          remaining > 0
            ? `Select ${remaining} more known spell${remaining !== 1 ? 's' : ''}`
            : `Remove ${-remaining} known spell${remaining !== -1 ? 's' : ''}`,
        );
      }
    } else if (spellcastingType === 'prepared') {
      if (!spellsComplete) {
        const current = data.spellSelection.preparedSpells?.length || 0;
        const remaining = maxPreparedSpellsAtLevel - current;
        messages.push(
          remaining > 0
            ? `Select ${remaining} more prepared spell${remaining !== 1 ? 's' : ''}`
            : `Remove ${-remaining} prepared spell${remaining !== -1 ? 's' : ''}`,
        );
      }
    } else if (spellcastingType === 'wizard') {
      const spellbookCurrent = data.spellSelection.spellbook?.length || 0;
      const spellbookRequired = spellbookSize;
      if (spellbookCurrent < spellbookRequired) {
        const remaining = spellbookRequired - spellbookCurrent;
        messages.push(
          `Add ${remaining} more spell${remaining !== 1 ? 's' : ''} to spellbook`,
        );
      }

      const dailyPreparedMax = calculatePreparationLimit(
        data.classSlug,
        data.level,
        calculateCharacterStats(data).abilities.INT.modifier,
        data.edition,
      );
      const dailyPreparedCurrent =
        data.spellSelection.dailyPrepared?.length || 0;
      if (dailyPreparedCurrent < dailyPreparedMax) {
        const remaining = dailyPreparedMax - dailyPreparedCurrent;
        messages.push(
          `Prepare ${remaining} more daily spell${remaining !== 1 ? 's' : ''}`,
        );
      }
    }

    return messages;
  };

  const handleRandomizeSpells = () => {
    // Pick random legal cantrips
    const shuffledCantrips = [...availableCantrips].sort(
      () => Math.random() - 0.5,
    );
    const selectedCantrips = shuffledCantrips
      .slice(0, cantripsKnownAtLevel)
      .map((s) => s.slug);

    let updatedSelection = {
      ...data.spellSelection,
      selectedCantrips,
    };

    if (spellcastingType === 'wizard') {
      const shuffledSpells = [...availableSpells].sort(
        () => Math.random() - 0.5,
      );
      const spellbook = shuffledSpells.slice(0, spellbookSize).map((s) => s.slug);
      const prepCount = Math.min(
        maxPreparedSpellsAtLevel || 4,
        spellbook.length,
      );
      const prepared = spellbook.slice(0, prepCount);
      updatedSelection = {
        ...updatedSelection,
        spellbook,
        dailyPrepared: prepared,
        preparedSpells: prepared,
      };
    } else if (spellcastingType === 'prepared') {
      const shuffledSpells = [...availableSpells].sort(
        () => Math.random() - 0.5,
      );
      const preparedSpells = shuffledSpells
        .slice(0, maxPreparedSpellsAtLevel)
        .map((s) => s.slug);
      updatedSelection = {
        ...updatedSelection,
        preparedSpells,
      };
    } else {
      const shuffledSpells = [...availableSpells].sort(
        () => Math.random() - 0.5,
      );
      const knownSpells = shuffledSpells
        .slice(0, maxPreparedSpellsAtLevel)
        .map((s) => s.slug);
      updatedSelection = {
        ...updatedSelection,
        knownSpells,
      };
    }

    updateData({ spellSelection: updatedSelection });
  };

  const validationMessages = getValidationMessages();
  const wizardDailyMax =
    spellcastingType === 'wizard'
      ? calculatePreparationLimit(
          data.classSlug,
          data.level,
          calculateCharacterStats(data).abilities.INT.modifier,
          data.edition,
        )
      : 0;

  // Spell mode description
  const modeDescription =
    spellcastingType === 'wizard'
      ? 'Choose spells for your spellbook. You can prepare a subset of these each day.'
      : spellcastingType === 'prepared'
        ? 'Choose spells to prepare. You can change your prepared spells after a long rest.'
        : 'Choose spells your character knows. These are permanent until you level up.';

  return (
    <div className="space-y-6">
      <CastingGrantChoices
        data={data}
        onChange={updateData}
        omitClassChoices
      />
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-tone-danger">Select Your Spells</h3>
          <p className="text-sm text-theme-muted mt-1">
            {selectedClass.name} - {modeDescription}
          </p>
          <p className="text-xs text-tone-magic mt-1">
            Spellcasting Ability:{' '}
            <span className="font-bold">{spellcasting.ability}</span>
          </p>
        </div>
        <RandomizeButton
          onClick={handleRandomizeSpells}
          title="Randomize spell selection"
        />
      </div>

      <LevelResourceSummary data={data} />

      <SpellPicker
        title="Cantrips"
        hint="Cantrips are 0-level spells that can be cast at will, without expending spell slots."
        spells={availableCantrips}
        selected={data.spellSelection.selectedCantrips}
        max={cantripsKnownAtLevel}
        onToggle={handleCantripToggle}
        onDetails={openSpellModal}
      />

      {spellcastingType === 'wizard' && (
        <>
          <SpellPicker
            title="Spellbook"
            hint={`Choose ${spellbookSize} spells for your permanent spellbook (6 at 1st level, plus 2 for each level after). You can prepare a subset of these each day.`}
            spells={availableSpells}
            selected={data.spellSelection.spellbook ?? []}
            max={spellbookSize}
            groupByLevel
            onToggle={(slug) => handleSpellToggle(slug, 'spellbook', spellbookSize)}
            onDetails={openSpellModal}
          />
          <SpellPicker
            title="Daily Preparation"
            hint="Choose spells to prepare for today from your spellbook. You can change this after a long rest."
            spells={(data.spellSelection.spellbook ?? []).flatMap(
              (slug) => availableSpells.find((s) => s.slug === slug) ?? [],
            )}
            selected={data.spellSelection.dailyPrepared ?? []}
            max={wizardDailyMax}
            groupByLevel
            onToggle={(slug) => handleSpellToggle(slug, 'dailyPrepared', wizardDailyMax)}
            onDetails={openSpellModal}
          />
        </>
      )}

      {spellcastingType === 'known' && (
        <SpellPicker
          title="Spells Known"
          hint="These are the spells your character knows permanently. You can change them when you level up."
          spells={availableSpells}
          selected={data.spellSelection.knownSpells ?? []}
          max={maxPreparedSpellsAtLevel}
          groupByLevel
          onToggle={(slug) => handleSpellToggle(slug, 'knownSpells')}
          onDetails={openSpellModal}
        />
      )}

      {spellcastingType === 'prepared' && (
        <SpellPicker
          title="Prepared Spells"
          hint="Choose spells to prepare. You can change your prepared spells after a long rest."
          spells={availableSpells}
          selected={data.spellSelection.preparedSpells ?? []}
          max={maxPreparedSpellsAtLevel}
          groupByLevel
          onToggle={(slug) => handleSpellToggle(slug, 'preparedSpells')}
          onDetails={openSpellModal}
        />
      )}

      {/* Navigation */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <button
            onClick={() => {
              prevStep();
            }}
            className="px-4 py-2 bg-theme-quaternary text-theme-primary rounded-lg hover:bg-theme-hover flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={nextStep}
            disabled={!allSelectionsComplete}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              allSelectionsComplete
                ? 'bg-accent-red-dark text-theme-primary hover:bg-accent-red'
                : 'bg-theme-tertiary text-theme-disabled cursor-not-allowed'
            }`}
          >
            Next: {getNextStepLabel?.() || 'Continue'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Validation Feedback */}
        {!allSelectionsComplete && validationMessages.length > 0 && (
          <div className="flex justify-end">
            <div className="text-sm text-tone-warning space-y-1">
              {validationMessages.map((message, index) => (
                <div key={index}>• {message}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Spell Details Modal */}
      <SpellDetailsModal
        spell={selectedSpellForModal}
        isOpen={isModalOpen}
        onClose={closeSpellModal}
        onSelect={selectSpellFromModal}
        isSelected={
          selectedSpellForModal
            ? selectedSpellForModal.level === 0
              ? data.spellSelection.selectedCantrips.includes(
                  selectedSpellForModal.slug,
                )
              : spellcastingType === 'known'
                ? data.spellSelection.knownSpells?.includes(
                    selectedSpellForModal.slug,
                  ) || false
                : spellcastingType === 'prepared'
                  ? data.spellSelection.preparedSpells?.includes(
                      selectedSpellForModal.slug,
                    ) || false
                  : spellcastingType === 'wizard'
                    ? data.spellSelection.spellbook?.includes(
                        selectedSpellForModal.slug,
                      ) ||
                      false ||
                      data.spellSelection.dailyPrepared?.includes(
                        selectedSpellForModal.slug,
                      ) ||
                      false
                    : false
            : false
        }
        canSelect={
          selectedSpellForModal
            ? selectedSpellForModal.level === 0
              ? data.spellSelection.selectedCantrips.length <
                cantripsKnownAtLevel
              : spellcastingType === 'known'
                ? (data.spellSelection.knownSpells?.length || 0) <
                  maxPreparedSpellsAtLevel
                : spellcastingType === 'prepared'
                  ? (data.spellSelection.preparedSpells?.length || 0) <
                    maxPreparedSpellsAtLevel
                  : spellcastingType === 'wizard'
                    ? (data.spellSelection.spellbook?.length || 0) < spellbookSize ||
                      (data.spellSelection.dailyPrepared?.length || 0) <
                        calculatePreparationLimit(
                          data.classSlug,
                          data.level,
                          calculateCharacterStats(data).abilities.INT.modifier,
                          data.edition,
                        )
                    : false
            : false
        }
      />
    </div>
  );
};
