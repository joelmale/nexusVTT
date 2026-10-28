import type { Character, LevelUpChoices } from '../types/dnd';
import {
  INVOCATIONS_2024,
  invocationCount,
  invocationTargets,
  selectedInvocationCount,
} from '../services/invocations';
import { invocationTargetOptions } from '../services/invocationChoices';
import {
  asCreationData,
  levelUpGrantErrors,
} from '../services/levelUpClassGrants';
import styles from './CastingGrantChoices.module.css';

/**
 * Warlock Eldritch Invocation picks while leveling up (SRD 5.2.1). The list on
 * screen is the complete new selection, so an earlier pick can be swapped.
 * Everything shown is validated by the same rules `applyLevelUp` enforces.
 */
export function LevelUpInvocationChoices({
  character,
  toLevel,
  choices,
  onChange,
  onNext,
  onPrev,
}: {
  character: Character;
  toLevel: number;
  choices: LevelUpChoices;
  onChange: (choices: Partial<LevelUpChoices>) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const selected =
    choices.eldritchInvocationsChosen ?? character.eldritchInvocations ?? [];
  const featChoices = {
    ...(character.featChoices ?? {}),
    ...(choices.featChoices ?? {}),
  };
  const draft = asCreationData(
    character,
    {
      ...choices,
      eldritchInvocationsChosen: selected,
      featChoices,
    },
    toLevel,
  );
  const allowed = invocationCount(toLevel);
  const used = selectedInvocationCount(draft);
  const errors = levelUpGrantErrors(
    character,
    { ...choices, eldritchInvocationsChosen: selected, featChoices },
    toLevel,
  );

  const toggle = (id: string) => {
    const removing = selected.includes(id);
    onChange({
      eldritchInvocationsChosen: removing
        ? selected.filter((value) => value !== id)
        : [...selected, id],
      ...(removing
        ? {
            featChoices: {
              ...(choices.featChoices ?? {}),
              [`invocation:${id}`]: { targets: [] },
            },
          }
        : {}),
    });
  };
  const toggleTarget = (id: string, target: string) => {
    const current = invocationTargets(draft, id);
    onChange({
      eldritchInvocationsChosen: selected,
      featChoices: {
        ...(choices.featChoices ?? {}),
        [`invocation:${id}`]: {
          targets: current.includes(target)
            ? current.filter((value) => value !== target)
            : [...current, target],
        },
      },
    });
  };

  return (
    <section className={styles.grants}>
      <h3>Choose Eldritch Invocations</h3>
      <p>
        You have {allowed} invocations at Warlock level {toLevel}. You have
        chosen {used}. Repeatable invocations use one pick for each target.
        Deselect an earlier invocation to replace it.
      </p>
      {INVOCATIONS_2024.map((invocation) => {
        const chosen = selected.includes(invocation.id);
        const available = toLevel >= invocation.level;
        const missing =
          invocation.requires && !selected.includes(invocation.requires)
            ? INVOCATIONS_2024.find((entry) => entry.id === invocation.requires)
                ?.name
            : undefined;
        return (
          <div key={invocation.id}>
            <label>
              <input
                type="checkbox"
                checked={chosen}
                disabled={!chosen && (!available || Boolean(missing))}
                onChange={() => toggle(invocation.id)}
              />
              {invocation.name}
              {!available ? ` (Warlock level ${invocation.level})` : ''}
              {available && missing ? ` (requires ${missing})` : ''}
            </label>
            {chosen && invocation.choice && (
              <fieldset>
                <legend>Targets for {invocation.name}</legend>
                {invocationTargetOptions(draft, invocation).map((option) => (
                  <label key={option.id}>
                    <input
                      type="checkbox"
                      checked={invocationTargets(draft, invocation.id).includes(
                        option.id,
                      )}
                      onChange={() => toggleTarget(invocation.id, option.id)}
                    />
                    {option.name}
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        );
      })}
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onPrev}>
        Back
      </button>
      <button type="button" disabled={errors.length > 0} onClick={onNext}>
        Continue
      </button>
    </section>
  );
}
