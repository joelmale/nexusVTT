import React, { useState } from 'react';
import { ChevronUp, ChevronDown, XCircle, Shuffle, ArrowLeft } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import { getAllSpecies, SPECIES_CATEGORIES, randomizeSpecies } from '../../../services/dataService';
import { HumanVariantSelector, OriginFeatSelector, SmartNavigationButton } from '../components';
import { useStepValidation } from '../hooks';

interface RandomizeButtonProps {
  onClick: () => void;
  title: string;
}

const RandomizeButton: React.FC<RandomizeButtonProps> = ({ onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    className="p-2 bg-accent-yellow-dark hover:bg-accent-yellow rounded-lg text-white transition-colors"
  >
    <Shuffle className="w-4 h-4" />
  </button>
);

export const Step2Species: React.FC<StepProps> = ({ data, updateData, nextStep, prevStep, getNextStepLabel, openTraitModal }) => {
  // Start with all categories collapsed
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showSpeciesInfo, setShowSpeciesInfo] = useState(true);

  const selectedSpecies = getAllSpecies().find(s => s.slug === data.speciesSlug);

  // Validation hook
  const { canProceed, missingItems, nextAction } = useStepValidation(2, data);





  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h3 className='text-xl font-bold text-red-300'>Select Species (Species Bonuses will be applied automatically)</h3>
        <RandomizeButton
          onClick={() => updateData({ speciesSlug: randomizeSpecies() })}
          title="Randomize species selection"
        />
      </div>

      {/* Species Categories */}
      <div className='space-y-3'>
        {SPECIES_CATEGORIES.map(category => (
          <div key={category.name} className='border border-theme-primary rounded-lg overflow-hidden'>
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.name)}
              className='w-full p-4 bg-theme-tertiary hover:bg-gray-650 flex items-center justify-between transition-colors'
            >
              <div className='flex items-center gap-3'>
                <span className='text-2xl'>{category.icon}</span>
                <div className='text-left'>
                  <div className='font-bold text-accent-yellow-light text-lg'>
                    {category.name} ({category.species.filter(s => s.edition === data.edition || (data.edition === '2024' && s.edition === '2014')).length})
                  </div>
                  <div className='text-xs text-theme-muted'>{category.description}</div>
                </div>
              </div>
              {expandedCategories.has(category.name) ? (
                <ChevronUp className='w-5 h-5 text-theme-muted' />
              ) : (
                <ChevronDown className='w-5 h-5 text-theme-muted' />
              )}
            </button>

            {/* Category Species */}
            {expandedCategories.has(category.name) && (
              <div className='p-4 bg-theme-secondary/50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                {category.species.filter(s => s.edition === data.edition || (data.edition === '2024' && s.edition === '2014')).map(species => ( // Filter by edition
                  <button
                    key={species.slug}
                    onClick={() => updateData({ speciesSlug: species.slug, selectedLineage: undefined })}
                    className={`p-3 rounded-lg text-left border-2 transition-all ${
                      data.speciesSlug === species.slug
                        ? 'bg-accent-red-darker border-red-500 shadow-md'
                        : 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
                    }`}
                  >
                    <p className='text-sm font-bold text-accent-yellow-light'>{species.name}</p>
                    <p className='text-xs text-theme-disabled mt-1'>{species.source}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Species Details */}
      {selectedSpecies && showSpeciesInfo && (
        <div className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-4 space-y-3 relative">
          <button
            onClick={() => setShowSpeciesInfo(false)}
            className="absolute top-2 right-2 text-theme-muted hover:text-white transition-colors"
            title="Close"
          >
            <XCircle className="w-5 h-5" />
          </button>

          <div className="flex items-start justify-between pr-8">
            <div>
              <h4 className="text-lg font-bold text-accent-yellow-light">{selectedSpecies.name}</h4>
              <p className="text-xs text-theme-disabled">{selectedSpecies.source}</p>
            </div>
          </div>

            <p className="text-sm text-theme-tertiary">{selectedSpecies.detailedDescription || selectedSpecies.description}</p>

           <div className="space-y-3 text-sm">
             {/* 2024 Traits */}
              {data.edition === '2024' && selectedSpecies.traits && (
                <div>
                  <h5 className="font-semibold text-accent-green-light mb-2">Traits:</h5>
                  <ul className="space-y-1">
                    {selectedSpecies.traits.map((trait: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-accent-yellow-light mr-2">•</span>
                        <span className="text-theme-primary">{trait}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

             {/* 2014 Ability Bonuses */}
             {data.edition === '2014' && selectedSpecies.ability_bonuses && Object.keys(selectedSpecies.ability_bonuses).length > 0 && (
               <div>
                 <h5 className="font-semibold text-accent-red-light mb-2">Ability Bonuses:</h5>
                 <div className="flex flex-wrap gap-2">
                   {Object.entries(selectedSpecies.ability_bonuses).map(([ability, bonus]) => (
                     <span key={ability} className="px-2 py-1 bg-blue-700 text-white text-xs rounded">
                       {ability} +{bonus}
                     </span>
                   ))}
                 </div>
               </div>
             )}

              {/* Lineage Choices for 2024 */}
              {data.edition === '2024' && selectedSpecies.lineages && (
                <div>
                  <h5 className="font-semibold text-accent-blue-light mb-2">Choose Lineage:</h5>
                  <div className="space-y-2">
                    {Object.entries(selectedSpecies.lineages).map(([lineageName, lineageData]) => (
                      <button
                        key={lineageName}
                        className={`w-full text-left border rounded p-3 transition-all ${
                          data.selectedLineage === lineageName
                            ? 'border-accent-blue-light bg-theme-quaternary'
                            : 'border-theme-primary bg-theme-secondary/30 hover:bg-theme-quaternary/40'
                        }`}
                        onClick={() => updateData({ selectedLineage: lineageName })}
                      >
                        <h6 className="font-medium text-theme-primary mb-1">{lineageName}</h6>
                        {lineageData.traits && (
                          <div className="text-xs text-theme-muted mb-1">
                            <strong>Traits:</strong> {lineageData.traits.join(', ')}
                          </div>
                        )}
                        {lineageData.spells && (
                          <div className="text-xs text-theme-muted">
                            <strong>Spells:</strong> {lineageData.spells.join(', ')}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ancestry Choices for Dragonborn */}
              {data.edition === '2024' && selectedSpecies.slug === 'dragonborn' && selectedSpecies.ancestries && (
                <div>
                  <h5 className="font-semibold text-accent-purple-light mb-2">Choose Draconic Ancestry:</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedSpecies.ancestries).map(([color, damageType]) => (
                      <div key={color} className="text-xs p-2 bg-theme-secondary rounded border">
                        <strong className="capitalize">{color}:</strong> {String(damageType)} damage
                     </div>
                   ))}
                 </div>
               </div>
             )}

              {/* Fiendish Legacy Choices for Tiefling */}
              {data.edition === '2024' && selectedSpecies.slug === 'tiefling' && selectedSpecies.fiendishLegacies && (
                <div>
                  <h5 className="font-semibold text-accent-orange-light mb-2">Choose Fiendish Legacy:</h5>
                  <div className="space-y-2">
                    {Object.entries(selectedSpecies.fiendishLegacies).map(([legacyName, legacyData]) => (
                      <div key={legacyName} className="border border-theme-primary rounded p-3">
                        <h6 className="font-medium text-theme-primary mb-1 capitalize">{legacyName}</h6>
                        <div className="text-xs text-theme-muted mb-1">
                          <strong>Resistance:</strong> {legacyData.resistance}
                        </div>
                        <div className="text-xs text-theme-muted">
                          <strong>Spells:</strong> {legacyData.spells.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Giant Ancestry Choices for Goliath */}
              {data.edition === '2024' && selectedSpecies.slug === 'goliath' && selectedSpecies.giantAncestry && (
                <div>
                  <h5 className="font-semibold text-accent-stone-light mb-2">Choose Giant Ancestry:</h5>
                  <div className="space-y-2">
                    {Object.entries(selectedSpecies.giantAncestry).map(([ancestry, effect]) => (
                      <div key={ancestry} className="border border-theme-primary rounded p-3">
                        <h6 className="font-medium text-theme-primary mb-1 capitalize">{ancestry} Giant</h6>
                        <div className="text-xs text-theme-muted">{String(effect)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Celestial Revelation Choices for Aasimar */}
              {data.edition === '2024' && selectedSpecies.slug === 'aasimar' && selectedSpecies.celestialRevelationOptions && (
                <div>
                  <h5 className="font-semibold text-accent-gold-light mb-2">Celestial Revelation (Level 3):</h5>
                  <div className="space-y-2">
                    {selectedSpecies.celestialRevelationOptions.map((option: string, index: number) => (
                      <div key={index} className="border border-theme-primary rounded p-3">
                        <div className="text-xs text-theme-muted">{option}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            {data.edition === '2024' && (
              <div>
                <span className="font-semibold text-accent-red-light">Ability Score Increases: </span>
                <p className="text-theme-tertiary mt-1">
                  Your Ability Score Increases are determined by your chosen Background.
                </p>
              </div>
            )}
             <div>
               <span className="font-semibold text-accent-red-light">Species Traits: </span>
               <div className="flex flex-wrap gap-2 mt-1">
                 {selectedSpecies.species_traits.map((trait, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const position = {
                          x: rect.left + rect.width / 2,
                          y: rect.top + rect.height / 2
                        };
                        openTraitModal?.(trait, position);
                      }}
                      className="px-2 py-1 bg-accent-green-dark hover:bg-accent-green text-white text-xs rounded transition-colors cursor-pointer"
                      title={`Click to learn more about ${trait}`}
                    >
                      {trait}
                    </button>
                 ))}
               </div>
             </div>

            <div className="pt-2 border-t border-theme-primary">
              <div className="font-semibold text-accent-yellow-light mb-1">Typical Roles:</div>
              <p className="text-xs text-theme-muted">{selectedSpecies.typicalRoles.join(', ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Human Variant Selection */}
      {selectedSpecies?.slug === 'human' && data.edition === '2014' && (
        <HumanVariantSelector
          data={data}
          updateData={updateData}
        />
       )}

       {/* 2024 Species Feat Selection */}
        {data.edition === '2024' && selectedSpecies && selectedSpecies.speciesFeatOptions && (
          <div className="bg-theme-secondary/50 border border-theme-primary rounded-lg p-4">
            <h5 className="font-semibold text-accent-yellow-light mb-3">Choose Species Feat</h5>
            <select
              value={data.speciesFeat || ''}
              onChange={(e) => updateData({ speciesFeat: e.target.value })}
              className="w-full p-3 bg-theme-tertiary text-white rounded-lg"
            >
              <option value="">Select a feat...</option>
              {selectedSpecies.speciesFeatOptions.map((feat) => (
                <option key={feat} value={feat}>
                  {feat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        )}

        {data.edition === '2024' && selectedSpecies && selectedSpecies.speciesFeat && (
          <div className="bg-accent-yellow/10 border border-accent-yellow rounded-lg p-3">
            <p className="text-theme-primary">Your species grants you the <strong>{selectedSpecies.speciesFeat}</strong> feat.</p>
          </div>
        )}

        {/* 2024 Species Fixed Feat Display */}
        {data.edition === '2024' && selectedSpecies?.speciesFeat && (
          <div className="text-sm text-theme-muted p-4 bg-theme-secondary/50 rounded-lg border border-theme-primary">
            <p className="font-semibold text-accent-yellow-light">Species Feat:</p>
            <p className="mt-2 text-theme-secondary">Your species grants you the <strong>{selectedSpecies.speciesFeat}</strong> feat.</p>
          </div>
        )}

        {selectedSpecies?.slug === 'human-2024' && data.edition === '2024' && (
         <div className="text-sm text-theme-muted p-4 bg-theme-secondary/50 rounded-lg border border-theme-primary space-y-4">
           <div>
             <p className="font-semibold text-accent-yellow-light">Human (2024) Traits:</p>
             <ul className="list-disc list-inside ml-4 mt-2 text-theme-tertiary">
               <li>You gain the Heroic Inspiration Trait.</li>
               <li>You gain one additional 1st-level feat (Origin Feat).</li>
             </ul>
           </div>

           <OriginFeatSelector
             selectedFeat={data.humanOriginFeat}
             onSelect={(featSlug) => updateData({ humanOriginFeat: featSlug })}
           />

           {/* Show second Origin Feat selector if Versatile is selected */}
           {data.humanOriginFeat === 'versatile' && (
             <div className="border-t border-theme-primary pt-4">
               <div>
                 <p className="font-semibold text-accent-yellow-light">Versatile Extra Origin Feat:</p>
                 <p className="mt-2 text-theme-tertiary">Since you selected the Versatile feat, choose one additional Origin Feat:</p>
               </div>

               <OriginFeatSelector
                 selectedFeat={data.humanVersatileFeat}
                 onSelect={(featSlug) => updateData({ humanVersatileFeat: featSlug })}
               />
             </div>
           )}
         </div>
       )}

      <div className='flex justify-between'>
        <button onClick={prevStep} className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <SmartNavigationButton
          canProceed={canProceed}
          missingItems={missingItems}
          nextAction={nextAction}
          onClick={nextStep}
          variant="next"
        >
          Next: {getNextStepLabel?.() || 'Continue'}
        </SmartNavigationButton>
      </div>
    </div>
  );
};
