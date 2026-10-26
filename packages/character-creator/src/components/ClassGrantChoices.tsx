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
import { invocationTargetOptions } from '../services/invocationChoices';

export function ClassGrantChoices({
  data,
  onChange,
}: {
  data: CharacterCreationData;
  onChange: (update: Partial<CharacterCreationData>) => void;
}) {
  if (data.edition !== '2024') return null;
  const count = masteryCount(data);
  const cleric = data.classSlug === 'cleric';
  const druid = data.classSlug === 'druid';
  const warlock = data.classSlug === 'warlock';
  if (!count && !cleric && !druid && !warlock) return null;
  return (
    <section className={styles.grants} aria-label="Class grant choices">
      <h3>Class choices</h3>
      {warlock && (
        <fieldset>
          <legend>
            Eldritch Invocations ({selectedInvocationCount(data)}/
            {invocationCount(data.level)})
          </legend>
          {INVOCATIONS_2024.map((entry) => {
            const selected =
              data.eldritchInvocations?.includes(entry.id) ?? false;
            const unavailable =
              data.level < entry.level ||
              Boolean(
                entry.requires &&
                !data.eldritchInvocations?.includes(entry.requires),
              );
            return (
              <div key={entry.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selected && unavailable}
                    onChange={() =>
                      onChange({
                        eldritchInvocations: selected
                          ? data.eldritchInvocations?.filter(
                              (id) => id !== entry.id,
                            )
                          : [...(data.eldritchInvocations ?? []), entry.id],
                      })
                    }
                  />
                  {entry.name} (level {entry.level}
                  {entry.requires ? `; requires ${entry.requires}` : ''})
                </label>
                {selected && entry.choice && (
                  <fieldset>
                    <legend>
                      {entry.name}: choose different{' '}
                      {entry.choice === 'origin-feat'
                        ? 'Origin feats'
                        : 'cantrips'}
                      ; each uses one invocation
                    </legend>
                    {invocationTargetOptions(data, entry).map((option) => {
                      const targets = invocationTargets(data, entry.id);
                      const checked = targets.includes(option.id);
                      return (
                        <label key={option.id}>
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
                          {option.name}
                        </label>
                      );
                    })}
                  </fieldset>
                )}
              </div>
            );
          })}
        </fieldset>
      )}
      {(cleric || druid) && (
        <label>
          {cleric ? 'Divine Order' : 'Primal Order'}
          <select
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
              <option key={order}>{order}</option>
            ))}
          </select>
        </label>
      )}
      {count > 0 && (
        <fieldset>
          <legend>
            Weapon masteries ({count} at level {data.level})
          </legend>
          <div className={styles.options}>
            {masteryOptions(data).map((weapon) => {
              const selected = (data.weaponMastery ?? []).some(
                (value) => choiceId(value) === choiceId(weapon.name),
              );
              return (
                <label key={weapon.slug}>
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
                  {weapon.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </section>
  );
}
