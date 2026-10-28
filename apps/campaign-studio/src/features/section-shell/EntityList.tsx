import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import styles from './EntityList.module.css';

export interface EntityListGroup<T> {
  id: string;
  label?: string;
  items: T[];
}

interface EntityListProps<T> {
  /** Accessible name for the nav landmark, e.g. "NPC list". */
  ariaLabel: string;
  groups: EntityListGroup<T>[];
  getId: (item: T) => string;
  /** Path (relative to the router, already including basePath) for a row. */
  getHref: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  selectedId?: string;
}

/**
 * Grouped list of links in a `<nav>`. Selection is `aria-current="page"` on the
 * row link; the current query string (filters, sort) is carried onto each href.
 */
export function EntityList<T>({
  ariaLabel,
  groups,
  getId,
  getHref,
  renderRow,
  selectedId,
}: EntityListProps<T>) {
  const { search } = useLocation();
  return (
    <nav aria-label={ariaLabel} className={styles.list}>
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.id}>
            {group.label ? (
              <h3 className={styles.group}>{group.label}</h3>
            ) : null}
            <ul>
              {group.items.map((item) => {
                const id = getId(item);
                const selected = id === selectedId;
                return (
                  <li key={id}>
                    <Link
                      aria-current={selected ? 'page' : undefined}
                      className={`${styles.row} ${selected ? styles.selected : ''}`}
                      to={`${getHref(item)}${search}`}
                    >
                      {renderRow(item)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </nav>
  );
}
