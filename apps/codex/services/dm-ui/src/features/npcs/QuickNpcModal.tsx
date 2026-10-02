import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  generateRandomNpc,
  STAT_BLOCK_PRESETS,
  COMMON_OCCUPATIONS,
  type GeneratedNpc,
} from '@nexus/character-creator';
import Dices from 'lucide-react/dist/esm/icons/dices';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Unlock from 'lucide-react/dist/esm/icons/unlock';

import { useSectionBundle } from '@/features/section-shell/SectionContext';
import styles from './QuickNpcModal.module.css';

interface QuickNpcModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

type LockableField = 'name' | 'ancestry' | 'role' | 'motivation' | 'relationship' | 'alignment';

const COMMON_ANCESTRIES = [
  'Human',
  'Elf',
  'Dwarf',
  'Halfling',
  'Tiefling',
  'Dragonborn',
  'Gnome',
  'Half-Orc',
  'Half-Elf',
];

export function QuickNpcModal({ open, onClose, onCreated }: QuickNpcModalProps) {
  const { store } = useSectionBundle();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<GeneratedNpc>(() => generateRandomNpc());
  const [lockedFields, setLockedFields] = useState<Set<LockableField>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDraft(generateRandomNpc());
      setLockedFields(new Set());
      setError(undefined);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const toggleLock = (field: LockableField) => {
    setLockedFields((prev: Set<LockableField>) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const reroll = () => {
    const fresh = generateRandomNpc({
      ancestry: lockedFields.has('ancestry') ? draft.ancestry : undefined,
      role: lockedFields.has('role') ? draft.role : undefined,
      alignment: lockedFields.has('alignment') ? draft.alignment : undefined,
    });

    setDraft({
      name: lockedFields.has('name') ? draft.name : fresh.name,
      ancestry: lockedFields.has('ancestry') ? draft.ancestry : fresh.ancestry,
      role: lockedFields.has('role') ? draft.role : fresh.role,
      motivation: lockedFields.has('motivation') ? draft.motivation : fresh.motivation,
      relationship: lockedFields.has('relationship') ? draft.relationship : fresh.relationship,
      alignment: lockedFields.has('alignment') ? draft.alignment : fresh.alignment,
      tags: fresh.tags,
      personalityTraits: fresh.personalityTraits,
      statBlockRef: fresh.statBlockRef,
      combatSummary: fresh.combatSummary,
    });
  };

  const handlePresetChange = (presetKey: string) => {
    const preset = STAT_BLOCK_PRESETS[presetKey];
    if (preset) {
      setDraft((prev: GeneratedNpc) => ({
        ...prev,
        statBlockRef: preset.statBlockRef,
        combatSummary: preset.combatSummary,
      }));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError(undefined);

    const result = await store.addItem('npc', {
      name: draft.name.trim(),
      role: draft.role.trim(),
      ancestry: draft.ancestry.trim(),
      motivation: draft.motivation.trim(),
      relationship: draft.relationship.trim(),
      tags: draft.tags,
      factionIds: [],
      locationIds: [],
      sessionIds: [],
      statBlockRef: draft.statBlockRef,
      combatSummary: draft.combatSummary,
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to add NPC to campaign.');
      return;
    }

    if (result.id) {
      onCreated(result.id);
    }
    onClose();
  };

  return (
    <dialog
      className={styles.dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Quick Roll NPC</h2>
            <p className={styles.subtitle}>Procedurally generate a ready-to-run campaign NPC.</p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.rerollButton}
              onClick={reroll}
              title="Reroll unlocked fields"
              type="button"
            >
              <Dices size={16} />
              Roll Again
            </button>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.row}>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="npc-name">
                  Name
                </label>
                <button
                  className={`${styles.lockButton} ${lockedFields.has('name') ? styles.locked : ''}`}
                  onClick={() => toggleLock('name')}
                  title={lockedFields.has('name') ? 'Unlock Name' : 'Lock Name'}
                  type="button"
                >
                  {lockedFields.has('name') ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
              </div>
              <input
                className={styles.input}
                id="npc-name"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                value={draft.name}
              />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="npc-ancestry">
                  Ancestry
                </label>
                <button
                  className={`${styles.lockButton} ${lockedFields.has('ancestry') ? styles.locked : ''}`}
                  onClick={() => toggleLock('ancestry')}
                  title={lockedFields.has('ancestry') ? 'Unlock Ancestry' : 'Lock Ancestry'}
                  type="button"
                >
                  {lockedFields.has('ancestry') ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
              </div>
              <input
                className={styles.input}
                id="npc-ancestry"
                list="common-ancestries"
                onChange={(e) => setDraft({ ...draft, ancestry: e.target.value })}
                value={draft.ancestry}
              />
              <datalist id="common-ancestries">
                {COMMON_ANCESTRIES.map((anc) => (
                  <option key={anc} value={anc} />
                ))}
              </datalist>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="npc-role">
                  Role / Profession
                </label>
                <button
                  className={`${styles.lockButton} ${lockedFields.has('role') ? styles.locked : ''}`}
                  onClick={() => toggleLock('role')}
                  title={lockedFields.has('role') ? 'Unlock Role' : 'Lock Role'}
                  type="button"
                >
                  {lockedFields.has('role') ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
              </div>
              <input
                className={styles.input}
                id="npc-role"
                list="common-occupations"
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                value={draft.role}
              />
              <datalist id="common-occupations">
                {COMMON_OCCUPATIONS.map((occ: string) => (
                  <option key={occ} value={occ} />
                ))}
              </datalist>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="npc-alignment">
                  Alignment
                </label>
                <button
                  className={`${styles.lockButton} ${lockedFields.has('alignment') ? styles.locked : ''}`}
                  onClick={() => toggleLock('alignment')}
                  title={lockedFields.has('alignment') ? 'Unlock Alignment' : 'Lock Alignment'}
                  type="button"
                >
                  {lockedFields.has('alignment') ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
              </div>
              <input
                className={styles.input}
                id="npc-alignment"
                onChange={(e) => setDraft({ ...draft, alignment: e.target.value })}
                value={draft.alignment}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="npc-motivation">
                Current Motivation / Hook
              </label>
              <button
                className={`${styles.lockButton} ${lockedFields.has('motivation') ? styles.locked : ''}`}
                onClick={() => toggleLock('motivation')}
                title={lockedFields.has('motivation') ? 'Unlock Motivation' : 'Lock Motivation'}
                type="button"
              >
                {lockedFields.has('motivation') ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
            <textarea
              className={styles.textarea}
              id="npc-motivation"
              onChange={(e) => setDraft({ ...draft, motivation: e.target.value })}
              rows={2}
              value={draft.motivation}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="npc-relationship">
                Attitude Toward Party
              </label>
              <button
                className={`${styles.lockButton} ${lockedFields.has('relationship') ? styles.locked : ''}`}
                onClick={() => toggleLock('relationship')}
                title={lockedFields.has('relationship') ? 'Unlock Attitude' : 'Lock Attitude'}
                type="button"
              >
                {lockedFields.has('relationship') ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
            <textarea
              className={styles.textarea}
              id="npc-relationship"
              onChange={(e) => setDraft({ ...draft, relationship: e.target.value })}
              rows={2}
              value={draft.relationship}
            />
          </div>

          <div className={styles.combatBox}>
            <div className={styles.labelRow}>
              <span className={styles.label}>Combat & Defense Baseline</span>
              <select
                aria-label="Combat & Defense Baseline"
                className={styles.select}
                onChange={(e) => handlePresetChange(e.target.value)}
                value={draft.statBlockRef?.slug || 'commoner'}
              >
                <option value="commoner">Commoner (CR 0)</option>
                <option value="guard">Town Guard (CR 1/8)</option>
                <option value="bandit">Bandit (CR 1/8)</option>
                <option value="noble">Noble (CR 1/8)</option>
                <option value="acolyte">Acolyte (CR 1/4)</option>
                <option value="scout">Scout (CR 1/2)</option>
                <option value="veteran">Veteran (CR 3)</option>
                <option value="mage">Mage (CR 6)</option>
              </select>
            </div>
            <div className={styles.combatBadges}>
              <span className={styles.badge}>HP: {draft.combatSummary?.hp ?? 10}</span>
              <span className={styles.badge}>AC: {draft.combatSummary?.ac ?? 10}</span>
              <span className={styles.badge}>CR: {draft.combatSummary?.cr ?? '0'}</span>
              <span className={styles.badge}>Ref: {draft.statBlockRef?.slug ?? 'commoner'}</span>
            </div>
          </div>

          {error ? <p className={styles.errorNotice}>{error}</p> : null}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} disabled={busy} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={styles.submitButton} disabled={busy} type="submit">
            {busy ? 'Adding…' : 'Add to Campaign'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
