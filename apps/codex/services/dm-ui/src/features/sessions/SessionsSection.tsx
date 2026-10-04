import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/features/section-shell/EmptyState';
import { EntityList } from '@/features/section-shell/EntityList';
import {
  FilterBar,
  type FilterFacet,
} from '@/features/section-shell/FilterBar';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { StatusBadge } from '@/features/section-shell/StatusBadge';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import { SessionPlannerModal } from './SessionPlannerModal';
import {
  buildSessionsModel,
  readinessOf,
  sessionForwardIds,
  type SessionItem,
} from './sessionsModels';
import styles from './SessionsSection.module.css';

const STATUS_FACET: FilterFacet = {
  key: 'status',
  label: 'Status',
  options: [
    { value: 'complete', label: 'Complete' },
    { value: 'planned', label: 'Planned' },
    { value: 'draft', label: 'Draft' },
  ],
};

function SessionRow({ session }: { session: SessionItem }) {
  const meta = [
    session.plannedDate,
    session.partyLevel ? `Level ${session.partyLevel}` : undefined,
  ].filter(Boolean);
  return (
    <>
      <span aria-hidden="true" className={styles.number}>
        #{session.number}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>
          <span className={styles.srOnly}>Session {session.number}: </span>
          {session.title}
        </span>
        {meta.length > 0 ? (
          <span className={styles.rowMeta}>{meta.join(' · ')}</span>
        ) : null}
      </span>
      {session.plan ? (
        <ClipboardList
          aria-label="Has run sheet"
          className={styles.planIcon}
          role="img"
          size={16}
        />
      ) : null}
      <StatusBadge value={session.status} />
    </>
  );
}

function SessionDetail({
  session,
  canPlan,
  onPlanSession,
}: {
  session: SessionItem;
  canPlan: boolean;
  onPlanSession: (session: SessionItem) => void;
}) {
  const { bundle, basePath, store } = useSectionBundle();
  const act = bundle.acts.find((entry) => entry.id === session.actId);
  const readiness = readinessOf(session);
  const facts: Array<[string, string]> = [];
  if (act) facts.push(['Act', act.title]);
  if (session.plannedDate) facts.push(['Date', session.plannedDate]);
  if (session.durationHours) {
    facts.push(['Duration', `${session.durationHours} hours`]);
  }
  if (session.partyLevel) facts.push(['Party level', `${session.partyLevel}`]);

  const handleStatusChange = async (
    nextStatus: 'draft' | 'planned' | 'complete',
  ) => {
    if (store?.editable) {
      await store.updateItem('session', session.id, { status: nextStatus });
    }
  };

  return (
    <article className={styles.detail}>
      <header className={styles.detailHeader}>
        <p className={styles.eyebrow}>Session {session.number}</p>
        <h2>{session.title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge value={session.status} />
          {store?.editable ? (
            <select
              aria-label="Change session status"
              className={styles.statusSelect}
              data-testid={`status-select-${session.id}`}
              onChange={(e) =>
                handleStatusChange(
                  e.target.value as 'draft' | 'planned' | 'complete',
                )
              }
              value={session.status}
            >
              <option value="draft">Draft</option>
              <option value="planned">Planned</option>
              <option value="complete">Complete</option>
            </select>
          ) : null}
        </div>
      </header>

      {facts.length > 0 ? (
        <dl className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {session.tags.length > 0 ? (
        <ul aria-label="Tags" className={styles.tags}>
          {session.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}

      {session.summary ? (
        <p className={styles.summary}>{session.summary}</p>
      ) : null}

      <section aria-label="Run sheet" className={styles.runSheet}>
        {session.plan ? (
          <>
            {readiness ? (
              <p className={styles.readiness}>
                Plan readiness: {readiness.complete} of {readiness.total} ready
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link
                className={styles.primary}
                to={`${basePath}/sessions/${session.id}/plan`}
              >
                Open run sheet
              </Link>
              {canPlan ? (
                <button
                  className={styles.secondary}
                  onClick={() => onPlanSession(session)}
                  type="button"
                  data-testid={`edit-plan-btn-${session.id}`}
                >
                  Edit plan
                </button>
              ) : null}
            </div>
          </>
        ) : canPlan ? (
          <>
            <p className={styles.readiness}>No run sheet yet.</p>
            <button
              className={styles.primary}
              onClick={() => onPlanSession(session)}
              type="button"
              data-testid={`plan-this-session-btn-${session.id}`}
            >
              Plan this session
            </button>
          </>
        ) : null}
      </section>

      <RelatedGroups
        entityId={session.id}
        exclude={['session', 'objective', 'scene']}
        forwardIds={sessionForwardIds(session)}
        heading="Related"
      />
    </article>
  );
}

export function SessionsSection() {
  const { bundle, basePath, store } = useSectionBundle();
  const { sessionId } = useParams();
  const { get } = useSectionQuery();
  const query = { q: get('q'), status: get('status'), act: get('act') };
  const model = buildSessionsModel(bundle, query);

  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [planningSession, setPlanningSession] = useState<SessionItem | undefined>(undefined);

  const handleOpenPlanner = (session?: SessionItem) => {
    setPlanningSession(session);
    setIsPlannerOpen(true);
  };

  const handleClosePlanner = () => {
    setIsPlannerOpen(false);
    setPlanningSession(undefined);
  };

  const planAction = model.canPlan ? (
    <button
      className={styles.secondary}
      onClick={() => handleOpenPlanner()}
      type="button"
      data-testid="plan-session-header-btn"
    >
      Plan a session
    </button>
  ) : null;

  if (model.totalCount === 0) {
    return (
      <>
        <SectionLayout
          count={0}
          empty={
            <EmptyState
              action={planAction}
              description="Sessions you plan will appear here as a timeline."
              title="No sessions yet."
            />
          }
          list={null}
          sectionPath="sessions"
          title="Sessions"
        />
        {isPlannerOpen && (
          <SessionPlannerModal
            isOpen={isPlannerOpen}
            onClose={handleClosePlanner}
            bundle={bundle}
            store={store}
            basePath={basePath}
            initialSession={planningSession}
          />
        )}
      </>
    );
  }

  const selected = sessionId
    ? bundle.sessions.find((session) => session.id === sessionId)
    : undefined;
  const fallback = bundle.sessions.find(
    (session) => session.id === model.defaultSessionId,
  );

  const facets: FilterFacet[] = [STATUS_FACET];
  if (model.actOptions.length > 0) {
    facets.push({ key: 'act', label: 'Act', options: model.actOptions });
  }

  return (
    <>
      <SectionLayout
        actions={planAction}
        count={model.totalCount}
        detail={
          selected ? (
            <SessionDetail
              canPlan={model.canPlan}
              onPlanSession={handleOpenPlanner}
              session={selected}
            />
          ) : null
        }
        filters={
          <FilterBar
            facets={facets}
            plural="sessions"
            resultCount={model.visibleCount}
            searchLabel="Search sessions"
            singular="session"
          />
        }
        list={
          model.visibleCount === 0 ? (
            <p className={styles.noMatch}>No sessions match these filters.</p>
          ) : (
            <EntityList
              ariaLabel={`Session ${model.timelineLabel.toLowerCase()}`}
              getHref={(session) => `${basePath}/sessions/${session.id}`}
              getId={(session) => session.id}
              groups={model.groups.map((group) => ({
                id: group.id,
                label: group.label,
                items: group.sessions,
              }))}
              renderRow={(session) => <SessionRow session={session} />}
              selectedId={sessionId ?? model.defaultSessionId}
            />
          )
        }
        notFound={Boolean(sessionId) && !selected}
        sectionPath="sessions"
        selectedId={sessionId}
        summary={
          fallback ? (
            <SessionDetail
              canPlan={model.canPlan}
              onPlanSession={handleOpenPlanner}
              session={fallback}
            />
          ) : null
        }
        title="Sessions"
      />
      {isPlannerOpen && (
        <SessionPlannerModal
          isOpen={isPlannerOpen}
          onClose={handleClosePlanner}
          bundle={bundle}
          store={store}
          basePath={basePath}
          initialSession={planningSession}
        />
      )}
    </>
  );
}
