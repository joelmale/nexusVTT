import { useEffect, useState } from 'react';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2';
import Minimize2 from 'lucide-react/dist/esm/icons/minimize-2';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ENTITY_ICONS } from '@/features/section-shell/entityMeta';

import type {
  OverviewPanelId,
  OverviewPanelModel,
  OverviewRecord,
} from './overviewModel';
import styles from './campaign-overview.module.css';

/** Rows shown while a panel is not focused. */
export const PREVIEW_ROWS = 4;

const META_TONE_CLASS = {
  positive: styles.metaPositive,
  warning: styles.metaWarning,
  danger: styles.metaDanger,
  neutral: '',
} as const;

export interface OverviewPanelProps {
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
  /** Row action handlers */
  onOpenInSection?: (record: OverviewRecord, panelId: OverviewPanelId) => void;
  onTogglePin?: (record: OverviewRecord) => void;
  onArchive?: (record: OverviewRecord, panelId: OverviewPanelId) => void;
  /** Party-specific callbacks */
  onRecordClick?: (record: OverviewRecord, panelId: OverviewPanelId) => void;
  onAddPartyMember?: () => void;
  onManageParty?: () => void;
  canAddParty?: boolean;
  /** Backward compatibility if any caller passes onMore */
  onMore?: () => void;
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
  onOpenInSection,
  onTogglePin,
  onArchive,
  onRecordClick,
  onAddPartyMember,
  onManageParty,
  canAddParty = false,
  onMore,
}: OverviewPanelProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    const onClick = () => setOpenMenuId(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [openMenuId]);

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
          {panel.id === 'party' && canAddParty && onAddPartyMember && (
            <button
              aria-label="Add Party Member"
              className={styles.addPartyBtn}
              onClick={onAddPartyMember}
              type="button"
            >
              <UserPlus aria-hidden="true" size={13} />
              <span>Add Member</span>
            </button>
          )}
          {panel.id === 'party' && onManageParty ? (
            <button
              className={styles.viewAll}
              onClick={onManageParty}
              type="button"
            >
              View All
              <ArrowRight aria-hidden="true" size={15} />
            </button>
          ) : (
            <Link className={styles.viewAll} to={`${basePath}${panel.viewAllHref}`}>
              View All
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          )}
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
            {panel.id === 'party' && onManageParty ? (
              <button
                className={styles.emptyLink}
                onClick={onManageParty}
                type="button"
              >
                Open party management
              </button>
            ) : (
              <Link to={`${basePath}${panel.viewAllHref}`}>Open section</Link>
            )}
          </p>
        ) : (
          records.map((record) => {
            const KindIcon = ENTITY_ICONS[record.kind];
            const isMenuOpen = openMenuId === record.id;
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
                  onClick={() => {
                    onSelect(record);
                    if (panel.id === 'party') {
                      onRecordClick?.(record, panel.id);
                    }
                  }}
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
                <div
                  className={styles.rowActions}
                  onClick={(e) => e.stopPropagation()}
                >
                  {record.href && (
                    <Link
                      aria-label={`Open ${record.title}`}
                      className={styles.openLink}
                      title="Open to view and edit"
                      to={`${basePath}${record.href}`}
                    >
                      Open
                    </Link>
                  )}
                  <button
                    aria-expanded={isMenuOpen}
                    aria-haspopup="menu"
                    aria-label={`More actions for ${record.title}`}
                    className={styles.iconButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onMore && !onOpenInSection && !onTogglePin && !onArchive) {
                        onMore();
                      }
                      setOpenMenuId((current) =>
                        current === record.id ? null : record.id,
                      );
                    }}
                    title={`More actions for ${record.title}`}
                    type="button"
                  >
                    <MoreHorizontal aria-hidden="true" size={19} />
                  </button>
                  {isMenuOpen && (
                    <div
                      aria-label={`Actions for ${record.title}`}
                      className={styles.rowMenu}
                      role="menu"
                    >
                      <button
                        className={styles.rowMenuItem}
                        onClick={() => {
                          setOpenMenuId(null);
                          if (onOpenInSection) {
                            onOpenInSection(record, panel.id);
                          } else if (panel.id === 'party') {
                            onRecordClick?.(record, panel.id);
                          }
                        }}
                        role="menuitem"
                        type="button"
                      >
                        Open in section
                      </button>
                      <button
                        className={styles.rowMenuItem}
                        onClick={() => {
                          setOpenMenuId(null);
                          onTogglePin?.(record);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        Pin / Unpin
                      </button>
                      <button
                        className={`${styles.rowMenuItem} ${styles.rowMenuItemDanger}`}
                        onClick={() => {
                          setOpenMenuId(null);
                          onArchive?.(record, panel.id);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        Archive
                      </button>
                    </div>
                  )}
                </div>
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
