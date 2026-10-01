import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2';
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ENTITY_ICONS } from '@/features/section-shell/entityMeta';

import type { OverviewPanelModel, OverviewRecord } from './overviewModel';
import styles from './campaign-overview.module.css';

/** Rows shown while a panel is not focused. */
export const PREVIEW_ROWS = 4;

const META_TONE_CLASS = {
  positive: styles.metaPositive,
  warning: styles.metaWarning,
  danger: styles.metaDanger,
  neutral: '',
} as const;

interface OverviewPanelProps {
  panel: OverviewPanelModel;
  icon: LucideIcon;
  basePath: string;
  collapsed: boolean;
  focused: boolean;
  selectedId?: string;
  /** Show the kind icon on each row (mixed-kind panels). */
  showKindIcons?: boolean;
  onToggleCollapsed: () => void;
  onToggleFocus: () => void;
  onSelect: (record: OverviewRecord) => void;
  onMore: () => void;
}

export function OverviewPanel({
  panel,
  icon: PanelIcon,
  basePath,
  collapsed,
  focused,
  selectedId,
  showKindIcons = false,
  onToggleCollapsed,
  onToggleFocus,
  onSelect,
  onMore,
}: OverviewPanelProps) {
  const bodyId = `overview-panel-${panel.id}`;
  const headingId = `${bodyId}-heading`;
  const records = focused
    ? panel.records
    : panel.records.slice(0, PREVIEW_ROWS);
  const hidden = panel.records.length - records.length;

  return (
    <section
      aria-labelledby={headingId}
      className={[
        styles.dataSection,
        collapsed ? styles.collapsed : '',
        focused ? styles.focused : '',
      ].join(' ')}
      data-panel={panel.id}
    >
      <div className={styles.sectionHeader}>
        <h2 id={headingId}>
          <button
            aria-controls={bodyId}
            aria-expanded={!collapsed}
            className={styles.panelToggle}
            onClick={onToggleCollapsed}
            type="button"
          >
            <ChevronDown aria-hidden="true" className={styles.chevron} size={17} />
            <PanelIcon aria-hidden="true" size={20} />
            <span>{panel.title}</span>
            <span className={styles.count}>{panel.records.length}</span>
          </button>
        </h2>
        <div className={styles.panelActions}>
          <Link className={styles.viewAll} to={`${basePath}${panel.viewAllHref}`}>
            View All
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
          <button
            aria-label={
              focused ? `Exit focus on ${panel.title}` : `Focus ${panel.title}`
            }
            aria-pressed={focused}
            className={styles.iconButton}
            onClick={onToggleFocus}
            title={focused ? 'Exit focus (Esc)' : 'Focus this panel'}
            type="button"
          >
            {focused ? (
              <Minimize2 aria-hidden="true" size={17} />
            ) : (
              <Maximize2 aria-hidden="true" size={17} />
            )}
          </button>
        </div>
      </div>

      <div className={styles.recordList} hidden={collapsed} id={bodyId}>
        {panel.records.length === 0 ? (
          <p className={styles.emptyPanel}>
            {panel.emptyMessage}{' '}
            <Link to={`${basePath}${panel.viewAllHref}`}>Open section</Link>
          </p>
        ) : (
          records.map((record) => {
            const KindIcon = ENTITY_ICONS[record.kind];
            return (
              <div
                className={[
                  styles.recordRow,
                  focused ? styles.recordRowDetailed : '',
                  selectedId === record.id ? styles.selectedRow : '',
                ].join(' ')}
                key={record.id}
              >
                <button
                  className={styles.recordMain}
                  onClick={() => onSelect(record)}
                  type="button"
                >
                  {showKindIcons ? (
                    <KindIcon
                      aria-hidden="true"
                      className={styles.recordIcon}
                      size={19}
                    />
                  ) : (
                    <span
                      className={`${styles.statusDot} ${record.tone ? styles[record.tone] : ''}`}
                    />
                  )}
                  <span className={styles.recordCopy}>
                    <strong>{record.title}</strong>
                    <small>{record.subtitle}</small>
                    {focused && record.details.length > 0 && (
                      <dl className={styles.focusDetail}>
                        {record.details.map((detail) => (
                          <div key={detail.label}>
                            <dt>{detail.label}</dt>
                            <dd>{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </span>
                </button>
                <span
                  className={`${styles.recordMeta} ${record.tone ? META_TONE_CLASS[record.tone] : ''}`}
                >
                  {record.meta}
                </span>
                {record.href ? (
                  <Link
                    aria-label={`Open ${record.title}`}
                    className={styles.openLink}
                    title="Open to view and edit"
                    to={`${basePath}${record.href}`}
                  >
                    Open
                  </Link>
                ) : (
                  <button
                    aria-label={`More actions for ${record.title}`}
                    className={styles.iconButton}
                    onClick={onMore}
                    title={`More actions for ${record.title}`}
                    type="button"
                  >
                    <MoreHorizontal aria-hidden="true" size={19} />
                  </button>
                )}
              </div>
            );
          })
        )}
        {hidden > 0 && (
          <button
            className={styles.showMore}
            onClick={onToggleFocus}
            type="button"
          >
            Show all {panel.records.length}
          </button>
        )}
      </div>
    </section>
  );
}
