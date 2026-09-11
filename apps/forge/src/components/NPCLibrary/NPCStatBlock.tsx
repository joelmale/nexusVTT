import React from 'react';
import { NPC } from '../../types/dnd';

interface NPCStatBlockProps {
  npc: NPC;
  onClose?: () => void;
}

export const NPCStatBlock: React.FC<NPCStatBlockProps> = ({ npc, onClose }) => {
  return (
    <div className="bg-theme-primary rounded-lg shadow-xl max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-green-900 p-6 rounded-t-lg">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{npc.name}</h1>
            <div className="text-purple-200 space-y-1">
              <p><span className="font-semibold">Species:</span> {npc.species}</p>
              <p><span className="font-semibold">Occupation:</span> {npc.occupation}</p>
              <p><span className="font-semibold">Alignment:</span> {npc.alignment}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Ability Scores */}
        <section>
          <h2 className="text-2xl font-bold text-accent-yellow-light border-b border-accent-yellow-dark pb-2 mb-4">
            Ability Scores
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {Object.entries(npc.abilityScores).map(([ability, score]) => {
              const modifier = Math.floor((score - 10) / 2);
              return (
                <div key={ability} className="text-center">
                  <div className="text-sm font-semibold text-theme-tertiary">{ability}</div>
                  <div className="text-2xl font-bold text-accent-yellow-light">{score}</div>
                  <div className="text-sm text-theme-muted">
                    ({modifier >= 0 ? '+' : ''}{modifier})
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Personality & Background */}
        <section>
          <h2 className="text-2xl font-bold text-accent-green-light border-b border-accent-green-dark pb-2 mb-4">
            Personality & Background
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {npc.personalityTraits.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-theme-tertiary mb-2">Personality Traits</h3>
                <ul className="space-y-1">
                  {npc.personalityTraits.map((trait, index) => (
                    <li key={index} className="text-theme-muted">• {trait}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              {npc.relationshipStatus && (
                <div>
                  <h3 className="text-lg font-semibold text-theme-tertiary">Relationship Status</h3>
                  <p className="text-theme-muted">{npc.relationshipStatus}</p>
                </div>
              )}

              {npc.sexualOrientation && (
                <div>
                  <h3 className="text-lg font-semibold text-theme-tertiary">Sexual Orientation</h3>
                  <p className="text-theme-muted">{npc.sexualOrientation}</p>
                </div>
              )}

              {npc.plotHook && (
                <div>
                  <h3 className="text-lg font-semibold text-theme-tertiary">Plot Hook</h3>
                  <p className="text-theme-muted">{npc.plotHook}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Notes */}
        {npc.notes && (
          <section>
            <h2 className="text-2xl font-bold text-accent-purple-light border-b border-accent-purple-dark pb-2 mb-4">
              Notes
            </h2>
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: npc.notes }}
            />
          </section>
        )}

        {/* Metadata */}
        <section className="text-sm text-theme-muted border-t border-theme-secondary pt-4">
          <p>Created: {new Date(npc.createdAt).toLocaleDateString()}</p>
          {npc.updatedAt !== npc.createdAt && (
            <p>Last Updated: {new Date(npc.updatedAt).toLocaleDateString()}</p>
          )}
        </section>
      </div>
    </div>
  );
};