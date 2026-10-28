import { useEffect, useId, useState } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus';
import Users from 'lucide-react/dist/esm/icons/users';
import X from 'lucide-react/dist/esm/icons/x';

import type {
  CampaignFixtureBundle,
  PlayerCharacter,
} from '@/demo/fixture-registry';
import type { BundleStore } from '@/features/section-shell/bundleStore';
import styles from './PartyMemberModal.module.css';

export interface PartyMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  character?: PlayerCharacter | null;
  bundle: CampaignFixtureBundle;
  store: BundleStore;
  initialMode?: 'create' | 'edit' | 'manage';
}

export function PartyMemberModal({
  isOpen,
  onClose,
  character,
  bundle,
  store,
  initialMode,
}: PartyMemberModalProps) {
  const titleId = useId();

  const [mode, setMode] = useState<'create' | 'edit' | 'manage'>(() => {
    if (initialMode) return initialMode;
    return character ? 'edit' : 'manage';
  });

  const [selectedCharacter, setSelectedCharacter] =
    useState<PlayerCharacter | null>(character ?? null);

  const [name, setName] = useState(character?.name ?? '');
  const [className, setClassName] = useState(character?.className ?? '');
  const [ancestry, setAncestry] = useState(character?.ancestry ?? '');
  const [level, setLevel] = useState<number>(character?.level ?? 1);
  const [hook, setHook] = useState(character?.hook ?? '');
  const [saving, setSaving] = useState(false);

  // Sync state when character or initialMode changes
  useEffect(() => {
    if (character) {
      setSelectedCharacter(character);
      setName(character.name);
      setClassName(character.className);
      setAncestry(character.ancestry);
      setLevel(character.level);
      setHook(character.hook);
      setMode(initialMode ?? 'edit');
    } else {
      setSelectedCharacter(null);
      setName('');
      setClassName('');
      setAncestry('');
      setLevel(1);
      setHook('');
      setMode(initialMode ?? 'manage');
    }
  }, [character, initialMode, isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleEditClick = (pc: PlayerCharacter) => {
    setSelectedCharacter(pc);
    setName(pc.name);
    setClassName(pc.className);
    setAncestry(pc.ancestry);
    setLevel(pc.level);
    setHook(pc.hook);
    setMode('edit');
  };

  const handleCreateClick = () => {
    setSelectedCharacter(null);
    setName('');
    setClassName('');
    setAncestry('');
    setLevel(1);
    setHook('');
    setMode('create');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (mode === 'create') {
        await store.addItem('party-member', {
          name: name.trim(),
          className: className.trim(),
          ancestry: ancestry.trim(),
          level: Math.max(1, Math.min(20, level)),
          hook: hook.trim(),
        });
      } else if (mode === 'edit' && selectedCharacter) {
        await store.updateItem('party-member', selectedCharacter.id, {
          name: name.trim(),
          className: className.trim(),
          ancestry: ancestry.trim(),
          level: Math.max(1, Math.min(20, level)),
          hook: hook.trim(),
        });
      }
      if (store.reload) {
        await store.reload();
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (pcId: string) => {
    setSaving(true);
    try {
      await store.removeItem('party-member', pcId);
      if (store.reload) {
        await store.reload();
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const partyMembers = bundle.campaign?.playerCharacters ?? [];

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Users aria-hidden="true" className={styles.titleIcon} size={20} />
            <h2 className={styles.title} id={titleId}>
              {mode === 'create'
                ? 'Add Party Member'
                : mode === 'edit'
                  ? `Edit Party Member: ${selectedCharacter?.name ?? ''}`
                  : 'Party Management'}
            </h2>
          </div>
          <button
            aria-label="Close party member modal"
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        {mode === 'manage' ? (
          <>
            <div className={styles.body}>
              <div className={styles.rosterHeader}>
                <span className={styles.rosterCount}>
                  {partyMembers.length} character
                  {partyMembers.length === 1 ? '' : 's'} in party
                </span>
                <button
                  className={styles.btnPrimary}
                  onClick={handleCreateClick}
                  type="button"
                >
                  <UserPlus aria-hidden="true" size={16} />
                  <span>Add Party Member</span>
                </button>
              </div>

              {partyMembers.length === 0 ? (
                <div className={styles.emptyRoster}>
                  No party members added yet. Add characters to calculate balance
                  and track party progress.
                </div>
              ) : (
                <div className={styles.memberList}>
                  {partyMembers.map((pc) => (
                    <div className={styles.memberCard} key={pc.id}>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{pc.name}</span>
                        <span className={styles.memberMeta}>
                          Level {pc.level} · {pc.ancestry} {pc.className}
                        </span>
                        {pc.hook && (
                          <span className={styles.memberHook}>{pc.hook}</span>
                        )}
                      </div>
                      <div className={styles.memberActions}>
                        <button
                          aria-label={`Edit ${pc.name}`}
                          className={styles.btnSecondary}
                          onClick={() => handleEditClick(pc)}
                          type="button"
                        >
                          <Edit2 aria-hidden="true" size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          aria-label={`Remove ${pc.name}`}
                          className={styles.btnDanger}
                          onClick={() => handleRemove(pc.id)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.footer}>
              <div className={styles.actionsRight}>
                <button
                  className={styles.btnSecondary}
                  onClick={onClose}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        ) : (
          <form className={styles.form} onSubmit={handleSave}>
            <div className={styles.body}>
              {partyMembers.length > 0 && (
                <button
                  className={styles.btnSecondary}
                  onClick={() => setMode('manage')}
                  style={{ alignSelf: 'flex-start', marginBottom: '0.25rem' }}
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" size={14} />
                  <span>Back to Party Roster</span>
                </button>
              )}

              <div className={styles.formGroup}>
                <label htmlFor="party-member-name">Character Name *</label>
                <input
                  className={styles.input}
                  id="party-member-name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Althea Nightbreeze"
                  required
                  type="text"
                  value={name}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="party-member-class">Class</label>
                  <input
                    className={styles.input}
                    id="party-member-class"
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g. Wizard"
                    type="text"
                    value={className}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="party-member-ancestry">Ancestry / Species</label>
                  <input
                    className={styles.input}
                    id="party-member-ancestry"
                    onChange={(e) => setAncestry(e.target.value)}
                    placeholder="e.g. Elf"
                    type="text"
                    value={ancestry}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="party-member-level">Level (1–20)</label>
                <input
                  className={styles.input}
                  id="party-member-level"
                  max={20}
                  min={1}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  type="number"
                  value={level}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="party-member-hook">Personal Hook / Background</label>
                <textarea
                  className={styles.textarea}
                  id="party-member-hook"
                  onChange={(e) => setHook(e.target.value)}
                  placeholder="e.g. Seeks vengeance against the Red Hand, or holds the key to the vault"
                  rows={3}
                  value={hook}
                />
              </div>
            </div>

            <div className={styles.footer}>
              {mode === 'edit' && selectedCharacter && (
                <button
                  className={styles.btnDanger}
                  disabled={saving}
                  onClick={() => handleRemove(selectedCharacter.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                  <span>Remove Member</span>
                </button>
              )}

              <div className={styles.actionsRight}>
                <button
                  className={styles.btnSecondary}
                  disabled={saving}
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={styles.btnPrimary}
                  disabled={saving || !name.trim()}
                  type="submit"
                >
                  <span>
                    {saving
                      ? 'Saving...'
                      : mode === 'create'
                        ? 'Add Member'
                        : 'Save Changes'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
