import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import type { CampaignEncounter } from '@/demo/fixture-registry';
import { useCapabilityNotice } from '@/features/capability-notice';
import {
  AddRow,
  EditableSection,
} from '@/features/section-shell/EditableSection';
import { diffDraft } from '@/features/section-shell/draftUtils';
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

import { compositionOf, useDraftRating } from './encounterDraft';
import { DifficultyHint, EncounterEditor } from './EncounterEditor';
import styles from './EncountersSection.module.css';
import {
  buildMonsterCatalog,
  editionOfBundle,
  partyLevelsOf,
  rateComposition,
  storedDifficulty,
} from './monsterCatalog';
import {
  ENCOUNTER_KIND_LABELS,
  RULESET_LABELS,
  TRAP_COMPLEXITY_LABELS,
  buildEncountersModel,
  canDeploy,
  encounterSummaryStats,
  isInNextSession,
  nextSessionId,
  participantTotal,
} from './encountersModels';

const DIFFICULTIES = ['low', 'moderate', 'high'];

export function EncountersSection() {
  const { bundle, basePath, store } = useSectionBundle();
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

  const addRow = (
    <AddRow
      defaults={{
        composition: [],
        difficulty: 'moderate',
        intendedUse: '',
        kind: 'combat',
        tactics: '',
        trigger: '',
      }}
      kind="encounter"
      label="Add encounter"
      nameField="title"
      sectionPath="encounters"
    />
  );

  if (bundle.encounters.length === 0) {
    return (
      <SectionLayout
        empty={
          store.editable ? undefined : (
            <EmptyState
              description="Prepared fights and social scenes will appear here."
              title="No encounters prepared."
            />
          )
        }
        list={
          store.editable ? (
            <p className={styles.muted}>No encounters yet.</p>
          ) : null
        }
        listFooter={addRow}
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
      listFooter={addRow}
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
  const draft = useMemo(
    () => ({
      title: encounter.title,
      kind: encounter.kind,
      trigger: encounter.trigger,
      intendedUse: encounter.intendedUse,
      tactics: encounter.tactics,
      rulesetNotes: encounter.rulesetNotes,
      composition: encounter.composition,
      trapDetails: encounter.trapDetails,
    }),
    [encounter],
  );
  const { catalog, rating, party, edition } = useDraftRating(bundle, draft);

  return (
    <EditableSection
      headerExtras={
        <span className={styles.badges}>
          <StatusBadge tone="neutral">
            {ENCOUNTER_KIND_LABELS[encounter.kind]}
          </StatusBadge>
          <StatusBadge value={encounter.difficulty}>
            {humanize(encounter.difficulty)} difficulty
          </StatusBadge>
          {next ? <StatusBadge tone="info">Next session</StatusBadge> : null}
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
        </span>
      }
      heading={encounter.title}
      id={encounter.id}
      initialDraft={draft}
      kind="encounter"
      renderForm={(current, setDraft) => (
        <EncounterEditor draft={current} setDraft={setDraft} />
      )}
      toPatch={(current, initial) => {
        const patch = diffDraft(current, initial);
        if ('composition' in patch) {
          patch.composition = compositionOf(current).map((part) => ({
            ...part,
            count: Math.max(1, part.count),
          }));
          const rated = rateCompositionFor(bundle, current);
          if (rated) patch.difficulty = storedDifficulty(rated);
        }
        return patch;
      }}
    >
      <div className={styles.body}>
        {encounter.kind === 'trap' || encounter.trapDetails ? (
          <section aria-label="Trap specification" className={styles.trapCard}>
            <h3>Trap & Puzzle Specification</h3>
            <div className={styles.trapPills}>
              <StatusBadge tone="neutral">
                {TRAP_COMPLEXITY_LABELS[encounter.trapDetails?.complexity ?? 'simple']}
              </StatusBadge>
              {encounter.trapDetails?.detectionDc ? (
                <span className={styles.statPill}>
                  Detection: DC {encounter.trapDetails.detectionDc}
                </span>
              ) : null}
              {encounter.trapDetails?.disarmDc ? (
                <span className={styles.statPill}>
                  Disarm: DC {encounter.trapDetails.disarmDc}
                </span>
              ) : null}
              {encounter.trapDetails?.initiativeOrTimer ? (
                <span className={styles.statPill}>
                  Timer/Initiative: {encounter.trapDetails.initiativeOrTimer}
                </span>
              ) : null}
              {encounter.trapDetails?.saveOrAttack ? (
                <span className={styles.statPill}>
                  Attack/Save: {encounter.trapDetails.saveOrAttack}
                </span>
              ) : null}
            </div>
            {encounter.trapDetails?.trigger ? (
              <div className={styles.trapField}>
                <strong>Trigger:</strong>
                <p>{encounter.trapDetails.trigger}</p>
              </div>
            ) : null}
            {encounter.trapDetails?.effect ? (
              <div className={styles.trapField}>
                <strong>Harm / Effect:</strong>
                <p>{encounter.trapDetails.effect}</p>
              </div>
            ) : null}
            {encounter.trapDetails?.countermeasures ? (
              <div className={styles.trapField}>
                <strong>Countermeasures & Puzzle Solution:</strong>
                <p>{encounter.trapDetails.countermeasures}</p>
              </div>
            ) : null}
            {encounter.trapDetails?.reset ? (
              <div className={styles.trapField}>
                <strong>Reset:</strong>
                <p>{encounter.trapDetails.reset}</p>
              </div>
            ) : null}
          </section>
        ) : null}

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
            <p className={styles.muted}>
              {encounter.kind === 'trap'
                ? 'Mechanical / environmental hazard with no hostile creatures.'
                : 'No participants listed.'}
            </p>
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
                    <td>
                      {part.nonCreature
                        ? 'Hazard'
                        : part.monsterKey?.startsWith('homebrew:')
                          ? 'Homebrew'
                          : (RULESET_LABELS[part.ruleset] ?? part.ruleset)}
                    </td>
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
          {catalog.length > 0 && compositionOf(draft).length > 0 ? (
            <DifficultyHint
              edition={edition}
              party={party.length}
              rating={rating}
            />
          ) : null}
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
      </div>
    </EditableSection>
  );
}

/** Rating for a draft, or undefined when it cannot be rated. */
function rateCompositionFor(
  bundle: ReturnType<typeof useSectionBundle>['bundle'],
  draft: Record<string, unknown>,
) {
  const catalog = buildMonsterCatalog(bundle.homebrewMonsters);
  return rateComposition(
    compositionOf(draft),
    catalog,
    partyLevelsOf(bundle),
    editionOfBundle(bundle),
  ).result?.rating;
}
