import { useEffect, useRef, useState } from 'react';
import Inbox from 'lucide-react/dist/esm/icons/inbox';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import X from 'lucide-react/dist/esm/icons/x';
import { useNavigate } from 'react-router-dom';

import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import { MentionTextarea } from '@/features/mentions/MentionTextarea';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import type { BundleStore } from '@/features/section-shell/bundleStore';

import {
  countUnfiled,
  triageToNoteDraft,
  triageToNpcDraft,
  triageToQuestDraft,
  triageToSecretDraft,
} from './inboxModel';
import styles from './QuickCaptureModal.module.css';

export type QuickCaptureTarget = 'inbox' | 'npc' | 'quest' | 'secret' | 'note';

export interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInbox?: () => void;
  bundleOverride?: CampaignFixtureBundle;
  storeOverride?: BundleStore;
}

export function QuickCaptureModal({
  isOpen,
  onClose,
  onOpenInbox,
  bundleOverride,
  storeOverride,
}: QuickCaptureModalProps) {
  const contextBundle = useSectionBundleSafe();
  const navigate = useNavigate();

  const bundle = bundleOverride ?? contextBundle?.bundle;
  const store = storeOverride ?? contextBundle?.store;
  const basePath = contextBundle?.basePath;

  const [text, setText] = useState('');
  const [target, setTarget] = useState<QuickCaptureTarget>('inbox');
  const [isSaving, setIsSaving] = useState(false);

  const textRef = useRef(text);
  textRef.current = text;
  const targetRef = useRef(target);
  targetRef.current = target;
  const isSavingRef = useRef(isSaving);
  isSavingRef.current = isSaving;
  const keyHandlersRef = useRef<{
    onClose: () => void;
    executeSave: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setText('');
    setTarget('inbox');
    setIsSaving(false);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        keyHandlersRef.current?.onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void keyHandlersRef.current?.executeSave();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const executeSave = async () => {
    const trimmed = textRef.current.trim();
    if (!trimmed || isSavingRef.current || !store || !store.editable) return;

    try {
      setIsSaving(true);
      const createdAt = new Date().toISOString();
      const currentTarget = targetRef.current;

      if (currentTarget === 'inbox') {
        await store.addItem('inbox-note', {
          text: trimmed,
          createdAt,
        });
      } else if (currentTarget === 'npc') {
        const draft = triageToNpcDraft(trimmed);
        const res = await store.addItem('npc', draft);
        await store.addItem('inbox-note', {
          text: trimmed,
          createdAt,
          triagedTo: { kind: 'npc', id: res.id ?? '' },
        });
      } else if (currentTarget === 'quest') {
        const draft = triageToQuestDraft(trimmed);
        const res = await store.addItem('quest', draft);
        await store.addItem('inbox-note', {
          text: trimmed,
          createdAt,
          triagedTo: { kind: 'quest', id: res.id ?? '' },
        });
      } else if (currentTarget === 'secret') {
        const draft = triageToSecretDraft(trimmed);
        const res = await store.addItem('secret', draft);
        await store.addItem('inbox-note', {
          text: trimmed,
          createdAt,
          triagedTo: { kind: 'secret', id: res.id ?? '' },
        });
      } else if (currentTarget === 'note') {
        const draft = triageToNoteDraft(trimmed);
        const res = await store.addItem('note', draft);
        await store.addItem('inbox-note', {
          text: trimmed,
          createdAt,
          triagedTo: { kind: 'note', id: res.id ?? '' },
        });
      }

      onClose();
    } finally {
      setIsSaving(false);
    }
  };
  keyHandlersRef.current = { onClose, executeSave };

  if (!isOpen) return null;

  const unfiledCount = countUnfiled(bundle?.inboxNotes ?? []);

  const handleOpenInbox = () => {
    onClose();
    if (onOpenInbox) {
      onOpenInbox();
    } else if (basePath) {
      navigate(`${basePath}/notes?tab=inbox`);
    }
  };

  const handleSave = () => executeSave();

  return (
    <div
      aria-labelledby="quick-capture-title"
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
            <h2 className={styles.title} id="quick-capture-title">
              <Inbox size={18} />
              Quick Capture
            </h2>
            {unfiledCount > 0 ? (
              <span className={styles.unfiledBadge}>
                {unfiledCount} unfiled
              </span>
            ) : null}
          </div>
          <button
            aria-label="Close"
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.fieldGroup}>
            <label htmlFor="quick-capture-text">Note</label>
            <MentionTextarea
              id="quick-capture-text"
              onChange={setText}
              placeholder="Capture an idea, secret, or quest lead... Use @ to link entities"
              rows={4}
              value={text}
            />
            <p className={styles.hint}>
              Tip: Mentioning @entities links them automatically. Type @ followed
              by a name to link or create on the fly.
            </p>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="quick-capture-target">Destination</label>
            <select
              className={styles.select}
              id="quick-capture-target"
              onChange={(e) => setTarget(e.target.value as QuickCaptureTarget)}
              value={target}
            >
              <option value="inbox">Save to Inbox (unfiled, triage later)</option>
              <option value="npc">Convert to NPC draft</option>
              <option value="quest">Convert to Quest draft</option>
              <option value="secret">Convert to Secret draft</option>
              <option value="note">Convert to General Note</option>
            </select>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.inboxLink}
            onClick={handleOpenInbox}
            type="button"
          >
            Open Inbox {unfiledCount > 0 ? `(${unfiledCount})` : ''}
          </button>

          <div className={styles.actions}>
            <button
              className={styles.cancelBtn}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              disabled={!text.trim() || isSaving || !store?.editable}
              onClick={() => void handleSave()}
              type="button"
            >
              <Sparkles size={14} />
              <span>{isSaving ? 'Saving…' : 'Capture'}</span>
              <span className={styles.shortcutHint}>Ctrl+Enter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to read SectionContext safely without throwing when unmounted outside a SectionRoute.
 */
function useSectionBundleSafe() {
  try {
    return useSectionBundle();
  } catch {
    return null;
  }
}
