import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import type { CampaignEncounter } from '@/demo/fixture-registry';
import { useCapabilityNotice } from '@/features/capability-notice';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { EntityList } from '@/features/section-shell/EntityList';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import { DmOnlyBadge, StatusBadge } from '@/features/section-shell/StatusBadge';
import { humanize } from '@/features/section-shell/statusTones';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import styles from './EncountersSection.module.css';
import {
  ENCOUNTER_KIND_LABELS,
  RULESET_LABELS,
  buildEncountersModel,
  canDeploy,
  encounterSummaryStats,
  isInNextSession,
  nextSessionId,
  participantTotal,
} from './encountersModels';

const DIFFICULTIES = ['low', 'moderate', 'high'];

export function EncountersSection() {
  const { bundle, basePath } = useSectionBundle();
  const { encounterId } = useParams();
  const { get } = useSectionQuery();

  const q = get('q');
  const kind = get('kind');
  const difficulty = get('difficulty');
  const sort = get('sort');
  const rows = useMemo(
    () => buildEncountersModel(bundle, { q, kind, difficulty, sort }),
    [bundle, q, kind, difficulty, sort],
  );

  if (bundle.encounters.length === 0) {
    return (
      <SectionLayout
        empty={
          <EmptyState
            description="Prepared fights and social scenes will appear here."
            title="No encounters prepared."
          />
        }
        list={null}
        sectionPath="encounters"
        title="Encounters"
      />
    );
  }

  const selected = encounterId
    ? bundle.encounters.find((encounter) => encounter.id === encounterId)
    : undefined;
  const kinds = Array.from(new Set(bundle.encounters.map((item) => item.kind)));
  const hasNext = Boolean(nextSessionId(bundle));

  return (
    <SectionLayout
      count={bundle.encounters.length}
      detail={selected ? <EncounterDetail encounter={selected} /> : undefined}
      filters={
        <FilterBar
          facets={[
            {
              key: 'kind',
              label: 'Kind',
              options: kinds.map((value) => ({
                value,
                label: ENCOUNTER_KIND_LABELS[value],
              })),
            },
            {
              key: 'difficulty',
              label: 'Difficulty',
              options: DIFFICULTIES.map((value) => ({
                value,
                label: humanize(value),
              })),
            },
          ]}
          plural="encounters"
          resultCount={rows.length}
          searchLabel="Search encounters"
          singular="encounter"
          sortOptions={[
            { value: 'title', label: 'Title' },
            { value: 'difficulty', label: 'Difficulty' },
            ...(hasNext ? [{ value: 'next', label: 'Next session' }] : []),
          ]}
        />
      }
      list={
        <EntityList
          ariaLabel="Encounter list"
          getHref={(row) =>
            `${basePath}/encounters/${encodeURIComponent(row.encounter.id)}`
          }
          getId={(row) => row.encounter.id}
          groups={[{ id: 'all', items: rows }]}
          renderRow={(row) => (
            <span className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{row.encounter.title}</span>
                <span className={styles.rowKind}>
                  {ENCOUNTER_KIND_LABELS[row.encounter.kind]}
                </span>
              </span>
              <span className={styles.rowMeta}>
                {row.inNextSession ? (
                  <StatusBadge tone="info">Next session</StatusBadge>
                ) : null}
                <StatusBadge value={row.encounter.difficulty} />
                <span
                  aria-label={`${row.total} participants`}
                  className={styles.total}
                >
                  {row.total}
                </span>
              </span>
            </span>
          )}
          selectedId={encounterId}
        />
      }
      notFound={Boolean(encounterId) && !selected}
      sectionPath="encounters"
      selectedId={encounterId}
      summary={
        <SectionSummary
          stats={encounterSummaryStats(bundle)}
          title="Encounters at a glance"
        />
      }
      title="Encounters"
    />
  );
}

function EncounterDetail({ encounter }: { encounter: CampaignEncounter }) {
  const { bundle, exampleSlug } = useSectionBundle();
  const { notifyCapability } = useCapabilityNotice();
  const total = participantTotal(encounter);
  const next = isInNextSession(bundle, encounter);

  return (
    <article aria-labelledby="encounter-heading" className={styles.detail}>
      <header className={styles.header}>
        <h2 id="encounter-heading">{encounter.title}</h2>
        <span className={styles.badges}>
          <StatusBadge tone="neutral">
            {ENCOUNTER_KIND_LABELS[encounter.kind]}
          </StatusBadge>
          <StatusBadge value={encounter.difficulty}>
            {humanize(encounter.difficulty)} difficulty
          </StatusBadge>
          {next ? <StatusBadge tone="info">Next session</StatusBadge> : null}
        </span>
        {canDeploy(bundle) ? (
          <button
            className={styles.deploy}
            onClick={() =>
              notifyCapability(
                exampleSlug ? 'encounter.deploy.demo' : 'encounter.deploy',
              )
            }
            type="button"
          >
            Deploy to VTT
          </button>
        ) : null}
      </header>

      {encounter.trigger ? (
        <section>
          <h3>Trigger</h3>
          <p>{encounter.trigger}</p>
        </section>
      ) : null}
      {encounter.intendedUse ? (
        <section>
          <h3>Intended use</h3>
          <p>{encounter.intendedUse}</p>
        </section>
      ) : null}

      <section>
        <h3>Composition</h3>
        {encounter.composition.length === 0 ? (
          <p className={styles.muted}>No participants listed.</p>
        ) : (
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              Composition of {encounter.title}
            </caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Count</th>
                <th scope="col">Role</th>
                <th scope="col">Ruleset</th>
              </tr>
            </thead>
            <tbody>
              {encounter.composition.map((part, index) => (
                <tr key={`${part.name}-${index}`}>
                  <th scope="row">{part.name}</th>
                  <td>{part.count}</td>
                  <td>{part.role}</td>
                  <td>{RULESET_LABELS[part.ruleset] ?? part.ruleset}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total participants</th>
                <td>{total}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {encounter.tactics ? (
        <section>
          <h3>
            Tactics <DmOnlyBadge />
          </h3>
          <p>{encounter.tactics}</p>
        </section>
      ) : null}
      {encounter.rulesetNotes ? (
        <section>
          <h3>Ruleset notes</h3>
          <p>{encounter.rulesetNotes}</p>
        </section>
      ) : null}

      <RelatedGroups
        entityId={encounter.id}
        forwardIds={[
          ...encounter.locationIds,
          ...encounter.factionIds,
          ...encounter.sessionIds,
        ]}
        kinds={['location', 'faction', 'session']}
      />
    </article>
  );
}
