import type { Character, LevelUpChoices } from '../types/dnd';
import { masteryCount, masteryOptions } from '../services/classGrantChoices';
import { levelUpGrantErrors } from '../services/levelUpClassGrants';
import { choiceId } from '../services/originChoices';
import styles from './CastingGrantChoices.module.css';

/**
 * Weapon Mastery picks while leveling up (SRD 5.2.1). The list is the complete
 * new selection; a character may keep, drop or swap earlier weapons.
 */
export function LevelUpWeaponMasteryChoices({
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
  const classSlug = character.classSlug || character.class.toLowerCase();
  const count = masteryCount({
    edition: character.edition,
    classSlug,
    level: toLevel,
  });
  const options = masteryOptions({ edition: character.edition, classSlug });
  const selected =
    choices.weaponMasteriesChosen ?? character.weaponMastery ?? [];
  const isChosen = (name: string) =>
    selected.some((value) => choiceId(value) === choiceId(name));
  const errors = levelUpGrantErrors(
    character,
    { ...choices, weaponMasteriesChosen: selected },
    toLevel,
  );

  return (
    <section className={styles.grants}>
      <h3>Choose {count} Weapon Mastery weapons</h3>
      <p>
        You have chosen {selected.length} of {count}. You can keep your earlier
        weapons or swap them.
      </p>
      {options.map((weapon) => (
        <label key={weapon.slug}>
          <input
            type="checkbox"
            checked={isChosen(weapon.name)}
            disabled={!isChosen(weapon.name) && selected.length >= count}
            onChange={() =>
              onChange({
                weaponMasteriesChosen: isChosen(weapon.name)
                  ? selected.filter(
                      (value) => choiceId(value) !== choiceId(weapon.name),
                    )
                  : [...selected, weapon.name],
              })
            }
          />
          {weapon.name}
        </label>
      ))}
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onPrev}>
        Back
      </button>
      <button type="button" disabled={errors.length > 0} onClick={onNext}>
        Continue
      </button>
    </section>
  );
}
