import { useId } from 'react';

import styles from './FilterBar.module.css';
import { useSectionQuery } from './useSectionQuery';

export interface FilterOption {
  value: string;
  label: string;
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
  /** Number of rows after filtering; announced politely. */
  resultCount: number;
  singular: string;
  plural: string;
}

/** Search + facet selects + sort, all bound to query params (`q`, facet keys, `sort`). */
export function FilterBar({
  searchLabel,
  facets = [],
  sortOptions,
  resultCount,
  singular,
  plural,
}: FilterBarProps) {
  const { get, set } = useSectionQuery();
  const id = useId();

  return (
    <div className={styles.bar} role="search">
      <div className={styles.field}>
        <label className={styles.srOnly} htmlFor={`${id}-q`}>
          {searchLabel}
        </label>
        <input
          className={styles.search}
          id={`${id}-q`}
          onChange={(event) => set('q', event.target.value)}
          placeholder={searchLabel}
          type="search"
          value={get('q')}
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
              </option>
            ))}
          </select>
        </div>
      ))}
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
      <span aria-live="polite" className={styles.count}>
        {resultCount} {resultCount === 1 ? singular : plural}
      </span>
    </div>
  );
}
