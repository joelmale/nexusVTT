import React from 'react';
import { Character } from '../../types/dnd';

interface FeaturesSectionProps {
  character: Character;
  onFeatureClick: (feature: string) => void;
  layoutMode?: string;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({
  character,
  onFeatureClick,
  layoutMode = 'modern',
}) => {
  const handwritingClass = layoutMode === 'paper-sheet' ? 'font-handwriting' : '';

  // Classic layout: All panes vertically stacked
  if (layoutMode === 'classic-dnd') {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-red-500 border-b border-red-800 pb-1">Features & Traits</h2>
        <div className="space-y-4">
          {/* Personality section */}
          <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-blue-500">
            <h3 className="text-lg font-bold text-accent-blue-light mb-2">Personality, Ideals, Bonds & Flaws</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-theme-tertiary">
              <li><span className="font-semibold text-theme-primary">Personality:</span> <span className={handwritingClass}>{character.featuresAndTraits.personality}</span></li>
              <li><span className="font-semibold text-theme-primary">Ideals:</span> <span className={handwritingClass}>{character.featuresAndTraits.ideals}</span></li>
              <li><span className="font-semibold text-theme-primary">Bonds:</span> <span className={handwritingClass}>{character.featuresAndTraits.bonds}</span></li>
              <li><span className="font-semibold text-theme-primary">Flaws:</span> <span className={handwritingClass}>{character.featuresAndTraits.flaws}</span></li>
            </ul>
          </div>

           {/* Species Traits */}
           <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-green-500">
             <h3 className="text-lg font-bold text-accent-green-light mb-2">Species Traits</h3>
             <div className="flex flex-wrap gap-2">
               {character.featuresAndTraits.speciesTraits.map((trait, index) => (
                 <button
                   key={`r-${index}`}
                   onClick={() => onFeatureClick(trait)}
                   className="px-2 py-1 bg-accent-green-dark text-theme-primary text-xs rounded hover:bg-accent-green transition-colors cursor-pointer"
                 >
                   {trait}
                 </button>
               ))}
             </div>
            </div>

           {/* Background Features */}
           {character.featuresAndTraits.backgroundFeatures && character.featuresAndTraits.backgroundFeatures.length > 0 && (
             <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-blue-500">
               <h3 className="text-lg font-bold text-accent-blue-light mb-2">Background Features</h3>
               <div className="space-y-2">
                 {character.featuresAndTraits.backgroundFeatures.map((feature, index) => (
                   <div key={`bg-${index}`} className="border border-theme-primary rounded p-3">
                     <button
                       onClick={() => onFeatureClick(feature.name)}
                       className="font-medium text-theme-primary hover:text-accent-yellow-light transition-colors cursor-pointer text-left w-full"
                     >
                       {feature.name}
                     </button>
                     <p className="text-xs text-theme-muted mt-1">{feature.description}</p>
                   </div>
                 ))}
               </div>
             </div>
           )}

          {/* Musical Instrument Proficiencies */}
          {character.featuresAndTraits.musicalInstrumentProficiencies && character.featuresAndTraits.musicalInstrumentProficiencies.length > 0 && (
            <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-purple-500">
              <h3 className="text-lg font-bold text-purple-400 mb-2">Musical Instruments</h3>
              <div className="flex flex-wrap gap-2">
                {character.featuresAndTraits.musicalInstrumentProficiencies.map((instrument, index) => (
                  <span
                    key={`instrument-${index}`}
                    className="px-2 py-1 bg-purple-700 text-white text-xs rounded"
                  >
                    {instrument}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Class Features */}
          {character.srdFeatures?.classFeatures && character.srdFeatures.classFeatures.length > 0 && (
            <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-orange-500">
              <h3 className="text-lg font-bold text-orange-400 mb-2">Class Features</h3>
              <div className="space-y-2 text-sm text-theme-tertiary max-h-60 overflow-y-auto">
                {character.srdFeatures.classFeatures
                  .reduce((unique, feature) => {
                    const existing = unique.find(f => f.name === feature.name);
                    if (!existing || feature.level > existing.level) {
                      return existing
                        ? unique.map(f => f.name === feature.name ? feature : f)
                        : [...unique, feature];
                    }
                    return unique;
                  }, [] as typeof character.srdFeatures.classFeatures)
                  .map((feature, index) => (
                    <div key={`cf-${index}`} className="flex items-start gap-2">
                      <span className="text-xs bg-orange-700 text-theme-primary px-1.5 py-0.5 rounded font-mono">
                        L{feature.level}
                      </span>
                      <button
                        onClick={() => onFeatureClick(feature.name)}
                        className="text-left hover:text-accent-yellow-light transition-colors cursor-pointer flex-1"
                      >
                        {feature.name}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Subclass Features */}
          {character.srdFeatures?.subclassFeatures && character.srdFeatures.subclassFeatures.length > 0 && (
            <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-accent-purple">
              <h3 className="text-lg font-bold text-accent-purple-light mb-2">Subclass Features</h3>
              <div className="space-y-2 text-sm text-theme-tertiary max-h-60 overflow-y-auto">
                {character.srdFeatures.subclassFeatures.map((feature, index) => (
                  <div key={`scf-${index}`} className="flex items-start gap-2">
                    <span className="text-xs bg-purple-700 text-theme-primary px-1.5 py-0.5 rounded font-mono">
                      L{feature.level}
                    </span>
                    <button
                      onClick={() => onFeatureClick(feature.name)}
                      className="text-left hover:text-accent-yellow-light transition-colors cursor-pointer flex-1"
                    >
                      {feature.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legacy Class Features */}
          {character.featuresAndTraits.classFeatures && character.featuresAndTraits.classFeatures.length > 0 && (
            <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-yellow-500">
              <h3 className="text-lg font-bold text-accent-yellow-light mb-2">Other Class Features</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-theme-tertiary">
                {character.featuresAndTraits.classFeatures.map((feature, index) => (
                  <li key={`lcf-${index}`}>
                    <button onClick={() => onFeatureClick(feature)} className="text-left hover:text-accent-yellow-light transition-colors cursor-pointer">
                      {feature}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Selected Feats Display */}
          {character.selectedFeats && character.selectedFeats.length > 0 && (
            <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-cyan-500">
              <h3 className="text-lg font-bold text-cyan-400 mb-2">Feats</h3>
              <div className="grid grid-cols-1 gap-2">
                {character.selectedFeats.map((featSlug, index) => (
                  <div key={`feat-${index}`} className="p-2 bg-theme-tertiary rounded border border-cyan-700">
                    <div className="font-semibold text-cyan-300 text-sm">{featSlug}</div>
                    <p className="text-xs text-theme-muted mt-1">Feat</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Modern layout: Personality separate, others in 4-column grid
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-red-500 border-b border-red-800 pb-1">Features & Traits</h2>

      {/* Personality section - full width row */}
      <div className="grid grid-cols-1 gap-2">
        <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-blue-500">
          <h3 className="text-lg font-bold text-accent-blue-light mb-2">Personality, Ideals, Bonds & Flaws</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-theme-tertiary">
            <li><span className="font-semibold text-theme-primary">Personality:</span> <span className={handwritingClass}>{character.featuresAndTraits.personality}</span></li>
            <li><span className="font-semibold text-theme-primary">Ideals:</span> <span className={handwritingClass}>{character.featuresAndTraits.ideals}</span></li>
            <li><span className="font-semibold text-theme-primary">Bonds:</span> <span className={handwritingClass}>{character.featuresAndTraits.bonds}</span></li>
            <li><span className="font-semibold text-theme-primary">Flaws:</span> <span className={handwritingClass}>{character.featuresAndTraits.flaws}</span></li>
          </ul>
        </div>
      </div>

      {/* Other features - 4-column row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-green-500">
          <h3 className="text-lg font-bold text-accent-green-light mb-2">Species Traits</h3>
          <div className="flex flex-wrap gap-2">
            {character.featuresAndTraits.speciesTraits.map((trait, index) => (
              <button
                key={`r-${index}`}
                onClick={() => onFeatureClick(trait)}
                className="px-2 py-1 bg-accent-green-dark text-theme-primary text-xs rounded hover:bg-accent-green transition-colors cursor-pointer"
              >
                {trait}
              </button>
            ))}
          </div>
        </div>
        {/* Class Features */}
        {character.srdFeatures?.classFeatures && character.srdFeatures.classFeatures.length > 0 ? (
          <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-orange-500">
            <h3 className="text-lg font-bold text-orange-400 mb-2">Class Features</h3>
            <div className="space-y-2 text-sm text-theme-tertiary max-h-60 overflow-y-auto">
              {/* Deduplicate features by name, keeping the highest level version */}
              {character.srdFeatures.classFeatures
                .reduce((unique, feature) => {
                  const existing = unique.find(f => f.name === feature.name);
                  if (!existing || feature.level > existing.level) {
                    return existing
                      ? unique.map(f => f.name === feature.name ? feature : f)
                      : [...unique, feature];
                  }
                  return unique;
                }, [] as typeof character.srdFeatures.classFeatures)
                .map((feature, index) => (
                  <div key={`cf-${index}`} className="flex items-start gap-2">
                    <span className="text-xs bg-orange-700 text-theme-primary px-1.5 py-0.5 rounded font-mono">
                      L{feature.level}
                    </span>
                    <button
                      onClick={() => onFeatureClick(feature.name)}
                      className="text-left hover:text-accent-yellow-light transition-colors cursor-pointer flex-1"
                    >
                      {feature.name}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-orange-500">
            <h3 className="text-lg font-bold text-orange-400 mb-2">Class Features</h3>
            <p className="text-sm text-theme-disabled italic">No class features available</p>
          </div>
        )}

        {/* Subclass Features */}
        {character.srdFeatures?.subclassFeatures && character.srdFeatures.subclassFeatures.length > 0 ? (
          <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-accent-purple">
            <h3 className="text-lg font-bold text-accent-purple-light mb-2">Subclass Features</h3>
            <div className="space-y-2 text-sm text-theme-tertiary max-h-60 overflow-y-auto">
              {character.srdFeatures.subclassFeatures.map((feature, index) => (
                <div key={`scf-${index}`} className="flex items-start gap-2">
                  <span className="text-xs bg-purple-700 text-theme-primary px-1.5 py-0.5 rounded font-mono">
                    L{feature.level}
                  </span>
                  <button
                    onClick={() => onFeatureClick(feature.name)}
                    className="text-left hover:text-accent-yellow-light transition-colors cursor-pointer flex-1"
                  >
                    {feature.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-accent-purple">
            <h3 className="text-lg font-bold text-accent-purple-light mb-2">Subclass Features</h3>
            <p className="text-sm text-theme-disabled italic">No subclass selected</p>
          </div>
        )}

        {/* Legacy Class Features or Selected Feats */}
        {character.featuresAndTraits.classFeatures && character.featuresAndTraits.classFeatures.length > 0 ? (
          <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-yellow-500">
            <h3 className="text-lg font-bold text-accent-yellow-light mb-2">Other Class Features</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-theme-tertiary">
              {character.featuresAndTraits.classFeatures.map((feature, index) => (
                <li key={`lcf-${index}`}>
                  <button onClick={() => onFeatureClick(feature)} className="text-left hover:text-accent-yellow-light transition-colors cursor-pointer">
                    {feature}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : character.selectedFeats && character.selectedFeats.length > 0 ? (
          <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-cyan-500">
            <h3 className="text-lg font-bold text-cyan-400 mb-2">Feats</h3>
            <div className="grid grid-cols-1 gap-2">
              {character.selectedFeats.map((featSlug, index) => (
                <div key={`feat-${index}`} className="p-2 bg-theme-tertiary rounded border border-cyan-700">
                  <div className="font-semibold text-cyan-300 text-sm">{featSlug}</div>
                  <p className="text-xs text-theme-muted mt-1">Feat</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-theme-secondary rounded-xl shadow-lg border-l-4 border-cyan-500">
            <h3 className="text-lg font-bold text-cyan-400 mb-2">Feats</h3>
            <p className="text-sm text-theme-disabled italic">No additional features</p>
          </div>
        )}
      </div>
    </div>
  );
};
