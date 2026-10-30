import type { CharacterCreationData } from '../types/dnd';
import {
  LEGACY_INVOCATIONS,
  legacyInvocationCount,
  legacyInvocationId,
  legacyInvocationUnavailable,
} from '../services/legacyInvocations';
import styles from './CastingGrantChoices.module.css';
import { humanizeId } from '../utils/displayLabels';

export function LegacyInvocationChoices({
  data,
  onChange,
}: {
  data: CharacterCreationData;
  onChange: (update: Partial<CharacterCreationData>) => void;
}) {
  if (data.edition !== '2014' || data.classSlug !== 'warlock') return null;
  const selected = data.eldritchInvocations ?? [];
  const count = legacyInvocationCount(data.level);
  if (!count && !selected.length && !data.pactBoon) return null;
  const options = [
    ...LEGACY_INVOCATIONS,
    ...[...new Set(selected.map(legacyInvocationId))]
      .filter((id) => !LEGACY_INVOCATIONS.some((entry) => entry.id === id))
      .map((id) => ({
        id,
        name: humanizeId(id),
        level: 1,
        requiredSpell: undefined,
        requiredPact: undefined,
      })),
  ];
  return (
    <section className={styles.grants} aria-label="Legacy Warlock choices">
      {(data.level >= 3 || data.pactBoon) && (
        <label className={styles.field}>
          Pact Boon
          <select
            className={styles.select}
            aria-label="Legacy Pact Boon"
            value={data.pactBoon ?? ''}
            onChange={(event) =>
              onChange({
                pactBoon: (event.target.value ||
                  undefined) as CharacterCreationData['pactBoon'],
              })
            }
          >
            <option value="">Choose a Pact Boon</option>
            {['blade', 'chain', 'tome'].map((pact) => (
              <option key={pact} value={pact} disabled={data.level < 3}>
                Pact of the {pact}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className={styles.group}>
        <legend>
          Legacy Eldritch Invocations ({selected.length}/{count})
        </legend>
        <div className={styles.options}>
        {options.map((entry) => {
          const checked = selected.some(
            (id) => legacyInvocationId(id) === entry.id,
          );
          const reason = legacyInvocationUnavailable(data, entry.id);
          return (
            <label className={styles.option} key={entry.id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && Boolean(reason)}
                onChange={() =>
                  onChange({
                    eldritchInvocations: checked
                      ? selected.filter(
                          (id) => legacyInvocationId(id) !== entry.id,
                        )
                      : [...selected, entry.id],
                  })
                }
              />
              <span className={styles.optionText}>
                <span>{entry.name}</span>
                {reason && <span className={styles.description}>{reason}</span>}
              </span>
            </label>
          );
        })}
        </div>
      </fieldset>
    </section>
  );
}
