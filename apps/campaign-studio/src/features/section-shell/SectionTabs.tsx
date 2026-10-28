import { useRef, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useSectionBundle } from './SectionContext';
import styles from './SectionTabs.module.css';

export interface SectionTab {
  /** URL segment, e.g. `notes` -> `<base>/lore/notes`. */
  id: string;
  label: string;
  count?: number;
}

interface SectionTabsProps {
  /** Accessible name for the tablist, e.g. "Lore sections". */
  ariaLabel: string;
  /** Section route segment the tab id is appended to, e.g. `lore`. */
  sectionPath: string;
  tabs: SectionTab[];
  activeTab: string;
}

/**
 * WAI-ARIA tabs whose state lives in the URL (`<base>/<section>/<tab>`), with
 * roving tabindex and arrow/Home/End keys. Each tab is a link, so it works
 * without script and Back restores the previous tab. Pass
 * `sectionPath="lore/<tab>"` to `SectionLayout` so its back link stays in tab.
 * Filters/sort in the query string are dropped when switching tabs.
 */
export function SectionTabs({
  ariaLabel,
  sectionPath,
  tabs,
  activeTab,
}: SectionTabsProps) {
  const { basePath } = useSectionBundle();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);
  const hrefFor = (tab: SectionTab) => `${basePath}/${sectionPath}/${tab.id}`;

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    let next: number | undefined;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft')
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    navigate(`${hrefFor(tabs[next])}${hash}`);
    refs.current[next]?.focus();
  };

  return (
    <div aria-label={ariaLabel} className={styles.tablist} role="tablist">
      {tabs.map((tab, index) => {
        const selected = tab.id === activeTab;
        return (
          <Link
            aria-selected={selected}
            className={`${styles.tab} ${selected ? styles.selected : ''}`}
            key={tab.id}
            onKeyDown={(event) => onKeyDown(event, index)}
            ref={(node) => {
              refs.current[index] = node;
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            to={hrefFor(tab)}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={styles.count}>{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
