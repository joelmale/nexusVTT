import type { CharacterCreationData } from '../types/dnd';
import { featProficiencyGrants } from '../services/featProficiencies';
import styles from './CastingGrantChoices.module.css';

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
        <fieldset className={styles.grants} key={grant.feat}>
          <legend>
            {grant.feat} proficiencies — choose {grant.count}
          </legend>
          {Array.from({ length: grant.count }, (_, index) => (
            <label key={index}>
              {grant.feat} proficiency {index + 1}
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
                      [grant.feat]: {
                        ...data.featChoices?.[grant.feat],
                        proficiencies: selected,
                      },
                    },
                  });
                }}
              >
                <option value="">Choose a proficiency</option>
                {grant.options.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      ))}
    </>
  );
}
