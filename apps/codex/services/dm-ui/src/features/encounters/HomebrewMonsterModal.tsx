import { useEffect, useState, type FormEvent } from 'react';
import X from 'lucide-react/dist/esm/icons/x';

import type { HomebrewMonster } from '@/demo/fixture-registry';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import styles from './HomebrewMonsterModal.module.css';
import {
  ABILITY_NAMES,
  CR_OPTIONS,
  formatModifier,
  MONSTER_SIZES,
  MONSTER_TYPES,
  xpForCr,
} from './homebrewModel';
import type { CatalogMonster } from './monsterCatalog';

export interface HomebrewMonsterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonster?: Partial<CatalogMonster> | Partial<HomebrewMonster>;
  onSaved?: (monster: HomebrewMonster) => void;
}

export function HomebrewMonsterModal({
  isOpen,
  onClose,
  initialMonster,
  onSaved,
}: HomebrewMonsterModalProps) {
  const { store, bundle } = useSectionBundle();

  const isEditing = Boolean(initialMonster && 'id' in initialMonster && initialMonster.id);

  const [name, setName] = useState('');
  const [cr, setCr] = useState('1');
  const [size, setSize] = useState('Medium');
  const [type, setType] = useState('humanoid');
  const [ac, setAc] = useState(12);
  const [hp, setHp] = useState(20);
  const [speed, setSpeed] = useState(30);
  const [edition, setEdition] = useState<'2024' | '2014'>('2024');
  const [abilities, setAbilities] = useState<number[]>([10, 10, 10, 10, 10, 10]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isOpen) return;

    if (initialMonster) {
      setName(initialMonster.name || '');
      setCr(initialMonster.cr || '1');
      setSize(initialMonster.size || 'Medium');
      setType(initialMonster.type || 'humanoid');
      setAc(typeof initialMonster.ac === 'number' ? initialMonster.ac : 12);
      setHp(typeof initialMonster.hp === 'number' ? initialMonster.hp : 20);
      setSpeed(typeof initialMonster.speed === 'number' ? initialMonster.speed : 30);
      setEdition(initialMonster.edition === '2014' ? '2014' : '2024');
      setAbilities(
        initialMonster.abilities && initialMonster.abilities.length === 6
          ? [...initialMonster.abilities]
          : [10, 10, 10, 10, 10, 10],
      );
      setNotes((initialMonster as HomebrewMonster).notes || '');
    } else {
      setName('');
      setCr('1');
      setSize('Medium');
      setType('humanoid');
      setAc(12);
      setHp(20);
      setSpeed(30);
      setEdition('2024');
      setAbilities([10, 10, 10, 10, 10, 10]);
      setNotes('');
    }
    setError(undefined);
    setBusy(false);
  }, [isOpen, initialMonster]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a name for this creature.');
      return;
    }

    setBusy(true);
    setError(undefined);

    const monsterData: Omit<HomebrewMonster, 'id' | 'campaignId'> = {
      name: trimmedName,
      cr: cr.trim() || '1',
      size,
      type,
      ac: Number(ac) || 10,
      hp: Math.max(1, Number(hp) || 1),
      speed: Math.max(0, Number(speed) || 0),
      abilities: abilities.map((val) => Math.max(1, Math.min(30, Number(val) || 10))) as HomebrewMonster['abilities'],
      edition,
      notes,
    };

    try {
      const monsterId =
        initialMonster && 'id' in initialMonster
          ? (initialMonster.id as string | undefined)
          : undefined;
      if (isEditing && monsterId) {
        const id = monsterId;
        const result = await store.updateItem('homebrew-monster', id, monsterData);
        if (!result.ok) {
          setError(result.error ?? 'Failed to update creature.');
          setBusy(false);
          return;
        }
        const updatedMonster: HomebrewMonster = {
          id,
          campaignId: bundle.campaignId,
          ...monsterData,
        };
        onSaved?.(updatedMonster);
      } else {
        const result = await store.addItem('homebrew-monster', monsterData);
        if (!result.ok || !result.id) {
          setError(result.error ?? 'Failed to create creature.');
          setBusy(false);
          return;
        }
        const newMonster: HomebrewMonster = {
          id: result.id,
          campaignId: bundle.campaignId,
          ...monsterData,
        };
        onSaved?.(newMonster);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setBusy(false);
    }
  };

  const handleAbilityChange = (index: number, val: string) => {
    const numVal = parseInt(val, 10);
    const valid = Number.isNaN(numVal) ? 10 : numVal;
    setAbilities((prev) => {
      const copy = [...prev];
      copy[index] = valid;
      return copy;
    });
  };

  return (
    <div
      aria-label="Creature Stat Block Modal"
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-labelledby="homebrew-modal-title"
        aria-modal="true"
        className={styles.modal}
        role="dialog"
      >
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <h2 className={styles.title} id="homebrew-modal-title">
              {isEditing ? 'Edit Homebrew Creature' : 'Author Homebrew Creature'}
            </h2>
            <span className={styles.subtitle}>
              Custom 5e statblock for encounters and challenge rating math
            </span>
          </div>
          <button
            aria-label="Close creature modal"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error ? (
            <p className={styles.errorBanner} role="alert">
              {error}
            </p>
          ) : null}

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Identity & Ruleset</legend>
            <div className={styles.row}>
              <label className={styles.field} style={{ flex: 2 }}>
                Creature Name
                <input
                  aria-label="Creature Name"
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ash Drake, Gloom Goblin"
                  value={name}
                />
              </label>
              <label className={styles.field}>
                Rules Edition
                <select
                  aria-label="Rules Edition"
                  onChange={(e) => setEdition(e.target.value as '2024' | '2014')}
                  value={edition}
                >
                  <option value="2024">2024 Rules</option>
                  <option value="2014">2014 (Legacy)</option>
                </select>
              </label>
            </div>

            <div className={styles.row}>
              <label className={styles.field}>
                Challenge Rating (CR)
                <select
                  aria-label="Challenge Rating"
                  onChange={(e) => setCr(e.target.value)}
                  value={cr}
                >
                  {CR_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      CR {opt} ({xpForCr(opt).toLocaleString()} XP)
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Size
                <select
                  aria-label="Creature Size"
                  onChange={(e) => setSize(e.target.value)}
                  value={size}
                >
                  {MONSTER_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Creature Type
                <select
                  aria-label="Creature Type"
                  onChange={(e) => setType(e.target.value)}
                  value={type}
                >
                  {MONSTER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Combat Statistics</legend>
            <div className={styles.row}>
              <label className={styles.field}>
                Armor Class (AC)
                <input
                  aria-label="Armor Class"
                  min={1}
                  onChange={(e) => setAc(Number(e.target.value))}
                  type="number"
                  value={ac}
                />
              </label>
              <label className={styles.field}>
                Hit Points (HP)
                <input
                  aria-label="Hit Points"
                  min={1}
                  onChange={(e) => setHp(Number(e.target.value))}
                  type="number"
                  value={hp}
                />
              </label>
              <label className={styles.field}>
                Speed (ft)
                <input
                  aria-label="Speed in feet"
                  min={0}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  type="number"
                  value={speed}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Ability Scores</legend>
            <div className={styles.abilitiesGrid}>
              {ABILITY_NAMES.map((abi, idx) => {
                const score = abilities[idx] ?? 10;
                return (
                  <div className={styles.abilityCard} key={abi}>
                    <span className={styles.abilityLabel}>{abi}</span>
                    <input
                      aria-label={`${abi} score`}
                      className={styles.abilityInput}
                      max={30}
                      min={1}
                      onChange={(e) => handleAbilityChange(idx, e.target.value)}
                      type="number"
                      value={score}
                    />
                    <span className={styles.abilityModifier}>
                      {formatModifier(score)}
                    </span>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Traits, Actions & Notes</legend>
            <label className={styles.field}>
              <span className={styles.subtitle}>
                Describe special traits, multiattacks, actions, bonus actions, and lore.
              </span>
              <textarea
                aria-label="Traits, Actions & Notes"
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Multiattack: Makes two claw attacks (+5 to hit, 2d6+3 slashing).&#10;Shadow Camouflage: Advantage on Stealth checks in dim light or darkness."
                rows={5}
                value={notes}
              />
            </label>
          </fieldset>

          <footer className={styles.footer}>
            <button
              className={styles.cancelButton}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.submitButton}
              disabled={busy}
              type="submit"
            >
              {busy ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Creature'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
