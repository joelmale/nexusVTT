import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { humanize } from '@/features/section-shell/statusTones';

import styles from './World.module.css';
import { locationCounts, type LocationRow } from './worldModels';

interface LocationTreeProps {
  rows: LocationRow[];
  selectedId?: string;
  nextSessionIds: ReadonlySet<string>;
  hrefFor: (id: string) => string;
  onToggle: (id: string, open: boolean) => void;
}

function RowMeta({
  row,
  nextSessionIds,
}: {
  row: LocationRow;
  nextSessionIds: ReadonlySet<string>;
}) {
  const counts = locationCounts(row.location);
  return (
    <span className={styles.meta}>
      <span>{humanize(row.location.type)}</span>
      {counts.npcs > 0 ? (
        <span>
          {counts.npcs} {counts.npcs === 1 ? 'NPC' : 'NPCs'}
        </span>
      ) : null}
      {counts.encounters > 0 ? (
        <span>
          {counts.encounters}{' '}
          {counts.encounters === 1 ? 'encounter' : 'encounters'}
        </span>
      ) : null}
      {nextSessionIds.has(row.location.id) ? (
        <span className={styles.chip}>Next session</span>
      ) : null}
    </span>
  );
}

/** WAI-ARIA tree of locations with arrow-key navigation (roving tabindex). */
export function LocationTree({
  rows,
  selectedId,
  nextSessionIds,
  hrefFor,
  onToggle,
}: LocationTreeProps) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [focusId, setFocusId] = useState<string>();
  const items = useRef(new Map<string, HTMLLIElement>());

  const tabbable =
    rows.find((row) => row.location.id === focusId)?.location.id ??
    rows.find((row) => row.location.id === selectedId)?.location.id ??
    rows[0]?.location.id;

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    items.current.get(id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (event.target !== event.currentTarget) return;
    const index = rows.findIndex((row) => row.location.id === id);
    const row = rows[index];
    if (!row) return;
    switch (event.key) {
      case 'ArrowDown':
        focusRow(rows[index + 1]?.location.id);
        break;
      case 'ArrowUp':
        focusRow(rows[index - 1]?.location.id);
        break;
      case 'Home':
        focusRow(rows[0]?.location.id);
        break;
      case 'End':
        focusRow(rows[rows.length - 1]?.location.id);
        break;
      case 'ArrowRight':
        if (row.hasChildren && !row.expanded) onToggle(id, true);
        else if (row.expanded) focusRow(rows[index + 1]?.location.id);
        break;
      case 'ArrowLeft':
        if (row.expanded) onToggle(id, false);
        else focusRow(row.parentId);
        break;
      case 'Enter':
      case ' ':
        navigate(`${hrefFor(id)}${search}`);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <ul aria-label="Location tree" className={styles.tree} role="tree">
      {rows.map((row) => {
        const id = row.location.id;
        const selected = id === selectedId;
        return (
          <li
            aria-expanded={row.hasChildren ? row.expanded : undefined}
            aria-level={row.level}
            aria-posinset={row.position}
            aria-selected={selected}
            aria-setsize={row.siblings}
            className={`${styles.item} ${selected ? styles.selected : ''}`}
            key={id}
            onFocus={(event) => {
              if (event.target === event.currentTarget) setFocusId(id);
            }}
            onKeyDown={(event) => onKeyDown(event, id)}
            ref={(node) => {
              if (node) items.current.set(id, node);
              else items.current.delete(id);
            }}
            role="treeitem"
            style={{ ['--level' as string]: row.level }}
            tabIndex={id === tabbable ? 0 : -1}
          >
            {row.hasChildren ? (
              <span
                aria-hidden="true"
                className={`${styles.chevron} ${row.expanded ? styles.chevronOpen : ''}`}
                data-testid={`toggle-${id}`}
                onClick={() => onToggle(id, !row.expanded)}
              >
                <ChevronRight size={16} />
              </span>
            ) : (
              <span aria-hidden="true" className={styles.chevronSpacer} />
            )}
            <Link
              aria-current={selected ? 'page' : undefined}
              className={styles.link}
              tabIndex={-1}
              to={`${hrefFor(id)}${search}`}
            >
              <span className={styles.name}>{row.location.name}</span>
              <RowMeta nextSessionIds={nextSessionIds} row={row} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface FlatEntry {
  row: LocationRow;
  breadcrumb: string[];
}

/** Flat search-result list; each row shows its parent breadcrumb. */
export function LocationResults({
  entries,
  selectedId,
  nextSessionIds,
  hrefFor,
}: {
  entries: FlatEntry[];
  selectedId?: string;
  nextSessionIds: ReadonlySet<string>;
  hrefFor: (id: string) => string;
}) {
  const { search } = useLocation();
  return (
    <nav aria-label="Location results">
      <ul className={styles.tree}>
        {entries.map(({ row, breadcrumb }) => {
          const id = row.location.id;
          const selected = id === selectedId;
          return (
            <li
              className={`${styles.item} ${selected ? styles.selected : ''}`}
              key={id}
            >
              <Link
                aria-current={selected ? 'page' : undefined}
                className={styles.link}
                to={`${hrefFor(id)}${search}`}
              >
                <span className={styles.name}>{row.location.name}</span>
                {breadcrumb.length > 0 ? (
                  <span className={styles.crumb}>{breadcrumb.join(' › ')}</span>
                ) : null}
                <RowMeta nextSessionIds={nextSessionIds} row={row} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
