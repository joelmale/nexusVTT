import React from 'react';
import type { CharacterCreationData } from '../../../types/dnd';
import { classSpellSlots } from '../../../utils/classSpellSlots';
import {
  invocationCount,
  selectedInvocationCount,
} from '../../../services/invocations';
import { legacyInvocationCount } from '../../../services/legacyInvocations';

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** Spell slots and invocation counts for the chosen class and level. */
export function describeLevelResources(data: CharacterCreationData): {
  slots: string[];
  invocations?: { chosen: number; allowed: number };
} {
  const edition = data.edition === '2014' ? '2014' : '2024';
  const slots = classSpellSlots(data.classSlug, edition, data.level)
    .map((count, level) =>
      count > 0
        ? data.classSlug === 'warlock'
          ? `${count} Pact Magic slot${count === 1 ? '' : 's'} (${ORDINALS[level]} level)`
          : `${ORDINALS[level]}: ${count}`
        : '',
    )
    .filter(Boolean);
  const invocations =
    data.classSlug === 'warlock'
      ? edition === '2024'
        ? {
            chosen: selectedInvocationCount(data),
            allowed: invocationCount(data.level),
          }
        : {
            chosen: data.eldritchInvocations?.length ?? 0,
            allowed: legacyInvocationCount(data.level),
          }
      : undefined;
  return { slots, invocations };
}

export const LevelResourceSummary: React.FC<{ data: CharacterCreationData }> = ({
  data,
}) => {
  const { slots, invocations } = describeLevelResources(data);
  if (!slots.length && !invocations?.allowed) return null;
  return (
    <div
      className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-4 space-y-1 text-sm"
      aria-label="Level resources"
    >
      <h4 className="text-lg font-bold text-accent-yellow-light">
        Level {data.level} resources
      </h4>
      {slots.length > 0 && (
        <div className="text-theme-tertiary">
          Spell slots: <span className="text-theme-primary">{slots.join(', ')}</span>
        </div>
      )}
      {invocations && invocations.allowed > 0 && (
        <div className="text-theme-tertiary">
          Eldritch Invocations:{' '}
          <span className="text-theme-primary">
            {invocations.chosen} / {invocations.allowed} chosen
          </span>
        </div>
      )}
    </div>
  );
};
