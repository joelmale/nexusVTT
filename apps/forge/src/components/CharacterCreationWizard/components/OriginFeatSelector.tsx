import React, { useState, useMemo } from 'react';
import { BookOpen, XCircle } from 'lucide-react';
import { FEAT_DATABASE } from '../../../services/dataService';

interface OriginFeatSelectorProps {
  selectedFeat: string | undefined;
  onSelect: (featSlug: string) => void;
  featOptions?: string[]; // Optional: limit to specific feat slugs
}

export const OriginFeatSelector: React.FC<OriginFeatSelectorProps> = ({
  selectedFeat,
  onSelect,
  featOptions,
}) => {
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const availableFeats = useMemo(() => {
    let feats = FEAT_DATABASE.filter(f => f.category === 'origin');
    if (featOptions && featOptions.length > 0) {
      feats = feats.filter(f => featOptions.includes(f.slug));
    }
    return feats;
  }, [featOptions]);

  // Check if this is for a versatile human (no featOptions restriction)
  const isVersatileSelection = !featOptions || featOptions.length === 0;

  const handleToggleDetails = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetails(showDetails === slug ? null : slug);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-theme-tertiary">
        {isVersatileSelection ? 'Choose Origin Feat (Versatile)' : 'Choose Origin Feat'}
      </label>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
         {availableFeats.map((feat) => (
          <div key={feat.slug} className="relative">
            <button
              onClick={() => onSelect(feat.slug)}
              className={`w-full p-3 rounded-lg text-left border-2 transition-all flex justify-between items-start ${
                selectedFeat === feat.slug
                  ? 'bg-accent-purple-darker border-accent-purple shadow-md'
                  : 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
              }`}
            >
              <div>
                <div className={`text-sm font-bold ${selectedFeat === feat.slug ? 'text-white' : 'text-accent-yellow-light'}`}>
                  {feat.name}
                </div>
                {selectedFeat === feat.slug && (
                  <div className="text-xs text-accent-green-light mt-1">Selected</div>
                )}
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => handleToggleDetails(feat.slug, e)}
                className="text-theme-muted hover:text-white p-1"
                title="View Details"
              >
                <BookOpen className="w-4 h-4" />
              </div>
            </button>

            {showDetails === feat.slug && (
              <div className="absolute z-20 top-full left-0 w-full mt-1 p-3 bg-theme-secondary border border-theme-primary rounded-lg shadow-xl">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-bold text-white text-sm">{feat.name}</h5>
                  <button onClick={() => setShowDetails(null)} className="text-theme-muted hover:text-white">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-theme-tertiary mb-2">{feat.description}</p>
                <div className="text-xs text-theme-muted">
                  <strong className="text-theme-tertiary">Benefits:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {feat.benefits.map((benefit, idx) => (
                      <li key={idx}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
