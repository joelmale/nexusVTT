import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/features/section-shell/EmptyState';
import { EntityList } from '@/features/section-shell/EntityList';
import { EntityLink, EntityChip } from '@/features/section-shell/EntityLink';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { StatusBadge } from '@/features/section-shell/StatusBadge';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { AddRow, EditableSection } from '@/features/section-shell/EditableSection';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';
import { resolveEntity } from '@/demo/fixture-registry';

import {
  buildFactionsModel,
  factionForwardIds,
  factionMembers,
} from './factionsModels';
import styles from './FactionsSection.module.css';

const statusToneMap: Record<string, 'positive' | 'warning' | 'danger' | 'neutral'> = {
  ally: 'positive',
  opposition: 'danger',
  neutral: 'neutral',
  unknown: 'warning',
};

export function FactionsSection() {
  const { bundle, basePath } = useSectionBundle();
  const { factionId } = useParams<{ factionId: string }>();
  const { get } = useSectionQuery();

  const status = get('status');
  const sort = get('sort');
  const q = get('q');

  const model = useMemo(
    () => buildFactionsModel(bundle, { status, sort, q }),
    [bundle, status, sort, q],
  );

  const selectedFaction = factionId
    ? bundle.factions.find((f) => f.id === factionId)
    : undefined;

  const groups = model.groups.map((g) => ({
    ...g,
    items: g.factions,
  }));

  const list =
    bundle.factions.length === 0 ? null : (
      <EntityList
        ariaLabel="Factions list"
        getId={(faction) => faction.id}
        getHref={(faction) => `${basePath}/factions/${encodeURIComponent(faction.id)}`}
        groups={groups}
        renderRow={(faction) => (
          <>
            <span>{faction.name}</span>
            <StatusBadge tone={statusToneMap[faction.status]}>
              {faction.status.charAt(0).toUpperCase() + faction.status.slice(1)}
            </StatusBadge>
            {faction.leaderNpcId && (
              <span style={{ fontSize: '0.875rem', color: 'var(--studio-text-secondary)' }}>
                {resolveEntity(bundle, faction.leaderNpcId)?.label || 'Unknown leader'}
              </span>
            )}
          </>
        )}
        selectedId={selectedFaction?.id}
      />
    );

  const detail = selectedFaction ? (
    <EditableSection
      kind="faction"
      id={selectedFaction.id}
      heading={selectedFaction.name}
      initialDraft={{
        name: selectedFaction.name,
        publicFace: selectedFaction.publicFace,
        hiddenAgenda: selectedFaction.hiddenAgenda,
      }}
      renderForm={(draft, setDraft) => (
        <>
          <div className={styles.public}>
            <label>
              <span className={styles.heading}>Name</span>
              <input
                type="text"
                value={String(draft.name ?? '')}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              <span className={styles.heading}>Public Face</span>
              <textarea
                value={String(draft.publicFace ?? '')}
                onChange={(e) => setDraft({ ...draft, publicFace: e.target.value })}
                rows={3}
              />
            </label>
            <label>
              <span className={styles.heading}>Hidden Agenda</span>
              <textarea
                value={String(draft.hiddenAgenda ?? '')}
                onChange={(e) => setDraft({ ...draft, hiddenAgenda: e.target.value })}
                rows={3}
              />
            </label>
          </div>
        </>
      )}
    >
      <div className={styles.detail}>
        {selectedFaction.publicFace && (
          <section>
            <h3 className={styles.heading}>Public Face</h3>
            <p className={styles.value}>{selectedFaction.publicFace}</p>
          </section>
        )}

        {selectedFaction.hiddenAgenda && (
          <section>
            <h3 className={styles.heading}>Hidden Agenda</h3>
            <div style={{ display: 'flex', gap: 'var(--studio-gap-xs)', alignItems: 'center' }}>
              <span className="--studio-badge --studio-badge-warning">DM only</span>
            </div>
            <p className={styles.value}>{selectedFaction.hiddenAgenda}</p>
          </section>
        )}

        {(selectedFaction.alliedFactionIds.length > 0 ||
          selectedFaction.rivalFactionIds.length > 0) && (
          <section>
            <h3 className={styles.heading}>Relations</h3>
            <div className={styles.relations}>
              {selectedFaction.alliedFactionIds.length > 0 && (
                <div className={styles.relationType}>
                  <span className={styles.relationLabel}>Allies:</span>
                  <div className={styles.relationChips}>
                    {selectedFaction.alliedFactionIds.map((factionId) => {
                      const ref = resolveEntity(bundle, factionId);
                      return ref ? <EntityChip key={factionId} entity={ref} /> : null;
                    })}
                  </div>
                </div>
              )}
              {selectedFaction.rivalFactionIds.length > 0 && (
                <div className={styles.relationType}>
                  <span className={styles.relationLabel}>Rivals:</span>
                  <div className={styles.relationChips}>
                    {selectedFaction.rivalFactionIds.map((factionId) => {
                      const ref = resolveEntity(bundle, factionId);
                      return ref ? <EntityChip key={factionId} entity={ref} /> : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {selectedFaction.leaderNpcId && (
          <section>
            <h3 className={styles.heading}>Leader</h3>
            <EntityLink id={selectedFaction.leaderNpcId} />
          </section>
        )}

        <section>
          <h3 className={styles.heading}>Members</h3>
          <div className={styles.membersList}>
            {factionMembers(bundle, selectedFaction.id).map((npc) => (
              <EntityLink key={npc.id} id={npc.id} />
            ))}
          </div>
          {factionMembers(bundle, selectedFaction.id).length === 0 && (
            <p style={{ color: 'var(--studio-text-secondary)' }}>No members yet.</p>
          )}
        </section>

        <RelatedGroups
          entityId={selectedFaction.id}
          forwardIds={factionForwardIds(selectedFaction)}
          exclude={['faction', 'npc']}
        />
      </div>
    </EditableSection>
  ) : undefined;

  return (
    <SectionLayout
      count={model.totalCount}
      detail={detail}
      empty={
        bundle.factions.length === 0 ? (
          <EmptyState
            description='Factions you add will appear here, grouped by status.'
            title="No factions yet."
          />
        ) : undefined
      }
      filters={
        <FilterBar
          facets={[
            {
              allLabel: 'All statuses',
              key: 'status',
              label: 'Status',
              options: model.statusOptions,
            },
          ]}
          plural="factions"
          resultCount={model.visibleCount}
          searchLabel="Search factions"
          singular="faction"
          sortOptions={model.sortOptions}
        />
      }
      list={list}
      notFound={Boolean(factionId) && !selectedFaction}
      selectedId={factionId}
      listFooter={
        <AddRow
          defaults={{ status: 'unknown' }}
          kind="faction"
          label="Add faction"
          nameField="name"
          sectionPath="factions"
        />
      }
      sectionPath="factions"
      title="Factions"
    />
  );
}
