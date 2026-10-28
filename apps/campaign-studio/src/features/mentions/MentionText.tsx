import type { ReactNode } from 'react';

import { resolveEntity } from '@/demo/fixture-registry';
import { EntityLink } from '@/features/section-shell/EntityLink';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { splitMentions } from '@/lib/mentions';

import styles from './MentionText.module.css';

/**
 * One mention. Resolves the id to the target's current title, so a rename
 * shows everywhere; a target that is gone shows the label it had when typed.
 */
export function MentionChip({ id, label }: { id: string; label: string }) {
  const { bundle } = useSectionBundle();
  if (!resolveEntity(bundle, id)) {
    return (
      <span
        className={styles.missing}
        data-missing-id={id}
        title="This item no longer exists in the campaign"
      >
        Missing: {label}
      </span>
    );
  }
  return <EntityLink id={id} />;
}

/** Plain text with its mentions rendered as links. */
export function MentionText({ text }: { text: string }) {
  const parts: ReactNode[] = splitMentions(text).map((segment, index) =>
    segment.type === 'text' ? (
      segment.text
    ) : (
      <MentionChip id={segment.id} key={index} label={segment.label} />
    ),
  );
  return <>{parts}</>;
}
