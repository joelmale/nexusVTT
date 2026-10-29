import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import Printer from 'lucide-react/dist/esm/icons/printer';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { useContext, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import { SectionContext } from '@/features/section-shell/SectionContext';
import type { BundleStore } from '@/features/section-shell/bundleStore';
import { RunSheetExportModal } from '../sessions/export/RunSheetExportModal';
import { BalanceGlance } from './BalanceGlance';
import {
  buildOneShotModel,
  DEFAULT_TARGET_BUDGET_MINUTES,
  formatDuration,
  ONE_SHOT_TEMPLATE_STEPS,
} from './oneShotModel';
import styles from './OneShotHub.module.css';

export interface OneShotHubProps {
  bundle: CampaignFixtureBundle;
  basePath: string;
  onExportRunSheet?: () => void;
  store?: BundleStore;
  onSeedTemplate?: () => void;
}

export function OneShotHub({
  bundle,
  basePath,
  onExportRunSheet,
  store: propStore,
  onSeedTemplate,
}: OneShotHubProps) {
  const budgetSelectId = useId();
  const sectionContext = useContext(SectionContext);
  const store = propStore ?? sectionContext?.store;

  const session = useMemo(() => {
    const sId =
      bundle.campaign.currentSessionId || bundle.catalog.selectedSessionId;
    return bundle.sessions.find((s) => s.id === sId) ?? bundle.sessions[0];
  }, [bundle]);

  const [targetBudgetMinutes, setTargetBudgetMinutes] = useState(
    DEFAULT_TARGET_BUDGET_MINUTES,
  );
  const [internalExportModalOpen, setInternalExportModalOpen] = useState(false);

  const model = useMemo(
    () => buildOneShotModel(bundle, targetBudgetMinutes),
    [bundle, targetBudgetMinutes],
  );

  const pacingBadgeClass =
    model.pacingStatus === 'balanced'
      ? styles.pacingBalanced
      : model.pacingStatus === 'under'
        ? styles.pacingUnder
        : styles.pacingOver;

  const handleExportClick = () => {
    if (onExportRunSheet) {
      onExportRunSheet();
    } else {
      setInternalExportModalOpen(true);
    }
  };

  const handleBudgetChange = (minutes: number) => {
    setTargetBudgetMinutes(minutes);
    if (session && store?.updateItem) {
      void store.updateItem('session', session.id, {
        durationHours: minutes / 60,
      });
    }
  };

  const handleSeedTemplate = async () => {
    if (onSeedTemplate) {
      onSeedTemplate();
      return;
    }
    if (session && store?.updateItem) {
      await store.updateItem('session', session.id, {
        plan: {
          ...session.plan,
          steps: ONE_SHOT_TEMPLATE_STEPS,
        },
      });
      if (store.reload) {
        await store.reload();
      }
    }
  };

  return (
    <section className={styles.container} aria-label="One-Shot Adventure Hub">
      <div className={styles.headerCard}>
        <div className={styles.topRow}>
          <div className={styles.badgeGroup}>
            <span className={styles.modeBadge}>One-Shot Mode</span>
            {model.isTemplateSuggestion && (
              <span
                className={styles.templateBadge}
                data-testid="template-suggestion-badge"
              >
                Template Suggestions
              </span>
            )}
            <span
              className={`${styles.pacingBadge} ${pacingBadgeClass}`}
              data-testid="pacing-badge"
            >
              {model.pacingStatusMessage}
            </span>
            <span
              className={styles.sceneCountBadge}
              data-testid="scene-count-badge"
            >
              {model.sceneCountMessage}
            </span>
          </div>

          <div className={styles.budgetControl}>
            <label htmlFor={budgetSelectId} className={styles.budgetLabel}>
              Target Budget:
            </label>
            <select
              id={budgetSelectId}
              className={styles.budgetSelect}
              value={targetBudgetMinutes}
              onChange={(e) => handleBudgetChange(Number(e.target.value))}
              aria-label="Target Time Budget"
            >
              <option value={120}>2 hours (120 min)</option>
              <option value={180}>3 hours (180 min)</option>
              <option value={240}>4 hours (240 min)</option>
              <option value={300}>5 hours (300 min)</option>
              <option value={360}>6 hours (360 min)</option>
            </select>
          </div>
        </div>

        <div className={styles.pacingBarWrap}>
          <div className={styles.pacingBarHeader}>
            <strong>
              Total Planned: {formatDuration(model.totalDurationMinutes)} /{' '}
              {formatDuration(model.targetBudgetMinutes)}
            </strong>
            <span>
              {model.scenes.length} Scenes + Climax &amp; Epilogue
            </span>
          </div>

          <div
            className={styles.pacingBar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={model.targetBudgetMinutes}
            aria-valuenow={model.totalDurationMinutes}
            aria-label="Adventure Pacing Timeline"
          >
            {model.segments.map((seg) => {
              const segClass =
                seg.phase === 'hook'
                  ? styles.segmentHook
                  : seg.phase === 'scene'
                    ? styles.segmentScene
                    : seg.phase === 'climax'
                      ? styles.segmentClimax
                      : styles.segmentRewards;

              return (
                <div
                  key={seg.id}
                  className={segClass}
                  style={{ width: `${seg.percentage}%` }}
                  title={seg.label}
                  aria-label={seg.label}
                />
              );
            })}
          </div>

          <div className={styles.pacingLegend}>
            <div className={styles.legendItem}>
              <span
                className={`${styles.legendDot} ${styles.segmentHook}`}
                aria-hidden="true"
              />
              <span>Hook ({formatDuration(model.hook.durationMinutes)})</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={`${styles.legendDot} ${styles.segmentScene}`}
                aria-hidden="true"
              />
              <span>
                Scenes (
                {formatDuration(
                  model.scenes.reduce((sum, s) => sum + s.durationMinutes, 0),
                )}
                )
              </span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={`${styles.legendDot} ${styles.segmentClimax}`}
                aria-hidden="true"
              />
              <span>
                Climax ({formatDuration(model.climax.durationMinutes)})
              </span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={`${styles.legendDot} ${styles.segmentRewards}`}
                aria-hidden="true"
              />
              <span>
                Rewards ({formatDuration(model.rewards.durationMinutes)})
              </span>
            </div>
          </div>
        </div>

        <div className={styles.actionsRow}>
          {model.isTemplateSuggestion && (
            <button
              type="button"
              className={styles.btnSeed}
              onClick={handleSeedTemplate}
              aria-label="Seed One-Shot Pacing Template"
            >
              <Sparkles aria-hidden="true" size={15} />
              <span>Seed One-Shot Pacing Template</span>
            </button>
          )}
          {session && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleExportClick}
              aria-label="Export One-Shot Run Sheet"
            >
              <Printer aria-hidden="true" size={15} />
              <span>Export Run Sheet</span>
            </button>
          )}
          <Link
            to={`${basePath}/sessions`}
            className={styles.btnPrimary}
            aria-label="Plan Adventure in Session View"
          >
            <CalendarDays aria-hidden="true" size={15} />
            <span>Plan Adventure</span>
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </div>

      <div className={styles.beatsGrid}>
        <article className={styles.beatCard} data-phase="hook">
          <header className={styles.beatHeader}>
            <span className={styles.beatPhase}>Stage 1 · Hook</span>
            <span className={styles.beatDuration}>
              {formatDuration(model.hook.durationMinutes)}
            </span>
          </header>
          <h3 className={styles.beatTitle}>{model.hook.title}</h3>
          {model.hook.description ? (
            <p className={styles.beatDescription}>{model.hook.description}</p>
          ) : (
            <p className={styles.beatDescription}>
              Inciting incident to grab the players and launch the adventure.
            </p>
          )}
        </article>

        <article className={styles.beatCard} data-phase="scene">
          <header className={styles.beatHeader}>
            <span className={styles.beatPhase}>
              Stage 2 · Scenes ({model.scenes.length})
            </span>
            <span className={styles.beatDuration}>
              {formatDuration(
                model.scenes.reduce((sum, s) => sum + s.durationMinutes, 0),
              )}
            </span>
          </header>
          <div className={styles.scenesList}>
            {model.scenes.map((scene, idx) => (
              <div key={scene.id} className={styles.sceneItem}>
                <span className={styles.sceneNumber}>{idx + 1}</span>
                {scene.kind && (
                  <span className={styles.sceneKind}>{scene.kind}</span>
                )}
                <span className={styles.sceneTitle}>{scene.title}</span>
                <span className={styles.sceneDuration}>
                  {scene.durationMinutes}m
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.beatCard} data-phase="climax">
          <header className={styles.beatHeader}>
            <span className={styles.beatPhase}>Stage 3 · Climax</span>
            <span className={styles.beatDuration}>
              {formatDuration(model.climax.durationMinutes)}
            </span>
          </header>
          <h3 className={styles.beatTitle}>{model.climax.title}</h3>
          {model.climax.description ? (
            <p className={styles.beatDescription}>{model.climax.description}</p>
          ) : (
            <p className={styles.beatDescription}>
              Decisive confrontation or pivotal challenge resolving the main
              threat.
            </p>
          )}
        </article>

        <article className={styles.beatCard} data-phase="rewards">
          <header className={styles.beatHeader}>
            <span className={styles.beatPhase}>Stage 4 · Rewards &amp; Wrap</span>
            <span className={styles.beatDuration}>
              {formatDuration(model.rewards.durationMinutes)}
            </span>
          </header>
          <h3 className={styles.beatTitle}>{model.rewards.title}</h3>
          <p className={styles.beatDescription}>
            {model.rewards.description ||
              `${model.scheduledLootCount} scheduled items, ${model.unrevealedSecretsCount} secrets ready to drop.`}
          </p>
        </article>
      </div>

      <BalanceGlance bundle={bundle} sessionId={session?.id} />

      {internalExportModalOpen && session && (
        <RunSheetExportModal
          bundle={bundle}
          isOpen={internalExportModalOpen}
          onClose={() => setInternalExportModalOpen(false)}
          session={session}
        />
      )}
    </section>
  );
}
