import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import LinkIcon from 'lucide-react/dist/esm/icons/link';
import Search from 'lucide-react/dist/esm/icons/search';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Swords from 'lucide-react/dist/esm/icons/swords';
import Users from 'lucide-react/dist/esm/icons/users';
import type { LucideIcon } from 'lucide-react';

import { useCapabilityNotice } from '@/features/capability-notice';
import { ENTITY_ICONS } from '@/features/section-shell/entityMeta';
import { useSectionBundle } from '@/features/section-shell/SectionContext';

import { OverviewPanel } from './OverviewPanel';
import {
  buildOverviewModel,
  type OverviewPanelId,
  type OverviewRecord,
} from './overviewModel';
import styles from './campaign-overview.module.css';

const PANEL_ICONS: Record<OverviewPanelId, LucideIcon> = {
  quests: CheckSquare,
  encounters: Swords,
  clues: Search,
  objects: FileText,
  party: Users,
};

/** Panels with mixed kinds show a kind icon instead of a status dot. */
const KIND_ICON_PANELS: ReadonlySet<OverviewPanelId> = new Set([
  'objects',
  'party',
]);

const DEFAULT_COLLAPSED: Partial<Record<OverviewPanelId, boolean>> = {
  party: true,
};

type CollapsedState = Partial<Record<OverviewPanelId, boolean>>;

function storageKey(campaignId: string) {
  return `nexus-overview-panels:${campaignId}`;
}

function readCollapsed(campaignId: string): CollapsedState {
  try {
    const raw = window.localStorage.getItem(storageKey(campaignId));
    if (!raw) return DEFAULT_COLLAPSED;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as CollapsedState)
      : DEFAULT_COLLAPSED;
  } catch {
    return DEFAULT_COLLAPSED;
  }
}

function writeCollapsed(campaignId: string, state: CollapsedState) {
  try {
    window.localStorage.setItem(storageKey(campaignId), JSON.stringify(state));
  } catch {
    // Storage is a convenience; the overview works without it.
  }
}

/**
 * Campaign dashboard for any campaign bundle: example fixtures and real
 * server campaigns alike. Renders inside `SectionRoute`.
 */
export function CampaignOverview() {
  const { bundle, basePath } = useSectionBundle();
  const { notifyCapability } = useCapabilityNotice();
  const model = useMemo(() => buildOverviewModel(bundle), [bundle]);

  const [collapsedState, setCollapsedState] = useState<{
    campaignId: string;
    value: CollapsedState;
  }>(() => ({
    campaignId: bundle.campaignId,
    value: readCollapsed(bundle.campaignId),
  }));
  // Re-read when the campaign changes without remounting.
  const collapsed =
    collapsedState.campaignId === bundle.campaignId
      ? collapsedState.value
      : readCollapsed(bundle.campaignId);

  const [focused, setFocused] = useState<OverviewPanelId | null>(null);
  const [selected, setSelected] = useState<OverviewRecord | undefined>();
  const selectedRecord = selected ?? model.backlinks[0];

  const toggleCollapsed = useCallback(
    (id: OverviewPanelId) => {
      if (focused === id) setFocused(null);
      const next = { ...collapsed, [id]: !collapsed[id] };
      setCollapsedState({ campaignId: bundle.campaignId, value: next });
      writeCollapsed(bundle.campaignId, next);
    },
    [bundle.campaignId, collapsed, focused],
  );

  useEffect(() => {
    if (!focused) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocused(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focused]);

  const { nextSession } = model;

  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>{model.title}</h1>
          {model.subtitle && <p>{model.subtitle}</p>}
        </div>
        <div className={styles.headerTools}>
          {model.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </header>

      <div className={styles.contentGrid}>
        <div className={styles.primaryContent}>
          <section
            className={styles.nextSession}
            aria-labelledby="next-session-heading"
          >
            <div className={styles.nextTop}>
              <div>
                <div className={styles.eyebrow}>Next Session</div>
                <h2 id="next-session-heading">
                  {nextSession?.heading ?? 'No session scheduled'}
                </h2>
                {nextSession && nextSession.schedule.length > 0 && (
                  <div className={styles.sessionMeta}>
                    <CalendarDays aria-hidden="true" size={18} />
                    {nextSession.schedule.map((part) => (
                      <span key={part}>{part}</span>
                    ))}
                  </div>
                )}
              </div>
              <Link
                className={styles.primaryButton}
                to={`${basePath}${nextSession?.planHref ?? '/sessions'}`}
              >
                <CalendarDays aria-hidden="true" size={18} />
                <span>{nextSession ? 'Plan Session' : 'Open Sessions'}</span>
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </div>
            {nextSession && nextSession.facts.length > 0 && (
              <div className={styles.sessionFacts}>
                {nextSession.facts.map(({ label, record }) => {
                  const FactIcon = ENTITY_ICONS[record.kind];
                  const body = (
                    <>
                      <FactIcon aria-hidden="true" size={22} />
                      <span>
                        <small>{label}</small>
                        <strong>{record.title}</strong>
                        <em>{record.subtitle}</em>
                      </span>
                    </>
                  );
                  return record.href ? (
                    <Link
                      className={styles.fact}
                      key={label}
                      to={`${basePath}${record.href}`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={styles.fact} key={label}>
                      {body}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div
            className={`${styles.sectionGrid} ${focused ? styles.sectionGridFocused : ''}`}
          >
            {model.panels.map((panel) => (
              <OverviewPanel
                basePath={basePath}
                collapsed={
                  focused ? focused !== panel.id : Boolean(collapsed[panel.id])
                }
                focused={focused === panel.id}
                icon={PANEL_ICONS[panel.id]}
                key={panel.id}
                onMore={() => notifyCapability('campaign.object.actions')}
                onSelect={setSelected}
                onToggleCollapsed={() => toggleCollapsed(panel.id)}
                onToggleFocus={() =>
                  setFocused((current) =>
                    current === panel.id ? null : panel.id,
                  )
                }
                panel={panel}
                selectedId={selectedRecord?.id}
                showKindIcons={KIND_ICON_PANELS.has(panel.id)}
              />
            ))}
          </div>
        </div>

        <aside className={styles.inspector} aria-label="Activity and links">
          <h2>
            <LinkIcon aria-hidden="true" size={20} />
            Activity &amp; Links
          </h2>
          {model.backlinks.length === 0 && model.recentEdits.length === 0 ? (
            <p className={styles.emptyPanel}>No activity yet.</p>
          ) : (
            <>
              <ActivityList
                basePath={basePath}
                records={model.backlinks}
                selectedId={selectedRecord?.id}
                title="Backlinks"
                variant="link"
                onSelect={setSelected}
              />
              <ActivityList
                basePath={basePath}
                records={model.recentEdits}
                selectedId={selectedRecord?.id}
                title="Recent Edits"
                variant="edit"
                onSelect={setSelected}
              />
            </>
          )}
          {selectedRecord && (
            <div className={styles.selectionSummary}>
              <div>
                <Sparkles aria-hidden="true" size={15} />
                Selected object
              </div>
              <strong>{selectedRecord.title}</strong>
              <span>{selectedRecord.subtitle}</span>
              {selectedRecord.href && (
                <Link
                  className={styles.viewAll}
                  to={`${basePath}${selectedRecord.href}`}
                >
                  Open to edit
                  <ArrowRight aria-hidden="true" size={14} />
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function ActivityList({
  basePath,
  records,
  selectedId,
  title,
  variant,
  onSelect,
}: {
  basePath: string;
  records: OverviewRecord[];
  selectedId?: string;
  title: string;
  variant: 'link' | 'edit';
  onSelect: (record: OverviewRecord) => void;
}) {
  if (records.length === 0) return null;
  return (
    <div className={styles.inspectorSection}>
      <div className={styles.inspectorHeading}>
        <h3>{title}</h3>
      </div>
      {records.map((record) => {
        const KindIcon = ENTITY_ICONS[record.kind];
        const className = `${variant === 'link' ? styles.linkRow : styles.editRow} ${selectedId === record.id ? styles.inspectorSelected : ''}`;
        const body = (
          <>
            <KindIcon aria-hidden="true" size={19} />
            <span>
              <strong>{record.title}</strong>
              <small>
                {variant === 'link' ? (
                  record.meta
                ) : (
                  <>
                    {record.subtitle}
                    <br />
                    {record.meta}
                  </>
                )}
              </small>
            </span>
            {variant === 'link' && <ChevronRight aria-hidden="true" size={16} />}
          </>
        );
        return record.href ? (
          <Link
            className={className}
            key={record.id}
            onFocus={() => onSelect(record)}
            onMouseEnter={() => onSelect(record)}
            to={`${basePath}${record.href}`}
          >
            {body}
          </Link>
        ) : (
          <button
            className={className}
            key={record.id}
            onClick={() => onSelect(record)}
            type="button"
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
