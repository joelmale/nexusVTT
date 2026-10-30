import type { CharacterCreationData } from '../types/dnd';
import {
  classExpertiseCount,
  classExpertiseOptions,
} from '../services/expertiseChoices';
import { skillId } from '../services/originChoices';
import styles from './CastingGrantChoices.module.css';
import { humanizeId } from '../utils/displayLabels';

export function ExpertiseChoices({
  data,
  onChange,
}: {
  data: CharacterCreationData;
  onChange: (update: Partial<CharacterCreationData>) => void;
}) {
  const count = classExpertiseCount(data);
  if (!count) return null;
  const selected = data.expertiseSkills ?? [];
  const options = [...new Set([...classExpertiseOptions(data), ...selected])];
  return (
    <fieldset className={styles.grants}>
      <legend>Expertise — choose {count}</legend>
      <div className={styles.options}>
      {options.map((option) => {
        const checked = selected.some(
          (value) => skillId(value) === skillId(option),
        );
        return (
          <label className={styles.option} key={option}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() =>
                onChange({
                  expertiseSkills: checked
                    ? selected.filter(
                        (value) => skillId(value) !== skillId(option),
                      )
                    : [...selected, option],
                })
              }
            />
            <span>{humanizeId(option)}</span>
          </label>
        );
      })}
      </div>
    </fieldset>
  );
}
