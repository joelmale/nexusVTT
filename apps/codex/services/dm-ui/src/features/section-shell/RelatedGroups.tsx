import {
  getBacklinks,
  resolveEntity,
  type EntityKind,
  type EntityRef,
} from '@/demo/fixture-registry';

import { EntityChip, EntityLink } from './EntityLink';
import { ENTITY_KIND_LABELS } from './entityMeta';
import styles from './RelatedGroups.module.css';
import { useSectionBundle } from './SectionContext';

const DEFAULT_ORDER: EntityKind[] = [
  'quest',
  'npc',
  'faction',
  'location',
  'encounter',
  'clue',
  'handout',
  'session',
  'map',
  'objective',
  'scene',
];

interface RelatedGroupsProps {
  /** The entity being shown; its backlinks are merged in. Omit for none. */
  entityId?: string;
  /** Ids the entity references directly (forward links). */
  forwardIds?: ReadonlyArray<string | undefined>;
  /** Kinds to show, in order. Defaults to every kind. */
  kinds?: EntityKind[];
  /** Kinds to hide. */
  exclude?: EntityKind[];
  heading?: string;
}

/**
 * Union of forward links and backlinks, deduplicated and grouped by kind under
 * `h3` headings. Unresolved forward ids appear under "Unresolved".
 */
export function RelatedGroups({
  entityId,
  forwardIds = [],
  kinds = DEFAULT_ORDER,
  exclude = [],
  heading,
}: RelatedGroupsProps) {
  const { bundle } = useSectionBundle();
  const seen = new Set<string>(entityId ? [entityId] : []);
  const byKind = new Map<EntityKind, EntityRef[]>();
  const unresolved: string[] = [];

  const add = (ref: EntityRef) => {
    if (seen.has(ref.id)) return;
    seen.add(ref.id);
    const list = byKind.get(ref.kind) ?? [];
    list.push(ref);
    byKind.set(ref.kind, list);
  };

  for (const id of forwardIds) {
    if (!id || seen.has(id)) continue;
    const ref = resolveEntity(bundle, id);
    if (ref) add(ref);
    else {
      seen.add(id);
      unresolved.push(id);
    }
  }
  if (entityId) for (const ref of getBacklinks(bundle, entityId)) add(ref);

  const groups = kinds.filter(
    (kind) => !exclude.includes(kind) && byKind.has(kind),
  );
  if (groups.length === 0 && unresolved.length === 0) return null;

  return (
    <section aria-label={heading ?? 'Related'} className={styles.related}>
      {heading ? <h3 className={styles.heading}>{heading}</h3> : null}
      {groups.map((kind) => (
        <div className={styles.group} key={kind}>
          <h3>{ENTITY_KIND_LABELS[kind]}</h3>
          <ul>
            {(byKind.get(kind) ?? []).map((ref) => (
              <li key={ref.id}>
                <EntityChip entity={ref} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {unresolved.length > 0 ? (
        <div className={styles.group}>
          <h3>Unresolved</h3>
          <ul>
            {unresolved.map((id) => (
              <li key={id}>
                <EntityLink id={id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
