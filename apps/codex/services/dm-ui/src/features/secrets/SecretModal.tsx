import { useEffect, useState } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import X from 'lucide-react/dist/esm/icons/x';

import type { CampaignFixtureBundle, CampaignSecret } from '@/demo/fixture-registry';
import { MentionTextarea } from '@/features/mentions/MentionTextarea';

import { resolveAttachmentLabel } from './secretsModel';
import styles from './SecretModal.module.css';

export interface SecretModalProps {
  isOpen: boolean;
  initialSecret?: CampaignSecret | null;
  bundle: CampaignFixtureBundle;
  onClose: () => void;
  onSave: (secretData: {
    id?: string;
    text: string;
    attachedTo: Array<{ kind: string; id: string }>;
    revealed: boolean;
    revealedInSessionId?: string;
  }) => Promise<void> | void;
  isSaving?: boolean;
}

const ATTACHABLE_KINDS = [
  { value: 'npc', label: 'NPC' },
  { value: 'location', label: 'Location' },
  { value: 'quest', label: 'Quest' },
  { value: 'encounter', label: 'Encounter' },
  { value: 'item', label: 'Item' },
];

export function SecretModal({
  isOpen,
  initialSecret,
  bundle,
  onClose,
  onSave,
  isSaving = false,
}: SecretModalProps) {
  const [text, setText] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [revealedInSessionId, setRevealedInSessionId] = useState<string>('');
  const [attachedTo, setAttachedTo] = useState<Array<{ kind: string; id: string }>>([]);
  const [selectedKind, setSelectedKind] = useState<string>('npc');
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    () => bundle.npcs[0]?.id ?? '',
  );

  useEffect(() => {
    if (initialSecret) {
      setText(initialSecret.text);
      setRevealed(Boolean(initialSecret.revealed));
      setRevealedInSessionId(initialSecret.revealedInSessionId ?? '');
      setAttachedTo(initialSecret.attachedTo ?? []);
    } else {
      setText('');
      setRevealed(false);
      setRevealedInSessionId('');
      setAttachedTo([]);
    }
  }, [initialSecret, isOpen]);

  // Compute available entities for a kind
  const entitiesForKind = (kind: string): Array<{ id: string; label: string }> => {
    switch (kind) {
      case 'npc':
        return bundle.npcs.map((n) => ({ id: n.id, label: n.name }));
      case 'location':
        return bundle.locations.map((l) => ({ id: l.id, label: l.name }));
      case 'quest':
        return bundle.quests.map((q) => ({ id: q.id, label: q.title }));
      case 'encounter':
        return bundle.encounters.map((e) => ({ id: e.id, label: e.title }));
      case 'item':
        return (bundle.items ?? []).map((i) => ({ id: i.id, label: i.name }));
      default:
        return [];
    }
  };
  const availableEntities = entitiesForKind(selectedKind);

  // Keep selectedEntityId valid when kind changes
  const handleKindChange = (kind: string) => {
    setSelectedKind(kind);
    setSelectedEntityId(entitiesForKind(kind)[0]?.id ?? '');
  };

  if (!isOpen) return null;

  const handleAddAttachment = () => {
    if (!selectedEntityId) return;
    if (attachedTo.some((a) => a.kind === selectedKind && a.id === selectedEntityId)) {
      return;
    }
    setAttachedTo([...attachedTo, { kind: selectedKind, id: selectedEntityId }]);
  };

  const handleRemoveAttachment = (kind: string, id: string) => {
    setAttachedTo(attachedTo.filter((a) => !(a.kind === kind && a.id === id)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    onSave({
      id: initialSecret?.id,
      text: text.trim(),
      attachedTo,
      revealed,
      revealedInSessionId: revealedInSessionId ? revealedInSessionId : undefined,
    });
  };

  return (
    <div
      aria-label={initialSecret ? 'Edit secret modal' : 'New secret modal'}
      aria-modal="true"
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Sparkles size={16} aria-hidden="true" />
            {initialSecret ? 'Edit Secret / Clue' : 'New Secret / Clue'}
          </h2>
          <button
            aria-label="Close"
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label htmlFor="secret-text">Secret or Clue</label>
            <MentionTextarea
              id="secret-text"
              onChange={setText}
              placeholder="e.g. The mayor owes money to the Zhentarim... (type @ to link entities)"
              rows={4}
              value={text}
            />
            <p className={styles.fieldHint}>
              Supports markdown and @-mentions of NPCs, locations, and items.
            </p>
          </div>

          <div className={styles.fieldGroup}>
            <label>Attach to Entity</label>
            <div className={styles.attachRow}>
              <select
                aria-label="Attachment entity kind"
                className={styles.select}
                onChange={(e) => handleKindChange(e.target.value)}
                value={selectedKind}
              >
                {ATTACHABLE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Attachment entity"
                className={styles.select}
                disabled={availableEntities.length === 0}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                value={selectedEntityId}
              >
                {availableEntities.length === 0 ? (
                  <option value="">No entities available</option>
                ) : (
                  availableEntities.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.label}
                    </option>
                  ))
                )}
              </select>

              <button
                className={styles.addAttachBtn}
                disabled={!selectedEntityId}
                onClick={handleAddAttachment}
                type="button"
              >
                <Plus size={14} aria-hidden="true" />
                Attach
              </button>
            </div>

            {attachedTo.length > 0 ? (
              <ul aria-label="Attached entities list" className={styles.attachmentsList}>
                {attachedTo.map((att) => {
                  const label = resolveAttachmentLabel(bundle, att.kind, att.id);
                  return (
                    <li key={`${att.kind}-${att.id}`} className={styles.attachmentTag}>
                      <span>
                        [{att.kind}] {label}
                      </span>
                      <button
                        aria-label={`Remove attachment ${label}`}
                        className={styles.removeAttachBtn}
                        onClick={() => handleRemoveAttachment(att.kind, att.id)}
                        type="button"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="secret-session">Link to Session</label>
            <select
              id="secret-session"
              className={styles.select}
              onChange={(e) => setRevealedInSessionId(e.target.value)}
              value={revealedInSessionId}
            >
              <option value="">Not linked to a session</option>
              {bundle.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  Session {s.number}: {s.title}
                </option>
              ))}
            </select>
          </div>

          <label className={styles.checkboxRow}>
            <input
              checked={revealed}
              onChange={(e) => setRevealed(e.target.checked)}
              type="checkbox"
            />
            <span>Revealed to players</span>
          </label>

          <div className={styles.footer}>
            <button
              className={styles.cancelBtn}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              disabled={!text.trim() || isSaving}
              type="submit"
            >
              {isSaving ? 'Saving...' : initialSecret ? 'Save Changes' : 'Create Secret'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
