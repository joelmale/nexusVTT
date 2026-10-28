import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Layers from 'lucide-react/dist/esm/icons/layers';
import Play from 'lucide-react/dist/esm/icons/play';
import Swords from 'lucide-react/dist/esm/icons/swords';
import X from 'lucide-react/dist/esm/icons/x';

import type { CampaignEncounter, CampaignFixtureBundle } from '@/demo/fixture-registry';
import { resolveEntity } from '@/demo/fixture-registry';
import { useCapabilityNotice } from '@/features/capability-notice';
import {
  AddRow,
  EditableSection,
} from '@/features/section-shell/EditableSection';
import { diffDraft } from '@/features/section-shell/draftUtils';
import { EmptyState } from '@/features/section-shell/EmptyState';
import { EntityList } from '@/features/section-shell/EntityList';
import { FilterBar } from '@/features/section-shell/FilterBar';
import { HeldItems } from '@/features/items/HeldItems';
import { RelatedGroups } from '@/features/section-shell/RelatedGroups';
import { RichEntityRow } from '@/features/section-shell/RichEntityRow';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { SectionLayout } from '@/features/section-shell/SectionLayout';
import { SectionSummary } from '@/features/section-shell/SectionSummary';
import { DmOnlyBadge, StatusBadge } from '@/features/section-shell/StatusBadge';
import { humanize } from '@/features/section-shell/statusTones';
import { sortByPinned } from '@/features/section-shell/entityMeta';
import { UseInNextSessionButton } from '@/features/section-shell/UseInNextSessionButton';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';
import { usePlayerView } from '@/features/player-view';
import {
  addEncounterBeatToSessionPlan,
  deployEncounterToTable,
  getActiveSessionPlan,
  materializeEncounter,
  type ActiveSessionPlanResult,
  type EncounterMonsterStats,
} from '@/services/studioApi';

import layoutStyles from '@/features/section-shell/SectionLayout.module.css';
import tabStyles from '@/features/section-shell/SectionTabs.module.css';
import { HomebrewMonstersPane } from './HomebrewMonstersPane';
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
  const { get, set, clear } = useSectionQuery();

  const tabParam = get('tab');
  const currentTab = tabParam === 'bestiary' ? 'bestiary' : 'encounters';
  const homebrewCount = (bundle.homebrewMonsters ?? []).length;

  const q = get('q');
  const kind = get('kind');
  const difficulty = get('difficulty');
  const sort = get('sort');
  const rows = useMemo(
    () => buildEncountersModel(bundle, { q, kind, difficulty, sort }),
    [bundle, q, kind, difficulty, sort],
  );
  const pinnedIds = bundle.pinnedObjectIds;
  const sortedRows = useMemo(
    () => sortByPinned(rows, (r) => r.encounter.id, pinnedIds),
    [rows, pinnedIds],
  );

  const tabsElement = (
    <div aria-label="Encounter tabs" className={tabStyles.tablist} role="tablist">
      <button
        aria-selected={currentTab === 'encounters'}
        className={`${tabStyles.tab} ${currentTab === 'encounters' ? tabStyles.selected : ''}`}
        onClick={() => clear()}
        role="tab"
        type="button"
      >
        <span>Encounters</span>
        <span className={tabStyles.count}>{bundle.encounters.length}</span>
      </button>
      <button
        aria-selected={currentTab === 'bestiary'}
        className={`${tabStyles.tab} ${currentTab === 'bestiary' ? tabStyles.selected : ''}`}
        onClick={() => {
          clear();
          set('tab', 'bestiary');
        }}
        role="tab"
        type="button"
      >
        <span>Homebrew Bestiary</span>
        <span className={tabStyles.count}>{homebrewCount}</span>
      </button>
    </div>
  );

  if (currentTab === 'bestiary') {
    return (
      <section className={layoutStyles.section} data-section="bestiary">
        <header className={layoutStyles.header}>
          <div className={layoutStyles.titleRow}>
            <h1>Encounters</h1>
          </div>
          {tabsElement}
        </header>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <HomebrewMonstersPane />
        </div>
      </section>
    );
  }

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
        tabs={tabsElement}
        title="Encounters"
      />
    );
  }

  const selected = encounterId
    ? bundle.encounters.find((encounter) => encounter.id === encounterId)
    : undefined;
  const kinds = Array.from(new Set(bundle.encounters.map((item) => item.kind)));
  const hasNext = Boolean(nextSessionId(bundle));

  const list = (
    <EntityList
      ariaLabel="Encounter list"
      getHref={(row) =>
        `${basePath}/encounters/${encodeURIComponent(row.encounter.id)}`
      }
      getId={(row) => row.encounter.id}
      groups={[{ id: 'all', items: sortedRows }]}
      renderRow={(row) => {
        const metaParts: Array<{ key: string; content: React.ReactNode }> = [];
        if (row.encounter.locationIds?.[0]) {
          const loc = resolveEntity(bundle, row.encounter.locationIds[0]);
          if (loc) {
            metaParts.push({ key: 'loc', content: loc.label });
          }
        }
        metaParts.push({
          key: 'participants',
          content: (
            <span
              aria-label={`${row.total} participants`}
              className={styles.total}
            >
              {row.total} participants
            </span>
          ),
        });

        const badges = (
          <>
            {row.inNextSession ? (
              <StatusBadge tone="info">Next session</StatusBadge>
            ) : null}
            <StatusBadge value={row.encounter.difficulty} />
          </>
        );

        return (
          <RichEntityRow
            badges={badges}
            icon={<Swords size={15} />}
            isPinned={pinnedIds?.includes(row.encounter.id)}
            metaParts={metaParts}
            subtitle={ENCOUNTER_KIND_LABELS[row.encounter.kind]}
            title={row.encounter.title}
          />
        );
      }}
      selectedId={encounterId}
    />
  );

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
      list={list}
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
      tabs={tabsElement}
      title="Encounters"
    />
  );
}

function getMonsterStatsForEncounter(
  encounter: CampaignEncounter,
  bundle: CampaignFixtureBundle,
): EncounterMonsterStats[] {
  const catalog = buildMonsterCatalog(bundle.homebrewMonsters);
  return encounter.composition
    .filter((row) => !row.nonCreature && row.count > 0)
    .map((row) => {
      const match = catalog.find(
        (m) =>
          (row.monsterKey && m.key === row.monsterKey) ||
          m.name.toLowerCase() === row.name.toLowerCase(),
      );
      if (match) {
        return {
          key: match.key,
          name: (row as unknown as { customName?: string }).customName || match.name,
          cr: row.cr || match.cr,
          ac: match.ac,
          hp: (row as unknown as { fixedHp?: number }).fixedHp ?? match.hp,
          speed: match.speed,
          abilities: [...match.abilities],
        };
      }
      return {
        key: row.monsterKey || `custom:${row.name}`,
        name: (row as unknown as { customName?: string }).customName || row.name,
        cr: row.cr || '1',
        ac: 10,
        hp: (row as unknown as { fixedHp?: number }).fixedHp ?? 10,
        speed: 30,
        abilities: [10, 10, 10, 10, 10, 10],
      };
    });
}

function EncounterDetail({ encounter }: { encounter: CampaignEncounter }) {
  const { bundle, exampleSlug, store } = useSectionBundle();
  const { notifyCapability } = useCapabilityNotice();
  const [deployModalOpen, setDeployModalOpen] = useState(false);
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
      hpPolicy: (encounter as unknown as { hpPolicy?: string }).hpPolicy ?? 'average',
      initiativePolicy:
        (encounter as unknown as { initiativePolicy?: string }).initiativePolicy ??
        'individual',
    }),
    [encounter],
  );
  const { catalog, rating, party, edition } = useDraftRating(bundle, draft);

  return (
    <>
      <EditableSection
        listPath="encounters"
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
                onClick={() => {
                  if (store.editable) {
                    setDeployModalOpen(true);
                  } else {
                    notifyCapability(
                      exampleSlug ? 'encounter.deploy.demo' : 'encounter.deploy',
                    );
                  }
                }}
                type="button"
              >
                Deploy to VTT
              </button>
            ) : null}
          </span>
        }
        playerHeaderExtras={
          <span className={styles.badges}>
            <StatusBadge tone="neutral">
              {ENCOUNTER_KIND_LABELS[encounter.kind]}
            </StatusBadge>
          </span>
        }
        heading={encounter.title}
        headerActions={
          <UseInNextSessionButton kind="encounter" id={encounter.id} />
        }
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
        <EncounterDetailContent
          catalog={catalog}
          draft={draft}
          edition={edition}
          encounter={encounter}
          party={party}
          rating={rating}
          total={total}
        />
      </EditableSection>

      {deployModalOpen ? (
        <DeployEncounterModal
          bundle={bundle}
          encounter={encounter}
          isOpen={deployModalOpen}
          onClose={() => setDeployModalOpen(false)}
        />
      ) : null}
    </>
  );
}

interface DeployEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: CampaignEncounter;
  bundle: CampaignFixtureBundle;
}

export function DeployEncounterModal({
  isOpen,
  onClose,
  encounter,
  bundle,
}: DeployEncounterModalProps) {
  const [loading, setLoading] = useState(false);
  const [activePlan, setActivePlan] = useState<ActiveSessionPlanResult | null>(null);
  const [deployMode, setDeployMode] = useState<'table' | 'session-plan'>('table');
  const [sceneId, setSceneId] = useState('');
  const [hiddenFromPlayers, setHiddenFromPlayers] = useState(false);
  const [anchorX, setAnchorX] = useState(0);
  const [anchorY, setAnchorY] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    getActiveSessionPlan(bundle.campaignId)
      .then((res) => {
        if (!active) return;
        setActivePlan(res);
        if (res?.plan) {
          const firstScene = res.plan.steps?.find(
            (s) => s.type === 'activate-scene' || s.type === 'scene',
          );
          if (firstScene && typeof firstScene.objectId === 'string') {
            setSceneId(firstScene.objectId);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not inspect active session plan:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, bundle.campaignId]);

  if (!isOpen) return null;

  const handleDeployToTable = async () => {
    setIsDeploying(true);
    setStatusMessage(null);
    try {
      const monsters = getMonsterStatsForEncounter(encounter, bundle);
      const materialized = await materializeEncounter(
        bundle.campaignId,
        encounter.id,
        monsters,
      );

      if (sceneId.trim()) {
        const cmdRes = await deployEncounterToTable(
          bundle.campaignId,
          materialized.encounterRef,
          sceneId.trim(),
          {
            anchorPosition: { x: anchorX, y: anchorY },
            hiddenFromPlayers,
          },
        );

        if (!cmdRes.success) {
          setStatusMessage({
            tone: 'error',
            text: cmdRes.error || 'Failed to dispatch DeployEncounter command.',
          });
          return;
        }

        setStatusMessage({
          tone: 'success',
          text: `Encounter "${encounter.title}" deployed to table scene! (${materialized.monsterCount} creatures placed)`,
        });
      } else {
        setStatusMessage({
          tone: 'success',
          text: `Encounter "${encounter.title}" materialized and pinned (Revision ${materialized.encounterRef.revision})! Ready to spawn on your active scene.`,
        });
      }
    } catch (err) {
      setStatusMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Failed to deploy encounter.',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleAddToPlan = async () => {
    setIsDeploying(true);
    setStatusMessage(null);
    try {
      const monsters = getMonsterStatsForEncounter(encounter, bundle);
      const targetPlanId =
        activePlan?.plan.id ||
        bundle.sessions?.[0]?.id;

      if (!targetPlanId) {
        setStatusMessage({
          tone: 'error',
          text: 'No session plan found in this campaign to add this beat to.',
        });
        return;
      }

      const result = await addEncounterBeatToSessionPlan(
        bundle.campaignId,
        targetPlanId,
        encounter.id,
        encounter.title,
        monsters,
      );

      setStatusMessage({
        tone: 'success',
        text: `Encounter beat added to session plan! Step ID: ${result.stepId}`,
      });
    } catch (err) {
      setStatusMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Failed to add encounter beat.',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div
      aria-labelledby="deploy-encounter-title"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--studio-surface, #1e1e24)',
          border: '1px solid var(--studio-border, rgba(255, 255, 255, 0.12))',
          borderRadius: 'var(--studio-radius-panel, 8px)',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px',
          color: 'var(--studio-text, #ffffff)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--studio-border, rgba(255, 255, 255, 0.1))',
            paddingBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Swords size={20} style={{ color: 'var(--studio-primary, #6366f1)' }} />
            <h2
              id="deploy-encounter-title"
              style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}
            >
              Deploy Encounter to VTT
            </h2>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--studio-text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '4px',
            }}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '14px', color: 'var(--studio-text-muted, #cbd5e1)' }}>
          Target: <strong>{encounter.title}</strong> ({participantTotal(encounter)} participants)
        </div>

        {loading ? (
          <p style={{ margin: 0, color: 'var(--studio-text-muted)' }}>
            Checking active session plan status...
          </p>
        ) : activePlan ? (
          <div
            style={{
              background: 'var(--studio-surface-raised, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--studio-border)',
              borderRadius: 'var(--studio-radius-control, 6px)',
              padding: '10px 12px',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Play size={14} style={{ color: 'var(--studio-success, #22c55e)' }} />
              <strong>Active Session Plan:</strong> {activePlan.plan.title}
            </div>
            <span style={{ color: 'var(--studio-text-muted)' }}>
              Step {activePlan.activation.currentStepIndex + 1} of{' '}
              {activePlan.plan.steps.length}
            </span>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--studio-surface-raised, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--studio-border)',
              borderRadius: 'var(--studio-radius-control, 6px)',
              padding: '10px 12px',
              fontSize: '13px',
              color: 'var(--studio-text-muted)',
            }}
          >
            No active session plan currently running on the table.
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setDeployMode('table')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--studio-radius-control, 6px)',
              border:
                deployMode === 'table'
                  ? '1px solid var(--studio-primary, #6366f1)'
                  : '1px solid var(--studio-border, rgba(255, 255, 255, 0.1))',
              background:
                deployMode === 'table'
                  ? 'var(--studio-surface-raised, rgba(99, 102, 241, 0.15))'
                  : 'transparent',
              color: 'var(--studio-text, #ffffff)',
              fontWeight: deployMode === 'table' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px',
            }}
            type="button"
          >
            Deploy Directly to Table
          </button>
          <button
            onClick={() => setDeployMode('session-plan')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--studio-radius-control, 6px)',
              border:
                deployMode === 'session-plan'
                  ? '1px solid var(--studio-primary, #6366f1)'
                  : '1px solid var(--studio-border, rgba(255, 255, 255, 0.1))',
              background:
                deployMode === 'session-plan'
                  ? 'var(--studio-surface-raised, rgba(99, 102, 241, 0.15))'
                  : 'transparent',
              color: 'var(--studio-text, #ffffff)',
              fontWeight: deployMode === 'session-plan' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px',
            }}
            type="button"
          >
            Add to Session Plan
          </button>
        </div>

        {deployMode === 'table' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
              Scene ID (optional, leave blank to pin definitions only)
              <input
                aria-label="Scene ID"
                onChange={(e) => setSceneId(e.target.value)}
                placeholder="e.g. scene-uuid or active scene"
                style={{
                  background: 'var(--studio-surface-raised, rgba(255, 255, 255, 0.06))',
                  border: '1px solid var(--studio-border-strong, #475569)',
                  borderRadius: 'var(--studio-radius-control, 6px)',
                  color: 'inherit',
                  padding: '6px 10px',
                  fontSize: '14px',
                }}
                value={sceneId}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                Anchor X
                <input
                  aria-label="Anchor X"
                  onChange={(e) => setAnchorX(Number(e.target.value) || 0)}
                  style={{
                    background: 'var(--studio-surface-raised, rgba(255, 255, 255, 0.06))',
                    border: '1px solid var(--studio-border-strong, #475569)',
                    borderRadius: 'var(--studio-radius-control, 6px)',
                    color: 'inherit',
                    padding: '6px 10px',
                    fontSize: '14px',
                  }}
                  type="number"
                  value={anchorX}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                Anchor Y
                <input
                  aria-label="Anchor Y"
                  onChange={(e) => setAnchorY(Number(e.target.value) || 0)}
                  style={{
                    background: 'var(--studio-surface-raised, rgba(255, 255, 255, 0.06))',
                    border: '1px solid var(--studio-border-strong, #475569)',
                    borderRadius: 'var(--studio-radius-control, 6px)',
                    color: 'inherit',
                    padding: '6px 10px',
                    fontSize: '14px',
                  }}
                  type="number"
                  value={anchorY}
                />
              </label>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                aria-label="Hidden from players"
                checked={hiddenFromPlayers}
                onChange={(e) => setHiddenFromPlayers(e.target.checked)}
                type="checkbox"
              />
              Spawn tokens hidden from players (Fog of War / GM Layer)
            </label>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--studio-text-muted)' }}>
              Adds this encounter as a pinned <code>deploy-encounter</code> beat to the session plan.
              During the live game, advancing to this step will spawn the encounter onto the current scene.
            </p>
          </div>
        )}

        {statusMessage ? (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--studio-radius-control, 6px)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background:
                statusMessage.tone === 'success'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : statusMessage.tone === 'error'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(99, 102, 241, 0.15)',
              color:
                statusMessage.tone === 'success'
                  ? 'var(--studio-success, #22c55e)'
                  : statusMessage.tone === 'error'
                    ? 'var(--studio-danger, #ef4444)'
                    : 'var(--studio-info, #6366f1)',
              border: `1px solid ${
                statusMessage.tone === 'success'
                  ? 'var(--studio-success, #22c55e)'
                  : statusMessage.tone === 'error'
                    ? 'var(--studio-danger, #ef4444)'
                    : 'var(--studio-info, #6366f1)'
              }`,
            }}
          >
            {statusMessage.tone === 'success' ? (
              <CheckCircle size={16} />
            ) : statusMessage.tone === 'error' ? (
              <AlertCircle size={16} />
            ) : (
              <Layers size={16} />
            )}
            <span>{statusMessage.text}</span>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            borderTop: '1px solid var(--studio-border, rgba(255, 255, 255, 0.1))',
            paddingTop: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--studio-radius-control, 6px)',
              border: '1px solid var(--studio-border, rgba(255, 255, 255, 0.15))',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            type="button"
          >
            Close
          </button>
          <button
            disabled={isDeploying}
            onClick={() => {
              if (deployMode === 'table') {
                void handleDeployToTable();
              } else {
                void handleAddToPlan();
              }
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--studio-radius-control, 6px)',
              border: 'none',
              background: 'var(--studio-primary, #6366f1)',
              color: '#ffffff',
              fontWeight: 600,
              cursor: isDeploying ? 'not-allowed' : 'pointer',
              opacity: isDeploying ? 0.7 : 1,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            type="button"
          >
            {isDeploying
              ? 'Deploying…'
              : deployMode === 'table'
                ? 'Deploy to Table'
                : 'Add Beat to Session Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EncounterDetailContent({
  catalog,
  draft,
  edition,
  encounter,
  party,
  rating,
  total,
}: {
  catalog: ReturnType<typeof useDraftRating>['catalog'];
  draft: Record<string, unknown>;
  edition: ReturnType<typeof useDraftRating>['edition'];
  encounter: CampaignEncounter;
  party: ReturnType<typeof useDraftRating>['party'];
  rating: ReturnType<typeof useDraftRating>['rating'];
  total: number;
}) {
  const { isPlayerView } = usePlayerView();

  return (
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
          {encounter.trapDetails?.countermeasures && !isPlayerView ? (
            <div className={styles.trapField}>
              <strong>Countermeasures & Puzzle Solution:</strong>
              <p>{encounter.trapDetails.countermeasures}</p>
            </div>
          ) : null}
          {encounter.trapDetails?.reset && !isPlayerView ? (
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
                  <th scope="row">
                    {part.name}
                    {(part as unknown as { customName?: string }).customName ? (
                      <span className={styles.compMeta} style={{ display: 'block' }}>
                        ({(part as unknown as { customName?: string }).customName})
                      </span>
                    ) : null}
                  </th>
                  <td>{part.count}</td>
                  <td>{part.role || '—'}</td>
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
        {!isPlayerView && catalog.length > 0 && compositionOf(draft).length > 0 ? (
          <DifficultyHint
            edition={edition}
            party={party.length}
            rating={rating}
          />
        ) : null}
      </section>

      {encounter.tactics && !isPlayerView ? (
        <section>
          <h3>
            Tactics <DmOnlyBadge />
          </h3>
          <p>{encounter.tactics}</p>
        </section>
      ) : null}
      {encounter.rulesetNotes && !isPlayerView ? (
        <section>
          <h3>Ruleset notes</h3>
          <p>{encounter.rulesetNotes}</p>
        </section>
      ) : null}

      <HeldItems heading="Loot" holderId={encounter.id} />

      {!isPlayerView ? (
        <RelatedGroups
          entityId={encounter.id}
          forwardIds={[
            ...encounter.locationIds,
            ...encounter.factionIds,
            ...encounter.sessionIds,
          ]}
          kinds={['location', 'faction', 'session']}
        />
      ) : null}
    </div>
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
