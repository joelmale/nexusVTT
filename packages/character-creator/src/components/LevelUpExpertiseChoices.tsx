import type { Character, LevelUpChoices } from '../types/dnd';
import {
  levelUpExpertise,
  levelUpExpertiseErrors,
} from '../services/levelUpExpertise';
import styles from './CastingGrantChoices.module.css';

export function LevelUpExpertiseChoices({
  character,
  choices,
  onChange,
  onNext,
  onPrev,
}: {
  character: Character;
  choices: LevelUpChoices;
  onChange: (choices: Partial<LevelUpChoices>) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const { count, options } = levelUpExpertise(character);
  const selected = choices.expertiseChosen ?? [];
  return (
    <section className={styles.grants}>
      <h3>Choose {count} new Expertise proficiencies</h3>
      <p>
        Existing Expertise is retained. Choose additional proficient skills for
        this level.
      </p>
      {options.map((name) => (
        <label key={name}>
          <input
            type="checkbox"
            checked={selected.includes(name)}
            onChange={() =>
              onChange({
                expertiseChosen: selected.includes(name)
                  ? selected.filter((value) => value !== name)
                  : [...selected, name],
              })
            }
          />
          {name}
        </label>
      ))}
      <button type="button" onClick={onPrev}>
        Back
      </button>
      <button
        type="button"
        disabled={levelUpExpertiseErrors(character, selected).length > 0}
        onClick={onNext}
      >
        Continue
      </button>
    </section>
  );
}
