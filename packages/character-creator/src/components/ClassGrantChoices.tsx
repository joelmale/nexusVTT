import type { CharacterCreationData } from '../types/dnd';
import { masteryCount, masteryOptions } from '../services/classGrantChoices';
import { choiceId } from '../services/originChoices';
import styles from './CastingGrantChoices.module.css';
import { INVOCATIONS_2024 } from '../services/invocations';

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
      {warlock && data.level === 1 && (
        <label>
          Eldritch Invocation{' '}
          <select
            value={data.eldritchInvocations?.[0] ?? ''}
            onChange={(event) =>
              onChange({ eldritchInvocations: [event.target.value] })
            }
          >
            <option value="">Choose an invocation</option>
            {INVOCATIONS_2024.map((entry) => (
              <option
                key={entry.id}
                value={entry.id}
                disabled={data.level < entry.level}
              >
                {entry.name} (level {entry.level})
              </option>
            ))}
          </select>
        </label>
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
          <legend>Weapon masteries ({count} at level 1)</legend>
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
