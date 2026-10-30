import type { Character, LevelUpChoices } from '../types/dnd';
import { levelUpClassCastingData } from '../services/levelUpClassCasting';
import { classFreeCastingErrors } from '../services/castingSources';
import { CastingGrantChoices } from './CastingGrantChoices';
import styles from './CastingGrantChoices.module.css';

export function LevelUpClassCastingChoices({
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
  const data = levelUpClassCastingData(character, choices);
  return (
    <section>
      <CastingGrantChoices
        classFreeOnly
        data={data}
        onChange={(update) =>
          onChange({ castingSourcesChosen: update.additionalCastingSources })
        }
      />
      <div className={styles.actions}>
      <button type="button" className={styles.button} onClick={onPrev}>
        Back
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.primary}`}
        onClick={onNext}
        disabled={classFreeCastingErrors(data).length > 0}
      >
        Continue
      </button>
      </div>
    </section>
  );
}
