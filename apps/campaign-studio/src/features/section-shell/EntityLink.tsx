import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import { Link } from 'react-router-dom';

import { resolveEntity, type EntityRef } from '@/demo/fixture-registry';

import { ENTITY_ICONS } from './entityMeta';
import styles from './EntityLink.module.css';
import { useSectionBundle } from './SectionContext';

interface EntityChipProps {
  entity: EntityRef;
  /** Overrides the entity's own label. */
  label?: string;
}

/** Chip for an already-resolved entity reference. */
export function EntityChip({ entity, label }: EntityChipProps) {
  const { basePath } = useSectionBundle();
  const Icon = ENTITY_ICONS[entity.kind] ?? BookOpen;
  const content = (
    <>
      <Icon aria-hidden="true" size={14} />
      <span>{label ?? entity.label}</span>
    </>
  );
  if (!entity.href) {
    return <span className={styles.chip}>{content}</span>;
  }
  return (
    <Link
      className={`${styles.chip} ${styles.link}`}
      to={`${basePath}${entity.href}`}
    >
      {content}
    </Link>
  );
}

interface EntityLinkProps {
  id: string;
  label?: string;
}

/**
 * Resolves an id through the entity index and renders a link chip. An id that
 * does not resolve renders a muted, non-link "Missing reference" and never
 * throws.
 */
export function EntityLink({ id, label }: EntityLinkProps) {
  const { bundle } = useSectionBundle();
  const entity = resolveEntity(bundle, id);
  if (!entity) {
    return (
      <span
        className={`${styles.chip} ${styles.missing}`}
        data-missing-id={id}
        title={`No entity with id ${id}`}
      >
        Missing reference
      </span>
    );
  }
  return <EntityChip entity={entity} label={label} />;
}
