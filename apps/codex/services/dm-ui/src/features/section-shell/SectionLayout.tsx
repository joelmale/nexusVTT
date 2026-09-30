import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { LifecycleBanner } from './LifecycleBanner';
import { useSectionBundle } from './SectionContext';
import { StartFromExample } from './StartFromExample';
import styles from './SectionLayout.module.css';
import { SINGLE_PANE_QUERY, useMediaQuery } from './useMediaQuery';

interface SectionLayoutProps {
  /** Section name; the page `h1`, e.g. "NPCs". */
  title: string;
  /** Route segment of the section, e.g. "npcs"; used for the back link. */
  sectionPath: string;
  count?: number;
  /** Header actions, e.g. a stubbed "New NPC" button. */
  actions?: ReactNode;
  /** Tab strip for two-tab sections (`SectionTabs`), under the title. */
  tabs?: ReactNode;
  /** Usually a `FilterBar`. */
  filters?: ReactNode;
  /** Master column, usually an `EntityList`. */
  list: ReactNode;
  /** Rendered under the list; put the single `AddRow` here. */
  listFooter?: ReactNode;
  /** Detail body for the selected item (rendered when `selectedId` is set and found). */
  detail?: ReactNode;
  /** Detail body when nothing is selected, usually `SectionSummary`. */
  summary?: ReactNode;
  /** Id from the URL, if any. */
  selectedId?: string;
  /** True when `selectedId` matches nothing in this campaign. */
  notFound?: boolean;
  /** When set, replaces the whole master/detail area (empty section). */
  empty?: ReactNode;
}

/**
 * Master/detail scaffold for entity sections. Below 1020px it collapses to one
 * pane: the list without a selected id, the detail (with a back link) with one.
 */
export function SectionLayout({
  title,
  sectionPath,
  count,
  actions,
  tabs,
  filters,
  list,
  listFooter,
  detail,
  summary,
  selectedId,
  notFound = false,
  empty,
}: SectionLayoutProps) {
  const { bundle, basePath } = useSectionBundle();
  const { search } = useLocation();
  const singlePane = useMediaQuery(SINGLE_PANE_QUERY);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!singlePane || !selectedId) return;
    const heading = detailRef.current?.querySelector<HTMLElement>('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [singlePane, selectedId]);

  const backHref = `${basePath}/${sectionPath}${search}`;
  const showList = !singlePane || !selectedId;
  const showDetail = !singlePane || Boolean(selectedId);

  let detailBody: ReactNode;
  if (selectedId && notFound) {
    detailBody = (
      <section className={styles.notFound}>
        <h2>Not found in this campaign</h2>
        <p>No {title} entry matches this link.</p>
        <Link to={backHref}>Back to {title}</Link>
      </section>
    );
  } else {
    detailBody = selectedId ? detail : summary;
  }

  return (
    <main className={styles.section}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1>{title}</h1>
          {count !== undefined ? (
            <span className={styles.count}>{count}</span>
          ) : null}
          <div className={styles.actions}>
            {actions}
            <StartFromExample />
          </div>
        </div>
        <LifecycleBanner bundle={bundle} />
        {tabs}
      </header>

      {empty ? (
        <div className={styles.empty}>{empty}</div>
      ) : (
        <>
          {filters ? <div className={styles.filters}>{filters}</div> : null}
          <div
            className={`${styles.panes} ${singlePane ? styles.single : ''}`}
            data-single-pane={singlePane ? 'true' : 'false'}
          >
            {showList ? (
              <div className={styles.list}>
                {list}
                {listFooter}
              </div>
            ) : null}
            {showDetail ? (
              <div className={styles.detail} ref={detailRef}>
                {singlePane && selectedId ? (
                  <Link className={styles.back} to={backHref}>
                    ← All {title}
                  </Link>
                ) : null}
                <div className={styles.detailBody}>{detailBody}</div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
