/**
 * Level-Up Wizard - Spells Step
 *
 * Learn new spells for spellcasters
 */

import React, { useMemo, useState } from 'react';
import { Character, LevelUpChoices } from '../../../types/dnd';
import { LevelUpData } from '../../../data/classProgression';
import { loadSpells, AppSpell } from '../../../services/dataService';
import { SPELL_SLOTS_BY_CLASS } from '../../../data/spellSlots';
import { getHighestSpellSlotLevel, normalizeSpellSlots } from '../../../utils/spellSlotUtils';
import { evaluatePredicate } from '../../../rulesEngine/evaluators/predicates';
import { BaseFacts } from '../../../rulesEngine/types/baseFacts';

interface StepSpellsProps {
  character: Character;
  levelUpData: LevelUpData;
  choices: LevelUpChoices;
  updateChoices: (choices: Partial<LevelUpChoices>) => void;
  onNext: () => void;
  onPrev: () => void;
  spellChoiceIndex?: number;
}

export const StepSpells: React.FC<StepSpellsProps> = ({
  character,
  levelUpData,
  choices: _choices,
  updateChoices,
  onNext,
  onPrev,
  spellChoiceIndex = 0
}) => {
  const [selectedSpells, setSelectedSpells] = useState<string[]>([]);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);

  // Build facts for rule-engine based filtering
  const classSlug = character.class.toLowerCase();
  const baseClass = classSlug.split('-')[0];
  const facts = useMemo<BaseFacts>(() => ({
    level: levelUpData.toLevel,
    classSlug: baseClass,
    classLevel: { [baseClass]: levelUpData.toLevel },
    subclassSlug: character.subclass || undefined,
    speciesSlug: character.species,
    lineageSlug: character.selectedSpeciesVariant,
    backgroundSlug: character.background,
    edition: character.edition,
    abilities: {
      STR: character.abilities?.STR?.score ?? 10,
      DEX: character.abilities?.DEX?.score ?? 10,
      CON: character.abilities?.CON?.score ?? 10,
      INT: character.abilities?.INT?.score ?? 10,
      WIS: character.abilities?.WIS?.score ?? 10,
      CHA: character.abilities?.CHA?.score ?? 10
    },
    choices: {},
    equippedArmor: character.equippedArmor,
    equippedWeapons: character.equippedWeapons || [],
    equippedItems: character.inventory?.map(item => item.equipmentSlug) || [],
    conditions: [],
    tags: [],
    feats: character.selectedFeats || character.feats || []
  }), [
    baseClass,
    levelUpData.toLevel,
    character.subclass,
    character.species,
    character.selectedSpeciesVariant,
    character.background,
    character.edition,
    character.abilities?.STR?.score,
    character.abilities?.DEX?.score,
    character.abilities?.CON?.score,
    character.abilities?.INT?.score,
    character.abilities?.WIS?.score,
    character.abilities?.CHA?.score,
    character.equippedArmor,
    character.equippedWeapons,
    character.inventory,
    character.selectedFeats,
    character.feats
  ]);

  // Load spells for this class via rule-engine predicate (classIs)
  const allSpells = loadSpells();
  const classSpells = useMemo(() => {
    return allSpells.filter(spell => {
      if (!spell.classes) return false;
      const classList = Array.isArray(spell.classes) ? spell.classes : [spell.classes];
      const predicate = { type: 'classIs' as const, slug: baseClass };
      return classList.some(c => c && typeof c === 'string' && c.toLowerCase() === baseClass) &&
        evaluatePredicate(predicate, { facts, derived: {} });
    });
  }, [allSpells, baseClass, facts]);

  // Get the specific spell choice for this step
  const spellChoices = levelUpData.choices.filter(c => c.type === 'spells');
  const currentSpellChoice = spellChoices[spellChoiceIndex];

  if (!currentSpellChoice) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-accent-gold mb-2">
            No Spell Choice Available
          </h3>
          <p className="text-[#992600]">
            There are no spell choices available for this level.
          </p>
        </div>
        <div className="flex justify-end pt-4">
          <button
            onClick={onNext}
            className="px-6 py-3 bg-accent-gold text-theme-primary font-semibold rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Determine how many spells can be learned and what type
  const spellsToLearn = currentSpellChoice.count || 1;
  const isCantripChoice = currentSpellChoice.description.toLowerCase().includes('cantrip');

  // Determine the highest spell level the character can cast at the new level
  const rawSlotsAtNewLevel =
    SPELL_SLOTS_BY_CLASS[baseClass]?.[levelUpData.toLevel] ||
    character.spellcasting?.spellSlots ||
    [];
  const normalizedSlots = normalizeSpellSlots(baseClass, rawSlotsAtNewLevel);
  const derivedMaxSpellLevel = getHighestSpellSlotLevel(baseClass, rawSlotsAtNewLevel);
  let fallbackMaxSpellLevel = 0;
  for (let level = normalizedSlots.length - 1; level > 0; level -= 1) {
    if (normalizedSlots[level] > 0) {
      fallbackMaxSpellLevel = level;
      break;
    }
  }
  const maxSpellLevel = derivedMaxSpellLevel || fallbackMaxSpellLevel;

  // Filter spells based on choice type and exclude already known
  const availableSpells = classSpells.filter(spell => {
    // Filter by spell level based on choice type
    if (isCantripChoice && spell.level !== 0) return false;
    if (!isCantripChoice) {
      if (spell.level === 0) return false;
      if (maxSpellLevel > 0 && spell.level > maxSpellLevel) return false;
    }

    const spellcasting = character.spellcasting;
    const knownCantrips = spellcasting?.cantripsKnown || [];
    const knownSpells = spellcasting?.spellsKnown || [];
    const spellbook = spellcasting?.spellbook || [];
    const prepared = spellcasting?.preparedSpells || [];

    const alreadyKnown =
      knownCantrips.includes(spell.slug) ||
      knownSpells.includes(spell.slug) ||
      spellbook.includes(spell.slug) ||
      prepared.includes(spell.slug);

    return !alreadyKnown;
  });

  // All available spells are now filtered by choice type

  const handleToggleSpell = (spellSlug: string) => {
    if (selectedSpells.includes(spellSlug)) {
      setSelectedSpells(selectedSpells.filter(s => s !== spellSlug));
    } else if (selectedSpells.length < spellsToLearn) {
      setSelectedSpells([...selectedSpells, spellSlug]);
    }
  };

  const handleToggleExpand = (spellSlug: string) => {
    setExpandedSpell(prev => (prev === spellSlug ? null : spellSlug));
  };

  const handleCardKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    spellSlug: string,
    isSelected: boolean,
    selectionDisabled: boolean
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleToggleExpand(spellSlug);
    }
    if (event.key === ' ') {
      event.preventDefault();
      if (!selectionDisabled || isSelected) {
        handleToggleSpell(spellSlug);
      }
    }
  };

  const handleNext = () => {
    updateChoices({ spellsLearned: selectedSpells });
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-accent-gold mb-2">
          {currentSpellChoice.description}
        </h3>
        <p className="text-[#992600]">
          Select {spellsToLearn} {isCantripChoice ? 'cantrip(s)' : 'spell(s)'} to learn.
        </p>
      </div>

      <div className="bg-theme-primary rounded-lg p-4">
        <p className="text-theme-text">
          Selected: <span className="text-accent-gold font-bold">{selectedSpells.length}</span> / {spellsToLearn}
        </p>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-2">
        {availableSpells.map((spell: AppSpell) => {
          const isSelected = selectedSpells.includes(spell.slug);
          const selectionDisabled = !isSelected && selectedSpells.length >= spellsToLearn;
          const isExpanded = expandedSpell === spell.slug;

          return (
            <div
              key={spell.slug}
              className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold ${
                isSelected
                  ? 'border-accent-gold bg-accent-gold bg-opacity-10'
                  : 'border-theme-border bg-theme-primary hover:border-accent-gold hover:border-opacity-50'
              }`}
              onClick={() => handleToggleExpand(spell.slug)}
              aria-expanded={isExpanded}
              role="button"
              tabIndex={0}
              onKeyDown={event => handleCardKeyDown(event, spell.slug, isSelected, selectionDisabled)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-theme-text">{spell.name}</h4>
                  <p className="text-xs text-[#992600] mt-1 flex flex-wrap items-center gap-1">
                    {spell.level === 0 ? `${spell.school} • ${spell.castingTime}` : `Level ${spell.level} • ${spell.school} • ${spell.castingTime}`}
                    {spell.ritual && <span className="text-[10px] uppercase tracking-wide px-1 py-0.5 rounded bg-theme-primary border border-theme-border">Ritual</span>}
                    {spell.concentration && <span className="text-[10px] uppercase tracking-wide px-1 py-0.5 rounded bg-theme-primary border border-theme-border">Conc.</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleToggleSpell(spell.slug);
                  }}
                  disabled={selectionDisabled}
                  className={`flex-shrink-0 px-3 py-1 rounded-md text-sm font-semibold border ${
                    isSelected
                      ? 'bg-accent-gold text-theme-primary border-accent-gold'
                      : 'bg-theme-primary text-theme-text border-theme-border hover:border-accent-gold disabled:opacity-50'
                  }`}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-3 text-sm text-theme-text space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent-gold/50 bg-accent-gold/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-gold">
                      {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-theme-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
                      {spell.school}
                    </span>
                    {spell.ritual && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-theme-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
                        Ritual
                      </span>
                    )}
                    {spell.concentration && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-theme-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
                        Concentration
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full border border-theme-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
                      {[['V', spell.components?.verbal], ['S', spell.components?.somatic], ['M', spell.components?.material]]
                        .filter(([, present]) => present)
                        .map(([label]) => label)
                        .join(' • ') || 'V/S/M'}
                    </span>
                  </div>

                  <p className="whitespace-pre-line leading-relaxed">{spell.description}</p>

                  {spell.atHigherLevels && (
                    <p className="whitespace-pre-line leading-relaxed text-[#992600]">
                      <span className="font-semibold">At Higher Levels:</span> {spell.atHigherLevels}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 text-xs text-theme-text opacity-80">
                    <span><span className="font-semibold">Casting Time:</span> {spell.castingTime}</span>
                    <span><span className="font-semibold">Range:</span> {spell.range}</span>
                    <span><span className="font-semibold">Duration:</span> {spell.duration}</span>
                    {spell.components?.materialDescription && (
                      <span><span className="font-semibold">Materials:</span> {spell.components.materialDescription}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-3 bg-theme-primary text-theme-text font-semibold rounded-lg hover:bg-opacity-80 transition-colors border border-theme-border"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={selectedSpells.length !== spellsToLearn}
          className="px-6 py-3 bg-accent-gold text-theme-primary font-semibold rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
