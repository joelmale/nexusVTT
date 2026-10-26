import React, { useState } from 'react';
import type { AbilityKey, Character, Weapon } from '@nexus/character-contracts';
import type { RollMode } from '@/components/DiceRoller/useDiceRoll';
import {
  ABILITY_KEYS,
  abilityModifier,
  d20Expression,
  formatModifier,
  savingThrowBonus,
  weaponAttacks,
} from '@/utils/characterRolls';
import { SpellbookPanel } from '@/components/Panels/SpellbookPanel';
import styles from './MobileCharacterSheet.module.css';

export type SheetCard = 'combat' | 'skills' | 'gear' | 'spells';

export interface MobileCharacterSheetProps {
  character: Character | undefined;
  weapons: Weapon[];
  isMyTurn: boolean;
  onRoll: (expression: string, mode: RollMode, label: string) => void;
  onDeathSave: (result: 'success' | 'failure') => Promise<void>;
  onSelectCharacter: () => void;
}

const CARDS: Array<{ id: SheetCard; label: string }> = [
  { id: 'combat', label: 'Combat' },
  { id: 'skills', label: 'Skills & Saves' },
  { id: 'gear', label: 'Gear & Traits' },
  { id: 'spells', label: 'Spells' },
];

const ROLL_MODES: Array<{ id: RollMode; label: string }> = [
  { id: 'disadvantage', label: 'Disadvantage' },
  { id: 'none', label: 'Normal' },
  { id: 'advantage', label: 'Advantage' },
];

type ActionEconomy = { action: boolean; bonus: boolean; reaction: boolean };
const FRESH_TURN: ActionEconomy = {
  action: false,
  bonus: false,
  reaction: false,
};

function prettySlug(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Card-based character view for Simple Player Mode: big tap targets for the
 * rolls players make most, using the same modifier math as the full sheet.
 * Spells and slots arrive in a later phase.
 */
export const MobileCharacterSheet: React.FC<MobileCharacterSheetProps> = ({
  character,
  weapons,
  isMyTurn,
  onRoll,
  onDeathSave,
  onSelectCharacter,
}) => {
  const [card, setCard] = useState<SheetCard>('combat');
  const [mode, setMode] = useState<RollMode>('none');
  const [used, setUsed] = useState<ActionEconomy>(FRESH_TURN);
  const [prevMyTurn, setPrevMyTurn] = useState(isMyTurn);
  const [savingDeath, setSavingDeath] = useState(false);

  // Reset the action-economy checkboxes when a new turn starts.
  if (isMyTurn !== prevMyTurn) {
    setPrevMyTurn(isMyTurn);
    if (isMyTurn) setUsed(FRESH_TURN);
  }

  if (!character) {
    return (
      <section className={styles.empty}>
        <p>You haven't picked a character yet.</p>
        <button
          type="button"
          className={styles.cta}
          onClick={onSelectCharacter}
        >
          Select or Create Your Character
        </button>
      </section>
    );
  }

  const d20 = (bonus: number, label: string) =>
    onRoll(d20Expression(bonus), mode, label);
  const attacks = weaponAttacks(character, weapons);
  const deathSaves = character.deathSaves ?? { successes: 0, failures: 0 };

  const markDeathSave = (result: 'success' | 'failure') => {
    setSavingDeath(true);
    void onDeathSave(result).finally(() => setSavingDeath(false));
  };

  return (
    <section
      className={styles.sheet}
      aria-label={`${character.name} character sheet`}
    >
      <div className={styles.sticky}>
        <div
          className={styles.segmented}
          role="radiogroup"
          aria-label="Roll mode"
        >
          {ROLL_MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={mode === option.id}
              onClick={() => setMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Sheet sections">
          {CARDS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={card === option.id}
              onClick={() => setCard(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {card === 'combat' && (
        <div className={styles.cards} role="tabpanel" aria-label="Combat">
          {character.hitPoints === 0 && (
            <div className={styles.card} role="group" aria-label="Death saves">
              <h3>Death Saves</h3>
              <p>
                Successes {deathSaves.successes}/3 · Failures{' '}
                {deathSaves.failures}/3
              </p>
              <div className={styles.row}>
                <button
                  type="button"
                  onClick={() => onRoll('1d20', 'none', 'Death save')}
                >
                  Roll Death Save
                </button>
                <button
                  type="button"
                  disabled={savingDeath}
                  onClick={() => markDeathSave('success')}
                >
                  Mark Success
                </button>
                <button
                  type="button"
                  disabled={savingDeath}
                  onClick={() => markDeathSave('failure')}
                >
                  Mark Failure
                </button>
              </div>
            </div>
          )}

          <div className={styles.card} role="group" aria-label="This turn">
            <div className={styles.economy}>
              {(
                [
                  ['action', 'Action'],
                  ['bonus', 'Bonus Action'],
                  ['reaction', 'Reaction'],
                ] as Array<[keyof ActionEconomy, string]>
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={used[key]}
                    onChange={(e) =>
                      setUsed({ ...used, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="button"
              className={styles.link}
              onClick={() => setUsed(FRESH_TURN)}
            >
              Reset Turn
            </button>
          </div>

          <button
            type="button"
            className={styles.rollRow}
            onClick={() =>
              d20(
                character.initiative ?? abilityModifier(character, 'DEX'),
                'Initiative',
              )
            }
          >
            <span>Initiative</span>
            <span>
              {formatModifier(
                character.initiative ?? abilityModifier(character, 'DEX'),
              )}
            </span>
          </button>

          {attacks.length === 0 ? (
            <p className={styles.muted}>No equipped weapons.</p>
          ) : (
            attacks.map((attack) => (
              <div key={attack.id} className={styles.card}>
                <h3>{attack.name}</h3>
                <p className={styles.muted}>
                  {formatModifier(attack.toHit)} to hit · {attack.damage} damage
                </p>
                <div className={styles.row}>
                  <button
                    type="button"
                    aria-label={`Roll attack with ${attack.name}`}
                    onClick={() => d20(attack.toHit, `${attack.name} attack`)}
                  >
                    Roll Attack
                  </button>
                  <button
                    type="button"
                    aria-label={`Roll damage with ${attack.name}`}
                    onClick={() =>
                      onRoll(attack.damage, 'none', `${attack.name} damage`)
                    }
                  >
                    Roll Damage
                  </button>
                </div>
              </div>
            ))
          )}

          {character.spellcasting && (
            <div className={styles.badges} aria-label="Spellcasting">
              <span>Spell save DC {character.spellcasting.spellSaveDC}</span>
              <span>
                Spell attack{' '}
                {formatModifier(character.spellcasting.spellAttackBonus)}
              </span>
            </div>
          )}
        </div>
      )}

      {card === 'spells' && (
        <SpellbookPanel
          link={{ kind: 'spellbook', id: character.id, title: character.name }}
          onClose={() => setCard('combat')}
          isPopout={false}
        />
      )}

      {card === 'skills' && (
        <div
          className={styles.cards}
          role="tabpanel"
          aria-label="Skills & Saves"
        >
          <div className={styles.abilities}>
            {ABILITY_KEYS.map((ability: AbilityKey) => {
              const mod = abilityModifier(character, ability);
              const save = savingThrowBonus(character, ability);
              return (
                <div key={ability} className={styles.ability}>
                  <strong>{ability}</strong>
                  <span className={styles.score}>
                    {character.abilities[ability]?.score ?? 10}
                  </span>
                  <button
                    type="button"
                    aria-label={`${ability} check ${formatModifier(mod)}`}
                    onClick={() => d20(mod, `${ability} check`)}
                  >
                    Check {formatModifier(mod)}
                  </button>
                  <button
                    type="button"
                    aria-label={`${ability} save ${formatModifier(save)}`}
                    onClick={() => d20(save, `${ability} save`)}
                  >
                    Save {formatModifier(save)}
                  </button>
                </div>
              );
            })}
          </div>
          <ul className={styles.skills}>
            {Object.entries(character.skills ?? {}).map(([name, skill]) => (
              <li key={name}>
                <button
                  type="button"
                  className={styles.rollRow}
                  aria-label={`${name} ${formatModifier(skill.value)}`}
                  onClick={() => d20(skill.value, name)}
                >
                  <span>
                    {skill.proficient && (
                      <span
                        className={styles.prof}
                        aria-label={
                          skill.expertise ? 'Expertise' : 'Proficient'
                        }
                      >
                        {skill.expertise ? '◆' : '●'}
                      </span>
                    )}
                    {name}
                  </span>
                  <span>{formatModifier(skill.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {card === 'gear' && (
        <div
          className={styles.cards}
          role="tabpanel"
          aria-label="Gear & Traits"
        >
          <div className={styles.card}>
            <h3>Equipment</h3>
            {(character.inventory ?? []).length === 0 ? (
              <p className={styles.muted}>Nothing carried.</p>
            ) : (
              <ul className={styles.list}>
                {(character.inventory ?? []).map((item) => (
                  <li key={item.equipmentSlug}>
                    {item.name ?? prettySlug(item.equipmentSlug)}
                    {item.quantity > 1 && ` ×${item.quantity}`}
                    {item.equipped && (
                      <span className={styles.muted}> (equipped)</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {character.currency && (
            <div className={styles.card}>
              <h3>Coins</h3>
              <p>
                {character.currency.gp} GP · {character.currency.sp} SP ·{' '}
                {character.currency.cp} CP
              </p>
            </div>
          )}
          <div className={styles.card}>
            <h3>Features</h3>
            <ul className={styles.list}>
              {[
                ...(character.featuresAndTraits?.classFeatures ?? []),
                ...(character.featuresAndTraits?.racialTraits ?? []),
              ].map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
