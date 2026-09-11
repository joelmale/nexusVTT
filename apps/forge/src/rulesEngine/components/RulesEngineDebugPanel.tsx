/**
 * Rules Engine Debug Panel
 * Development-only component for inspecting rules engine execution
 */

import React, { useState } from 'react';
import type { DerivedState } from '../types/derived';
import type { Character } from '../../types/dnd';

export interface RulesEngineDebugPanelProps {
  character?: Character;
  derived?: DerivedState;
  showEffects?: boolean;
  showPredicates?: boolean;
  showFormulas?: boolean;
}

/**
 * Debug panel for visualizing rules engine state
 * Only rendered in development mode
 */
export function RulesEngineDebugPanel({
  character,
  derived,
  showEffects: _showEffects = true,
  showPredicates: _showPredicates = true,
  showFormulas: _showFormulas = true,
}: RulesEngineDebugPanelProps): React.ReactElement | null {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'provenance' | 'derived' | 'raw'>('provenance');

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  if (!character || !derived) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg">
        <p className="text-sm">Rules Engine Debug Panel</p>
        <p className="text-xs text-gray-400">No character or derived state available</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-2xl max-w-2xl z-50">
      {/* Header */}
      <div
        className="bg-gray-800 p-3 rounded-t-lg flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎲</span>
          <h3 className="font-semibold">Rules Engine Debug</h3>
        </div>
        <button
          className="text-gray-400 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 max-h-96 overflow-y-auto">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-700">
            <button
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === 'provenance'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('provenance')}
            >
              Provenance
            </button>
            <button
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === 'derived'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('derived')}
            >
              Derived State
            </button>
            <button
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === 'raw'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('raw')}
            >
              Raw Data
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'provenance' && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Applied Effects</h4>
              {derived.appliedEffects && derived.appliedEffects.length > 0 ? (
                <div className="space-y-2">
                  {derived.appliedEffects.map((effect, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-xs ${
                        effect.applied
                          ? 'bg-green-900/30 border border-green-700'
                          : 'bg-red-900/30 border border-red-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{effect.sourceId}</span>
                        <span
                          className={`px-2 py-0.5 rounded ${
                            effect.applied ? 'bg-green-700' : 'bg-red-700'
                          }`}
                        >
                          {effect.applied ? 'Applied' : 'Skipped'}
                        </span>
                      </div>
                      <div className="text-gray-400 mt-1">{effect.effectId}</div>
                      {effect.reason && (
                        <div className="text-gray-500 italic mt-1">Reason: {effect.reason}</div>
                      )}
                      {effect.value !== undefined && (
                        <div className="text-blue-400 mt-1">
                          Value: {JSON.stringify(effect.value)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No effects applied yet</p>
              )}
            </div>
          )}

          {activeTab === 'derived' && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Derived State Summary</h4>
              <div className="space-y-3">
                {/* Abilities */}
                <div>
                  <h5 className="text-xs font-semibold text-gray-400 mb-1">Abilities</h5>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(derived.abilities || {}).map(([ability, data]) => (
                      <div key={ability} className="bg-gray-800 p-2 rounded text-xs">
                        <div className="font-semibold">{ability}</div>
                        <div className="text-gray-400">
                          {data.score} ({data.modifier >= 0 ? '+' : ''}
                          {data.modifier})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proficiencies */}
                <div>
                  <h5 className="text-xs font-semibold text-gray-400 mb-1">Proficiencies</h5>
                  <div className="bg-gray-800 p-2 rounded text-xs">
                    <div>
                      <span className="text-gray-400">Armor:</span>{' '}
                      {derived.proficiencies?.armor?.length || 0}
                    </div>
                    <div>
                      <span className="text-gray-400">Weapons:</span>{' '}
                      {derived.proficiencies?.weapons?.length || 0}
                    </div>
                    <div>
                      <span className="text-gray-400">Tools:</span>{' '}
                      {derived.proficiencies?.tools?.length || 0}
                    </div>
                    <div>
                      <span className="text-gray-400">Languages:</span>{' '}
                      {derived.proficiencies?.languages?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {derived.tags && derived.tags.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-gray-400 mb-1">Tags</h5>
                    <div className="flex flex-wrap gap-1">
                      {derived.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Raw JSON Data</h4>
              <pre className="bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(derived, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RulesEngineDebugPanel;
