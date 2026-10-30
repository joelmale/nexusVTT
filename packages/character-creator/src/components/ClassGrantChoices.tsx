import type { CharacterCreationData } from '../types/dnd';
import { masteryCount, masteryOptions } from '../services/classGrantChoices';
import { choiceId } from '../services/originChoices';
import styles from './CastingGrantChoices.module.css';
import {
  INVOCATIONS_2024,
  invocationCount,
  invocationTargets,
  selectedInvocationCount,
} from '../services/invocations';
import type { InvocationDefinition } from '../services/invocations';
import { invocationTargetOptions } from '../services/invocationChoices';
import { ExpertiseChoices } from './ExpertiseChoices';
import { LegacyInvocationChoices } from './LegacyInvocationChoices';
import { classExpertiseCount } from '../services/expertiseChoices';
import { humanizeId } from '../utils/displayLabels';

const invocationName = (id: string) =>
  INVOCATIONS_2024.find((entry) => entry.id === id)?.name ?? humanizeId(id);

/** Why an invocation cannot be taken yet, in plain words. */
export function invocationRequirement(
  entry: InvocationDefinition,
  data: Pick<CharacterCreationData, 'level' | 'eldritchInvocations'>,
): string | undefined {
  const reasons: string[] = [];
  if (data.level < entry.level) reasons.push(`level ${entry.level}`);
  if (entry.requires && !data.eldritchInvocations?.includes(entry.requires))
    reasons.push(invocationName(entry.requires));
  return reasons.length ? `requires ${reasons.join(' and ')}` : undefined;
}

export function ClassGrantChoices({
  data,
  onChange,
}: {
  data: CharacterCreationData;
  onChange: (update: Partial<CharacterCreationData>) => void;
}) {
  if (data.edition !== '2024')
    return <><ExpertiseChoices data={data} onChange={onChange} /><LegacyInvocationChoices data={data} onChange={onChange} /></>;
  const count = masteryCount(data);
  const cleric = data.classSlug === 'cleric';
  const druid = data.classSlug === 'druid';
  const warlock = data.classSlug === 'warlock';
  if (!count && !cleric && !druid && !warlock && !classExpertiseCount(data))
    return null;

  const renderInvocation = (entry: InvocationDefinition) => {
    const selected = data.eldritchInvocations?.includes(entry.id) ?? false;
    const requirement = invocationRequirement(entry, data);
    return (
      <div className={styles.invocationItem} key={entry.id}>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={selected}
            disabled={!selected && Boolean(requirement)}
            onChange={() =>
              onChange({
                eldritchInvocations: selected
                  ? data.eldritchInvocations?.filter((id) => id !== entry.id)
                  : [...(data.eldritchInvocations ?? []), entry.id],
              })
            }
          />
          <span className={styles.optionText}>
            <span>
              {entry.name} (level {entry.level}
              {entry.requires
                ? `; requires ${invocationName(entry.requires)}`
                : ''}
              )
            </span>
          </span>
        </label>
        {selected && entry.choice && (
          <fieldset className={styles.group}>
            <legend>
              {entry.name}: choose different{' '}
              {entry.choice === 'origin-feat' ? 'Origin feats' : 'cantrips'};
              each uses one invocation
            </legend>
            <div className={styles.options}>
              {invocationTargetOptions(data, entry).map((option) => {
                const targets = invocationTargets(data, entry.id);
                const checked = targets.includes(option.id);
                return (
                  <label className={styles.option} key={option.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange({
                          featChoices: {
                            ...data.featChoices,
                            [`invocation:${entry.id}`]: {
                              targets: checked
                                ? targets.filter((id) => id !== option.id)
                                : [...targets, option.id],
                            },
                          },
                        })
                      }
                    />
                    <span>{option.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>
    );
  };

  const isSelected = (entry: InvocationDefinition) =>
    data.eldritchInvocations?.includes(entry.id) ?? false;
  const locked = INVOCATIONS_2024.filter(
    (entry) => data.level < entry.level && !isSelected(entry),
  );
  const visible = INVOCATIONS_2024.filter((entry) => !locked.includes(entry));

  return (
    <section className={styles.grants} aria-label="Class grant choices">
      <h3>Class choices</h3>
      <ExpertiseChoices data={data} onChange={onChange} />
      {warlock && (
        <fieldset className={styles.group}>
          <legend>
            Eldritch Invocations ({selectedInvocationCount(data)}/
            {invocationCount(data.level)})
          </legend>
          <div className={styles.options}>{visible.map(renderInvocation)}</div>
          {locked.length > 0 && (
            <details className={styles.unlocks}>
              <summary>Unlocks at higher levels ({locked.length})</summary>
              <div className={styles.options}>
                {locked.map((entry) => (
                  <div className={styles.option} key={entry.id}>
                    <span className={styles.optionText}>
                      <span>{entry.name}</span>
                      <span className={styles.description}>
                        {invocationRequirement(entry, data)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </fieldset>
      )}
      {(cleric || druid) && (
        <label className={styles.field}>
          {cleric ? 'Divine Order' : 'Primal Order'}
          <select
            className={styles.select}
            value={(cleric ? data.divineOrder : data.primalOrder) ?? ''}
            onChange={(event) =>
              onChange(
                cleric
                  ? {
                      divineOrder: event.target
                        .value as CharacterCreationData['divineOrder'],
                    }
                  : {
                      primalOrder: event.target
                        .value as CharacterCreationData['primalOrder'],
                    },
              )
            }
          >
            <option value="">Choose an order</option>
            {(cleric
              ? ['protector', 'thaumaturge']
              : ['warden', 'magician']
            ).map((order) => (
              <option key={order} value={order}>
                {humanizeId(order)}
              </option>
            ))}
          </select>
        </label>
      )}
      {count > 0 && (
        <fieldset className={styles.group}>
          <legend>
            Weapon masteries ({count} at level {data.level})
          </legend>
          <div className={styles.options}>
            {masteryOptions(data).map((weapon) => {
              const selected = (data.weaponMastery ?? []).some(
                (value) => choiceId(value) === choiceId(weapon.name),
              );
              return (
                <label className={styles.option} key={weapon.slug}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      onChange({
                        weaponMastery: selected
                          ? data.weaponMastery?.filter(
                              (value) =>
                                choiceId(value) !== choiceId(weapon.name),
                            )
                          : [...(data.weaponMastery ?? []), weapon.name],
                      })
                    }
                  />
                  <span>{weapon.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </section>
  );
}
