import type { CharacterCreationData } from '../types/dnd';
import { featProficiencyGrants } from '../services/featProficiencies';
import styles from './CastingGrantChoices.module.css';

const grantLabel = (key: string) =>
  key.replace(/^skilled:lesson-/, 'Skilled lesson ');

export function FeatProficiencyChoices({
  data,
  onChange,
}: {
  data: CharacterCreationData;
  onChange: (update: Partial<CharacterCreationData>) => void;
}) {
  return (
    <>
      {featProficiencyGrants(data).map((grant) => (
        <fieldset className={styles.grants} key={grant.choiceKey}>
          <legend>
            {grantLabel(grant.choiceKey)} proficiencies — choose {grant.count}
          </legend>
          {Array.from({ length: grant.count }, (_, index) => (
            <label key={index}>
              {grantLabel(grant.choiceKey)} proficiency {index + 1}
              <select
                value={grant.selected[index] ?? ''}
                onChange={(event) => {
                  const selected = Array.from(
                    { length: grant.count },
                    (_, position) =>
                      position === index
                        ? event.target.value
                        : (grant.selected[position] ?? ''),
                  );
                  onChange({
                    featChoices: {
                      ...data.featChoices,
                      [grant.choiceKey]: {
                        ...data.featChoices?.[grant.choiceKey],
                        proficiencies: selected,
                      },
                    },
                  });
                }}
              >
                <option value="">Choose a proficiency</option>
                {[
                  ...new Set([
                    ...grant.options,
                    ...grant.selected.filter(Boolean),
                  ]),
                ].map((name) => (
                  <option
                    key={name}
                    value={name}
                    disabled={!grant.options.includes(name)}
                  >
                    {name}
                    {!grant.options.includes(name) ? ' (unavailable)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      ))}
    </>
  );
}
