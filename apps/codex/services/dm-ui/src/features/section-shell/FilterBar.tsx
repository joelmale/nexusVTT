import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import styles from './FilterBar.module.css';
import { useSectionQuery } from './useSectionQuery';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterFacet {
  /** Query-string key, e.g. `status`. */
  key: string;
  label: string;
  options: FilterOption[];
  allLabel?: string;
}

interface FilterBarProps {
  /** Accessible label for the search box, e.g. "Search NPCs". */
  searchLabel: string;
  facets?: FilterFacet[];
  sortOptions?: FilterOption[];
  groupByOptions?: FilterOption[];
  groupByKey?: string;
  extraActions?: ReactNode;
  /** Number of rows after filtering; announced politely. */
  resultCount: number;
  singular: string;
  plural: string;
  /** Enable active filter chips below the bar. Defaults to true. */
  showChips?: boolean;
}

/** Search + facet selects + sort + group by, bound to query params. */
export function FilterBar({
  searchLabel,
  facets = [],
  sortOptions,
  groupByOptions,
  groupByKey = 'group',
  extraActions,
  resultCount,
  singular,
  plural,
  showChips = true,
}: FilterBarProps) {
  const { get, set, clear } = useSectionQuery();
  const id = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const queryParam = get('q');
  const [localSearch, setLocalSearch] = useState(queryParam);

  // Sync local search when URL changes externally
  useEffect(() => {
    setLocalSearch(queryParam);
  }, [queryParam]);

  // Global `/` shortcut to focus search input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Collect active filter chips
  const activeChips: Array<{ key: string; label: string; valueLabel: string }> = [];

  for (const facet of facets) {
    const val = get(facet.key);
    if (val) {
      const match = facet.options.find((o) => o.value === val);
      activeChips.push({
        key: facet.key,
        label: facet.label,
        valueLabel: match ? match.label : val,
      });
    }
  }

  const handleClearAll = () => {
    clear();
    setLocalSearch('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.bar} role="search">
        <div className={styles.field}>
          <label className={styles.srOnly} htmlFor={`${id}-q`}>
            {searchLabel}
          </label>
          <input
            className={styles.search}
            id={`${id}-q`}
            onChange={(event) => {
              setLocalSearch(event.target.value);
              set('q', event.target.value);
            }}
            placeholder={`${searchLabel} (Press '/' to focus)`}
            ref={searchInputRef}
            type="search"
            value={localSearch}
          />
        </div>

        {facets.map((facet) => (
          <div className={styles.field} key={facet.key}>
            <label htmlFor={`${id}-${facet.key}`}>{facet.label}</label>
            <select
              id={`${id}-${facet.key}`}
              onChange={(event) => set(facet.key, event.target.value)}
              value={get(facet.key)}
            >
              <option value="">{facet.allLabel ?? 'All'}</option>
              {facet.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.count !== undefined ? ` (${option.count})` : ''}
                </option>
              ))}
            </select>
          </div>
        ))}

        {groupByOptions?.length ? (
          <div className={styles.field}>
            <label htmlFor={`${id}-${groupByKey}`}>Group by</label>
            <select
              id={`${id}-${groupByKey}`}
              onChange={(event) => set(groupByKey, event.target.value)}
              value={get(groupByKey) || groupByOptions[0].value}
            >
              {groupByOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {sortOptions?.length ? (
          <div className={styles.field}>
            <label htmlFor={`${id}-sort`}>Sort</label>
            <select
              id={`${id}-sort`}
              onChange={(event) => set('sort', event.target.value)}
              value={get('sort') || sortOptions[0].value}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {extraActions}

        <span aria-live="polite" className={styles.count}>
          {resultCount} {resultCount === 1 ? singular : plural}
        </span>
      </div>

      {showChips && (activeChips.length > 0 || queryParam) ? (
        <div aria-label="Active filters" className={styles.chips} role="region">
          {queryParam ? (
            <span className={styles.chip}>
              <span>"{queryParam}"</span>
              <button
                aria-label="Clear query search"
                onClick={() => {
                  setLocalSearch('');
                  set('q', '');
                }}
                type="button"
              >
                ×
              </button>
            </span>
          ) : null}
          {activeChips.map((chip) => (
            <span className={styles.chip} key={chip.key}>
              <span>
                {chip.label}: {chip.valueLabel}
              </span>
              <button
                aria-label={`Remove filter ${chip.label}`}
                onClick={() => set(chip.key, '')}
                type="button"
              >
                ×
              </button>
            </span>
          ))}
          <button
            className={styles.clearAll}
            onClick={handleClearAll}
            type="button"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
