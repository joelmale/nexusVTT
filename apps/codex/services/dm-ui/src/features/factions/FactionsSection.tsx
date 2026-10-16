import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Dices from 'lucide-react/dist/esm/icons/dices';
import Network from 'lucide-react/dist/esm/icons/network';

import { EmptyState } from '@/features/section-shell/EmptyState';
import { EntityList } from '@/features/section-shell/EntityList';
import { EntityLink, EntityChip } from '@/features/section-shell/EntityLink';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { StatusBadge } from '@/features/section-shell/StatusBadge';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { AddRow, EditableSection } from '@/features/section-shell/EditableSection';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';
import { resolveEntity } from '@/demo/fixture-registry';

import {
  buildFactionsModel,
  campaignFactionsToGeneratedFactions,
  factionForwardIds,
  factionMembers,
} from './factionsModels';
import { FactionGeneratorModal } from './FactionGeneratorModal';
import { FactionRelationshipMap } from './FactionRelationshipMap';
import styles from './FactionsSection.module.css';

const statusToneMap: Record<string, 'positive' | 'warning' | 'danger' | 'neutral'> = {
  ally: 'positive',
  opposition: 'danger',
  neutral: 'neutral',
  unknown: 'warning',
};

export function FactionsSection() {
  const navigate = useNavigate();
  const { bundle, basePath, store } = useSectionBundle();
  const { factionId } = useParams<{ factionId: string }>();
  const { get } = useSectionQuery();
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);

  const status = get('status');
  const sort = get('sort');
  const q = get('q');

  const model = useMemo(
    () => buildFactionsModel(bundle, { status, sort, q }),
    [bundle, status, sort, q],
  );

  const generatedFactions = useMemo(
    () => campaignFactionsToGeneratedFactions(bundle.factions),
    [bundle.factions],
  );

  const selectedFaction = factionId
    ? bundle.factions.find((f) => f.id === factionId)
    : undefined;

  const groups = model.groups.map((g) => ({
    ...g,
    items: g.factions,
  }));

  const addRow = (
    <AddRow
      defaults={{ status: 'unknown' }}
      kind="faction"
      label="Add faction"
      nameField="name"
      sectionPath="factions"
    />
  );

  const footerActions = (
    <div className={styles.footerActions}>
      {addRow}
      {bundle.factions.length > 1 && (
        <button
          className={styles.webButton}
          onClick={() => navigate(`${basePath}/factions`)}
          title="View relationship web"
          type="button"
        >
          <Network size={15} />
          Relationship Web
        </button>
      )}
      {store.editable ? (
        <button
          className={styles.generatorButton}
          onClick={() => setShowGeneratorModal(true)}
          title="Procedurally generate individual factions or political webs"
          type="button"
        >
          <Dices size={15} />
          Generate Factions
        </button>
      ) : null}
      {showGeneratorModal && (
        <FactionGeneratorModal
          open={showGeneratorModal}
          onClose={() => setShowGeneratorModal(false)}
          onCreated={(id) => {
            navigate(`${basePath}/factions/${encodeURIComponent(id)}`);
          }}
        />
      )}
    </div>
  );

  const actions = selectedFaction ? (
    <div className={styles.headerActions}>
      <button
        type="button"
        className={styles.headerButton}
        onClick={() => navigate(`${basePath}/factions`)}
        title="View all faction relationships"
      >
        <Network size={14} />
        Relationship Web
      </button>
    </div>
  ) : undefined;

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
      listPath="factions"
      kind="faction"
      id={selectedFaction.id}
      heading={selectedFaction.name}
      initialDraft={{
        name: selectedFaction.name,
        status: selectedFaction.status,
        leaderNpcId: selectedFaction.leaderNpcId ?? '',
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
              <span className={styles.heading}>Status</span>
              <select
                value={String(draft.status ?? 'unknown')}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                <option value="opposition">Opposition</option>
                <option value="unknown">Unknown</option>
                <option value="neutral">Neutral</option>
                <option value="ally">Ally</option>
              </select>
            </label>
            <label>
              <span className={styles.heading}>Leader</span>
              <select
                value={String(draft.leaderNpcId ?? '')}
                onChange={(e) => setDraft({ ...draft, leaderNpcId: e.target.value })}
              >
                <option value="">No leader</option>
                {bundle.npcs.map((npc) => (
                  <option key={npc.id} value={npc.id}>
                    {npc.name}
                  </option>
                ))}
              </select>
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
      toPatch={(draft, initial) => {
        const patch: Record<string, unknown> = {};
        if (draft.name !== initial.name) patch.name = String(draft.name ?? '').trim();
        if (draft.status !== initial.status) patch.status = draft.status;
        if (draft.leaderNpcId !== initial.leaderNpcId) {
          patch.leaderNpcId = draft.leaderNpcId ? String(draft.leaderNpcId) : '';
        }
        if (draft.publicFace !== initial.publicFace) patch.publicFace = String(draft.publicFace ?? '').trim();
        if (draft.hiddenAgenda !== initial.hiddenAgenda) patch.hiddenAgenda = String(draft.hiddenAgenda ?? '').trim();
        return patch;
      }}
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
          selectedFaction.rivalFactionIds.length > 0 ||
          bundle.factions.length > 1) && (
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
            {bundle.factions.length > 1 && (
              <div className={styles.detailMapCard}>
                <FactionRelationshipMap
                  factions={generatedFactions}
                  selectedFactionId={selectedFaction.id}
                  title={`${selectedFaction.name} Relations`}
                  onSelectFaction={(id) => {
                    navigate(`${basePath}/factions/${encodeURIComponent(id)}`);
                  }}
                />
              </div>
            )}
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

  const summary = (
    <div className={styles.summaryContainer}>
      <SectionSummary
        title="Faction Overview"
        stats={[
          { label: 'Total', value: model.totalCount },
          {
            label: 'Allies',
            value: bundle.factions.filter((f) => f.status === 'ally').length,
          },
          {
            label: 'Rivals',
            value: bundle.factions.filter((f) => f.status === 'opposition').length,
          },
          {
            label: 'Neutral',
            value: bundle.factions.filter((f) => f.status === 'neutral').length,
          },
        ]}
      >
        <p className={styles.summaryHint}>
          Select a faction to inspect its leadership, hidden agenda, and allies, or click any node in the relationship web below to jump to its dossier.
        </p>
      </SectionSummary>
      {bundle.factions.length > 0 && (
        <div className={styles.mapCard}>
          <FactionRelationshipMap
            factions={generatedFactions}
            title="Faction Relationships"
            onSelectFaction={(id) => {
              navigate(`${basePath}/factions/${encodeURIComponent(id)}`);
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <SectionLayout
      actions={actions}
      count={model.totalCount}
      detail={detail}
      empty={
        bundle.factions.length === 0 ? (
          <EmptyState
            action={footerActions}
            description={
              store.editable
                ? 'Add the first faction or procedurally generate an interconnected faction web to start tracking campaign allegiances and rivals.'
                : 'Factions you add will appear here, grouped by status.'
            }
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
      listFooter={footerActions}
      sectionPath="factions"
      summary={summary}
      title="Factions"
    />
  );
}
