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
import { invocationRequirement } from './ClassGrantChoices';

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

  const locked = INVOCATIONS_2024.filter(
    (entry) => toLevel < entry.level && !selected.includes(entry.id),
  );
  const visible = INVOCATIONS_2024.filter((entry) => !locked.includes(entry));

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
      <div className={styles.options}>
        {visible.map((invocation) => {
          const chosen = selected.includes(invocation.id);
          const requirement = invocationRequirement(invocation, {
            level: toLevel,
            eldritchInvocations: selected,
          });
          return (
            <div className={styles.invocationItem} key={invocation.id}>
              <label className={styles.option}>
                <input
                  type="checkbox"
                  checked={chosen}
                  disabled={!chosen && Boolean(requirement)}
                  onChange={() => toggle(invocation.id)}
                />
                <span className={styles.optionText}>
                  <span>{invocation.name}</span>
                  {requirement && (
                    <span className={styles.description}>{requirement}</span>
                  )}
                </span>
              </label>
              {chosen && invocation.choice && (
                <fieldset className={styles.group}>
                  <legend>Targets for {invocation.name}</legend>
                  {invocationTargetOptions(draft, invocation).map((option) => (
                    <label className={styles.option} key={option.id}>
                      <input
                        type="checkbox"
                        checked={invocationTargets(
                          draft,
                          invocation.id,
                        ).includes(option.id)}
                        onChange={() => toggleTarget(invocation.id, option.id)}
                      />
                      <span>{option.name}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
          );
        })}
      </div>
      {locked.length > 0 && (
        <details className={styles.unlocks}>
          <summary>Unlocks at higher levels ({locked.length})</summary>
          <div className={styles.options}>
            {locked.map((invocation) => (
              <div className={styles.option} key={invocation.id}>
                <span className={styles.optionText}>
                  <span>{invocation.name}</span>
                  <span className={styles.description}>
                    {invocationRequirement(invocation, {
                      level: toLevel,
                      eldritchInvocations: selected,
                    })}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
      {errors.length > 0 && (
        <ul role="alert" className={styles.errors}>
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onPrev}>
          Back
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={errors.length > 0}
          onClick={onNext}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
