import { Link } from 'react-router-dom';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Check from 'lucide-react/dist/esm/icons/check';
import Edit3 from 'lucide-react/dist/esm/icons/edit-3';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';

import {
  resolveEntity,
  type CampaignFixtureBundle,
  type CampaignSecret,
} from '@/demo/fixture-registry';
import { MentionText } from '@/features/mentions/MentionText';
import { ENTITY_ICONS } from '@/features/section-shell/entityMeta';
import { UseInNextSessionButton } from '@/features/section-shell/UseInNextSessionButton';

import { resolveAttachmentLabel } from './secretsModel';
import styles from './SecretRow.module.css';

export interface SecretRowProps {
  secret: CampaignSecret;
  bundle: CampaignFixtureBundle;
  basePath: string;
  editable?: boolean;
  onToggleRevealed?: (secret: CampaignSecret) => void;
  onEdit?: (secret: CampaignSecret) => void;
  onDelete?: (secret: CampaignSecret) => void;
}

export function SecretRow({
  secret,
  bundle,
  basePath,
  editable = false,
  onToggleRevealed,
  onEdit,
  onDelete,
}: SecretRowProps) {
  const session = secret.revealedInSessionId
    ? bundle.sessions.find((s) => s.id === secret.revealedInSessionId)
    : undefined;

  return (
    <article
      className={`${styles.row} ${secret.revealed ? styles.revealed : styles.unrevealed}`}
      data-testid={`secret-row-${secret.id}`}
    >
      <div className={styles.topRow}>
        <div className={styles.contentArea}>
          {editable && onToggleRevealed ? (
            <button
              aria-label={
                secret.revealed
                  ? 'Mark secret as unrevealed'
                  : 'Mark secret as revealed'
              }
              className={`${styles.toggleBtn} ${secret.revealed ? styles.toggleBtnRevealed : ''}`}
              onClick={() => onToggleRevealed(secret)}
              title={
                secret.revealed
                  ? 'Click to mark as unrevealed'
                  : 'Click to mark as revealed'
              }
              type="button"
            >
              {secret.revealed ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <EyeOff size={14} aria-hidden="true" />
              )}
            </button>
          ) : (
            <span
              className={`${styles.toggleBtn} ${secret.revealed ? styles.toggleBtnRevealed : ''}`}
            >
              {secret.revealed ? (
                <Eye size={14} aria-hidden="true" />
              ) : (
                <EyeOff size={14} aria-hidden="true" />
              )}
            </span>
          )}

          <div className={styles.secretText}>
            <MentionText text={secret.text} />
          </div>
        </div>

        <div className={styles.actions}>
          <UseInNextSessionButton kind="secret" id={secret.id} size="sm" />
          {editable && onEdit ? (
            <button
              aria-label="Edit secret"
              className={styles.actionBtn}
              onClick={() => onEdit(secret)}
              title="Edit secret"
              type="button"
            >
              <Edit3 size={13} aria-hidden="true" />
            </button>
          ) : null}
          {editable && onDelete ? (
            <button
              aria-label="Delete secret"
              className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
              onClick={() => onDelete(secret)}
              title="Delete secret"
              type="button"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.metaRow}>
        <span
          className={`${styles.statusPill} ${secret.revealed ? styles.statusPillRevealed : styles.statusPillUnrevealed}`}
        >
          {secret.revealed ? 'Revealed' : 'Unrevealed'}
        </span>

        {session ? (
          <span className={styles.sessionPill}>
            <Calendar size={11} aria-hidden="true" />
            <span>
              Session {session.number} ({session.title})
            </span>
          </span>
        ) : null}

        {secret.attachedTo && secret.attachedTo.length > 0 ? (
          <ul aria-label="Attached entities" className={styles.attachmentList}>
            {secret.attachedTo.map((att) => {
              const ref = resolveEntity(bundle, att.id);
              const label = resolveAttachmentLabel(bundle, att.kind, att.id);
              const KindIcon = ENTITY_ICONS[att.kind as keyof typeof ENTITY_ICONS];

              const body = (
                <>
                  {KindIcon ? <KindIcon size={11} aria-hidden="true" /> : null}
                  <span>{label}</span>
                </>
              );

              return (
                <li key={`${att.kind}-${att.id}`}>
                  {ref?.href ? (
                    <Link
                      className={styles.attachmentChip}
                      to={`${basePath}${ref.href}`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <span className={styles.attachmentChip}>{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
