import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { EntityList } from '@/features/section-shell/EntityList';
import { EntityLink, EntityChip } from '@/features/section-shell/EntityLink';
import { StatusBadge } from '@/features/section-shell/StatusBadge';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { AddRow, EditableSection } from '@/features/section-shell/EditableSection';
import { useSectionBundle, useSectionQuery } from '@/features/section-shell/SectionContext';
import { resolveEntity } from '@/demo/fixture-registry';

import {
  buildFactionsModel,
  factionForwardIds,
  factionMembers,
  type FactionsQuery,
} from './factionsModels';
import styles from './FactionsSection.module.css';

export function FactionsSection() {
  const { bundle } = useSectionBundle();
  const { factionId } = useParams<{ factionId: string }>();
  const { query, setQuery } = useSectionQuery<FactionsQuery>();

  const model = useMemo(
    () => buildFactionsModel(bundle, query),
    [bundle, query],
  );

  const selectedFaction =
    factionId && bundle.factions.find((f) => f.id === factionId)
      ? bundle.factions.find((f) => f.id === factionId)
      : undefined;

  const getHref = (id: string) => `factions/${encodeURIComponent(id)}`;

  const statusToneMap: Record<string, 'positive' | 'warning' | 'danger' | 'neutral'> = {
    ally: 'positive',
    opposition: 'danger',
    neutral: 'neutral',
    unknown: 'warning',
  };

  return (
    <>
      <EntityList
        groups={model.groups}
        selectedId={selectedFaction?.id}
        getHref={getHref}
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
      />

      {selectedFaction ? (
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
                    value={draft.name ?? ''}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label>
                  <span className={styles.heading}>Public Face</span>
                  <textarea
                    value={draft.publicFace ?? ''}
                    onChange={(e) => setDraft({ ...draft, publicFace: e.target.value })}
                    rows={3}
                  />
                </label>
                <label>
                  <span className={styles.heading}>Hidden Agenda</span>
                  <textarea
                    value={draft.hiddenAgenda ?? ''}
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
                        {selectedFaction.alliedFactionIds.map((factionId) => (
                          <EntityChip
                            key={factionId}
                            entity={resolveEntity(bundle, factionId)!}
                            tone="positive"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedFaction.rivalFactionIds.length > 0 && (
                    <div className={styles.relationType}>
                      <span className={styles.relationLabel}>Rivals:</span>
                      <div className={styles.relationChips}>
                        {selectedFaction.rivalFactionIds.map((factionId) => (
                          <EntityChip
                            key={factionId}
                            entity={resolveEntity(bundle, factionId)!}
                            tone="danger"
                          />
                        ))}
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
      ) : null}

      <AddRow
        kind="faction"
        label="Add faction"
        nameField="name"
        defaults={{ status: 'unknown' }}
        sectionPath="factions"
      />
    </>
  );
}
