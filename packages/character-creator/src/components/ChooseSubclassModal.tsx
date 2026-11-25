import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { AppSubclass, loadFeatures } from '../services/dataService';
import subclassFeaturesByLevel from '../data/subclassFeaturesByLevel.json';
import { CORE_SUBCLASSES_2024 } from '../data/coreSubclasses';
import type { Edition } from '../types/dnd';

interface SubclassFeature {
  level: number;
  name: string;
  description: string;
}

interface SubclassData {
  name: string;
  description: string;
  features: SubclassFeature[];
}

interface ChooseSubclassModalProps {
  isOpen: boolean;
  onClose: () => void;
  subclasses: AppSubclass[];
  onSelect: (subclass: AppSubclass) => void;
  characterClass: string;
  classSlug: string;
  edition: Edition;
  /** The subclass card the player clicked; the modal opens on just that one. */
  focusSlug?: string;
}

/**
 * Level-by-level features for a subclass: the curated text first, then the
 * SRD. The 2014 SRD carries full feature text; the 2024 SRD file only names
 * the features at each level, and 2014 text would state the wrong rules for
 * a 2024 character, so 2024 falls back to names alone.
 */
function subclassFeatures(
  classSlug: string,
  subclassSlug: string,
  edition: Edition,
): SubclassFeature[] {
  const curated = (subclassFeaturesByLevel as Record<string, Record<string, SubclassData>>)[
    classSlug
  ]?.[subclassSlug];
  if (curated?.features.length) return curated.features;

  if (edition === '2024') {
    const core = CORE_SUBCLASSES_2024.find(
      (entry) => entry.class === classSlug && entry.slug === subclassSlug,
    );
    return core
      ? Object.entries(core.features).flatMap(([level, names]) =>
          String(names)
            .split('|')
            .map((name) => ({ level: Number(level), name, description: '' })),
        )
      : [];
  }

  return loadFeatures()
    .filter((feature) => feature.class === classSlug && feature.subclass === subclassSlug)
    .map((feature) => ({
      level: feature.level,
      name: feature.name,
      description: feature.desc.join(' '),
    }));
}

const ChooseSubclassModal: React.FC<ChooseSubclassModalProps> = ({
  isOpen,
  onClose,
  subclasses,
  onSelect,
  characterClass,
  classSlug,
  edition,
  focusSlug,
}) => {
  const [expandedSubclass, setExpandedSubclass] = useState<string | null>(focusSlug ?? null);
  const [showAll, setShowAll] = useState(!focusSlug);

  if (!isOpen) return null;

  const shown = showAll ? subclasses : subclasses.filter((s) => s.slug === focusSlug);
  const focused = !showAll ? shown[0] : undefined;

  // Group features by level
  const groupFeaturesByLevel = (features: SubclassFeature[]) => {
    const grouped = new Map<number, SubclassFeature[]>();
    features.forEach(feature => {
      if (!grouped.has(feature.level)) {
        grouped.set(feature.level, []);
      }
      grouped.get(feature.level)!.push(feature);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex justify-center items-center z-50 p-4">
      <div className="bg-theme-secondary rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-theme-primary">
        {/* Header */}
        <div className="p-6 border-b border-theme-primary bg-theme-tertiary">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-accent-yellow-light">
              {focused ? focused.name : `Choose a ${characterClass} Subclass`}
            </h2>
            <button
              onClick={onClose}
              className="text-theme-muted hover:text-theme-primary transition-colors"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-4">
          {!showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-sm font-semibold text-accent-yellow-light underline"
            >
              Compare all {characterClass} subclasses
            </button>
          )}
          {shown.map(subclass => {
            const groupedFeatures = groupFeaturesByLevel(
              subclassFeatures(classSlug, subclass.slug, edition),
            );

            return (
              <div key={subclass.slug} className="border border-theme-primary rounded-lg overflow-hidden bg-theme-tertiary">
                {/* Header - Clickable */}
                <div
                  className="p-4 hover:bg-theme-quaternary cursor-pointer flex items-center justify-between transition-colors"
                  onClick={() => setExpandedSubclass(
                    expandedSubclass === subclass.slug ? null : subclass.slug
                  )}
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-accent-yellow-light">{subclass.name}</h3>
                    <p className="text-sm text-theme-tertiary mt-1">
                      {subclass.subclassFlavor}
                    </p>
                    <p className="text-sm text-theme-muted mt-2">
                      {subclass.desc && subclass.desc.length > 0 ? subclass.desc[0] : 'Click to see details'}
                    </p>
                  </div>
                  <div className="ml-4">
                    {expandedSubclass === subclass.slug ? (
                      <ChevronUp className="w-5 h-5 text-theme-muted" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-theme-muted" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedSubclass === subclass.slug && (
                  <div className="px-4 pb-4 border-t border-theme-primary bg-theme-secondary">
                    <div className="pt-4 space-y-4">
                      {/* Description from SRD */}
                      {subclass.desc && subclass.desc.length > 1 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-accent-red-light text-sm">Description:</h4>
                          <div className="space-y-2 text-sm text-theme-tertiary">
                            {subclass.desc.slice(1).map((desc, index) => (
                              <p key={index} className="leading-relaxed">{desc}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Level-by-level features */}
                      {groupedFeatures.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-accent-red-light text-sm">Subclass Features by Level:</h4>
                          {groupedFeatures.map(([level, features]) => (
                            <div key={level} className="bg-theme-tertiary border border-theme-primary rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-accent-yellow font-bold text-lg">Level {level}</span>
                              </div>
                              <div className="space-y-3">
                                {features.map((feature, idx) => (
                                  <div key={idx} className="border-l-2 border-accent-blue pl-3">
                                    <h5 className="font-semibold text-accent-blue-light text-sm">{feature.name}</h5>
                                    {feature.description && (
                                      <p className="text-xs text-theme-tertiary mt-1 leading-relaxed">{feature.description}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-theme-tertiary border border-theme-primary rounded-lg p-4">
                          <p className="text-sm text-theme-muted">
                            The creator does not have this subclass&apos;s feature text yet. You can
                            still choose it; its features are listed in the book it comes from.
                          </p>
                        </div>
                      )}

                      {/* Select Button */}
                      <div className="pt-4 border-t border-theme-primary">
                        <button
                          onClick={() => onSelect(subclass)}
                          className="w-full bg-accent-red hover:bg-accent-red-light text-theme-primary font-medium py-3 px-4 rounded-lg transition-colors"
                        >
                          Choose {subclass.name}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChooseSubclassModal;
