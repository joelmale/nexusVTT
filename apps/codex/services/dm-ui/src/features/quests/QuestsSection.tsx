import { useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import type { CampaignQuest } from '@/demo/fixture-registry';
import { AddRow, EditableSection } from '@/features/section-shell/EditableSection';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { EntityLink } from '@/features/section-shell/EntityLink';
import { EntityList } from '@/features/section-shell/EntityList';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import { StatusBadge } from '@/features/section-shell/StatusBadge';
import { humanize } from '@/features/section-shell/statusTones';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import styles from './QuestsSection.module.css';
import {
  OBJECTIVE_STATUSES,
  QUEST_GROUP_LABELS,
  QUEST_STATUSES,
  buildQuestPatch,
  buildQuestsModel,
  isOpenThread,
  objectiveProgress,
  objectivesFor,
  questStatusCounts,
  questsInNextSession,
  toQuestDraft,
  type ObjectiveDraft,
  type QuestDraft,
} from './questsModels';

const PRIORITIES = ['high', 'medium', 'low'];

export function QuestsSection() {
  const { bundle, basePath, store } = useSectionBundle();
  const { questId } = useParams();
  const { get, set } = useSectionQuery();

  const selected = questId
    ? bundle.quests.find((quest) => quest.id === questId)
    : undefined;

  const query = {
    q: get('q'),
    priority: get('priority'),
    faction: get('faction'),
    sort: get('sort'),
    showComplete: get('done') === '1',
    selectedId: questId,
  };
  const model = useMemo(
    () => buildQuestsModel(bundle, query),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, query.q, query.priority, query.faction, query.sort, query.showComplete, query.selectedId],
  );

  const addRow = (
    <AddRow
      kind="quest"
      label="Add quest"
      nameField="title"
      sectionPath="quests"
    />
  );

  if (bundle.quests.length === 0) {
    return (
      <SectionLayout
        empty={
          <EmptyState
            action={addRow}
            description={
              store.editable
                ? 'Add the first quest to start tracking objectives.'
                : 'Quests you track will appear here, grouped by status.'
            }
            title="No quests yet."
          />
        }
        list={null}
        sectionPath="quests"
        title="Quests"
      />
    );
  }

  const factions = bundle.factions.filter((faction) =>
    bundle.quests.some((quest) => quest.factionIds.includes(faction.id)),
  );

  const listFooter = (
    <>
      {model.collapsedCompleteCount > 0 ? (
        <button
          className={styles.toggle}
          onClick={() => set('done', '1')}
          type="button"
        >
          Show completed ({model.collapsedCompleteCount})
        </button>
      ) : null}
      {addRow}
    </>
  );

  const inNext = questsInNextSession(bundle);

  return (
    <SectionLayout
      count={bundle.quests.length}
      detail={selected ? <QuestDetail quest={selected} /> : undefined}
      filters={
        <FilterBar
          facets={[
            {
              key: 'priority',
              label: 'Priority',
              options: PRIORITIES.map((value) => ({
                value,
                label: humanize(value),
              })),
            },
            ...(factions.length > 0
              ? [
                  {
                    key: 'faction',
                    label: 'Faction',
                    options: factions.map((faction) => ({
                      value: faction.id,
                      label: faction.name,
                    })),
                  },
                ]
              : []),
          ]}
          plural="quests"
          resultCount={model.filteredCount}
          searchLabel="Search quests"
          singular="quest"
          sortOptions={[
            { value: 'priority', label: 'Priority' },
            { value: 'title', label: 'Title' },
          ]}
        />
      }
      list={
        <EntityList
          ariaLabel="Quest list"
          getHref={(row) => `${basePath}/quests/${encodeURIComponent(row.quest.id)}`}
          getId={(row) => row.quest.id}
          groups={model.groups.map((group) => ({
            id: group.id,
            label: `${group.label}${group.items.length ? ` (${group.items.length})` : ''}`,
            items: group.items,
          }))}
          renderRow={(row) => (
            <span className={styles.row}>
              <span className={styles.rowTitle}>{row.quest.title}</span>
              <span className={styles.rowMeta}>
                <StatusBadge value={row.quest.priority}>
                  {humanize(row.quest.priority)}
                </StatusBadge>
                {row.openThread ? (
                  <StatusBadge tone="warning">Open thread</StatusBadge>
                ) : null}
                {row.total > 0 ? (
                  <span
                    aria-label={`${row.done} of ${row.total} objectives complete`}
                    className={styles.progress}
                  >
                    {row.done}/{row.total}
                  </span>
                ) : null}
              </span>
            </span>
          )}
          selectedId={questId}
        />
      }
      listFooter={listFooter}
      notFound={Boolean(questId) && !selected}
      sectionPath="quests"
      selectedId={questId}
      summary={
        <SectionSummary
          stats={questStatusCounts(bundle)}
          title="Quests at a glance"
        >
          {inNext.length > 0 ? (
            <div className={styles.nextBlock}>
              <h3>In next session</h3>
              <ul className={styles.chips}>
                {inNext.map((quest) => (
                  <li key={quest.id}>
                    <EntityLink id={quest.id} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionSummary>
      }
      title="Quests"
    />
  );
}

function QuestDetail({ quest }: { quest: CampaignQuest }) {
  const { bundle } = useSectionBundle();
  const { hash } = useLocation();
  const objectives = objectivesFor(bundle, quest);
  const { done, total } = objectiveProgress(objectives);
  const openThread = isOpenThread(bundle, quest);

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    target?.scrollIntoView?.({ block: 'center' });
  }, [hash, quest.id]);

  return (
    <EditableSection
      headerExtras={
        <span className={styles.badges}>
          <StatusBadge value={quest.status}>
            {QUEST_GROUP_LABELS[quest.status]}
          </StatusBadge>
          <StatusBadge value={quest.priority}>
            {humanize(quest.priority)} priority
          </StatusBadge>
          {openThread ? (
            <StatusBadge tone="warning">Open thread</StatusBadge>
          ) : null}
        </span>
      }
      heading={quest.title}
      id={quest.id}
      initialDraft={toQuestDraft(bundle, quest)}
      kind="quest"
      renderForm={(draft, setDraft) => (
        <QuestForm draft={draft as QuestDraft} setDraft={setDraft} />
      )}
      toPatch={buildQuestPatch}
    >
      <div className={styles.body}>
        {quest.summary ? <p>{quest.summary}</p> : null}
        {quest.giverNpcId ? (
          <p className={styles.giver}>
            <span className={styles.label}>Quest giver</span>
            <EntityLink id={quest.giverNpcId} />
          </p>
        ) : null}
        {quest.resolution && quest.status === 'complete' ? (
          <section className={styles.resolution}>
            <h3>Resolution</h3>
            <p>{quest.resolution}</p>
          </section>
        ) : null}
        <section aria-label="Objectives">
          <h3 className={styles.objectivesHeading}>
            Objectives
            {total > 0 ? (
              <span className={styles.progress}>
                {done}/{total} complete
              </span>
            ) : null}
          </h3>
          {objectives.length === 0 ? (
            <p className={styles.muted}>No objectives yet.</p>
          ) : (
            <ol className={styles.objectives}>
              {objectives.map((objective) => (
                <li
                  className={styles.objective}
                  id={`objective-${objective.id}`}
                  key={objective.id}
                >
                  <div className={styles.objectiveHead}>
                    <span
                      className={
                        objective.status === 'complete'
                          ? styles.objectiveDone
                          : undefined
                      }
                    >
                      {objective.title}
                    </span>
                    <StatusBadge value={objective.status} />
                  </div>
                  {objective.clueIds.length + objective.locationIds.length >
                  0 ? (
                    <ul className={styles.chips}>
                      {[...objective.locationIds, ...objective.clueIds].map(
                        (id) => (
                          <li key={id}>
                            <EntityLink id={id} />
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
        <RelatedGroups
          entityId={quest.id}
          forwardIds={[
            ...quest.factionIds,
            ...quest.locationIds,
            ...quest.sessionIds,
          ]}
          kinds={['faction', 'location', 'session']}
        />
      </div>
    </EditableSection>
  );
}

function QuestForm({
  draft,
  setDraft,
}: {
  draft: QuestDraft;
  setDraft: (next: Record<string, unknown>) => void;
}) {
  const { bundle } = useSectionBundle();
  const update = (patch: Partial<QuestDraft>) => setDraft({ ...draft, ...patch });
  const setObjective = (index: number, patch: Partial<ObjectiveDraft>) =>
    update({
      objectives: draft.objectives.map((objective, i) =>
        i === index ? { ...objective, ...patch } : objective,
      ),
    });
  const addObjective = () =>
    update({
      objectives: [
        ...draft.objectives,
        {
          key: `new-${draft.objectives.length}-${Date.now()}`,
          title: '',
          status: 'pending',
          locationIds: [],
        },
      ],
    });

  return (
    <>
      <label>
        Title
        <input
          onChange={(event) => update({ title: event.target.value })}
          value={draft.title}
        />
      </label>
      <label>
        Status
        <select
          onChange={(event) =>
            update({ status: event.target.value as QuestDraft['status'] })
          }
          value={draft.status}
        >
          {QUEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {QUEST_GROUP_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Summary
        <textarea
          onChange={(event) => update({ summary: event.target.value })}
          rows={4}
          value={draft.summary}
        />
      </label>
      <label>
        Quest giver
        <select
          onChange={(event) => update({ giverNpcId: event.target.value })}
          value={draft.giverNpcId}
        >
          <option value="">No giver</option>
          {bundle.npcs.map((npc) => (
            <option key={npc.id} value={npc.id}>
              {npc.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className={styles.fieldset}>
        <legend>Objectives</legend>
        {draft.objectives.length === 0 ? (
          <p className={styles.muted}>No objectives yet.</p>
        ) : null}
        {draft.objectives.map((objective, index) => (
          <div className={styles.objectiveEdit} key={objective.key}>
            <label>
              Objective {index + 1} title
              <input
                onChange={(event) =>
                  setObjective(index, { title: event.target.value })
                }
                value={objective.title}
              />
            </label>
            <label>
              Objective {index + 1} status
              <select
                onChange={(event) =>
                  setObjective(index, {
                    status: event.target.value as ObjectiveDraft['status'],
                  })
                }
                value={objective.status}
              >
                {OBJECTIVE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label={`Remove objective ${index + 1}`}
              onClick={() =>
                update({
                  objectives: draft.objectives.filter((_, i) => i !== index),
                })
              }
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
        <button onClick={addObjective} type="button">
          Add objective
        </button>
      </fieldset>
    </>
  );
}
