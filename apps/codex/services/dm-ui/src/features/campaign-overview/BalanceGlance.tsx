import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Gem from 'lucide-react/dist/esm/icons/gem';
import Scale from 'lucide-react/dist/esm/icons/scale';
import Swords from 'lucide-react/dist/esm/icons/swords';
import Users from 'lucide-react/dist/esm/icons/users';
import { useMemo } from 'react';

import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import {
  buildBalanceModel,
  type EncounterDifficultyTier,
} from './balanceModel';
import styles from './BalanceGlance.module.css';

export interface BalanceGlanceProps {
  bundle: CampaignFixtureBundle;
  sessionId?: string;
}

function difficultyClass(rating: EncounterDifficultyTier): string {
  switch (rating) {
    case 'trivial':
      return styles.diffTrivial;
    case 'low':
      return styles.diffLow;
    case 'moderate':
      return styles.diffModerate;
    case 'high':
      return styles.diffHigh;
    case 'deadly':
      return styles.diffDeadly;
  }
}

export function BalanceGlance({ bundle, sessionId }: BalanceGlanceProps) {
  const model = useMemo(
    () => buildBalanceModel(bundle, sessionId),
    [bundle, sessionId],
  );

  const statusClass =
    model.healthStatus === 'danger'
      ? styles.statusDanger
      : model.healthStatus === 'caution'
        ? styles.statusCaution
        : styles.statusBalanced;

  const statusLabel =
    model.healthStatus === 'danger'
      ? 'Lethal Risk'
      : model.healthStatus === 'caution'
        ? 'Pacing Caution'
        : 'Balanced';

  const xpPercent =
    model.dailyXpBudget > 0
      ? Math.min(100, Math.round((model.totalEncounterXp / model.dailyXpBudget) * 100))
      : 0;

  return (
    <section className={styles.container} aria-label="Balance at a Glance">
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Scale aria-hidden="true" className={styles.titleIcon} size={18} />
          <h3 className={styles.titleText}>Balance at a Glance</h3>
        </div>

        <div className={styles.metaGroup}>
          <span className={styles.partyBadge}>
            <Users aria-hidden="true" size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
            {model.partySize} PCs · Level {model.averageLevel} · {model.edition} DMG
          </span>
          <span
            className={`${styles.statusPill} ${statusClass}`}
            data-testid="balance-status-pill"
          >
            {statusLabel}
          </span>
        </div>
      </header>

      <div className={styles.grid}>
        <article className={styles.column} aria-label="Encounter Combat Balance">
          <div className={styles.columnHeader}>
            <h4 className={styles.columnTitle}>
              <Swords aria-hidden="true" size={15} />
              <span>Combat Encounters ({model.encounters.length})</span>
            </h4>
            <span className={styles.metricBadge}>
              {model.totalEncounterXp.toLocaleString()} XP Total
            </span>
          </div>

          <div className={styles.xpMeterWrap}>
            <div className={styles.xpMeterLabels}>
              <span>Est. Daily Budget Used</span>
              <span>
                {xpPercent}% of {model.dailyXpBudget.toLocaleString()} XP
              </span>
            </div>
            <div
              className={styles.xpBar}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={model.dailyXpBudget}
              aria-valuenow={model.totalEncounterXp}
              aria-label="Daily Encounter XP Budget"
            >
              <div
                className={`${styles.xpBarFill} ${model.totalEncounterXp > model.dailyXpBudget ? styles.xpBarFillDanger : ''}`}
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>

          <div className={styles.budgetRow}>
            <span>Party Thresholds:</span>
            <span>
              Low: {model.budgetPerEncounter.low.toLocaleString()} · Mod:{' '}
              {model.budgetPerEncounter.moderate.toLocaleString()} · High:{' '}
              {model.budgetPerEncounter.high.toLocaleString()}
            </span>
          </div>

          <ul className={styles.encounterList}>
            {model.encounters.slice(0, 4).map((enc) => (
              <li key={enc.id} className={styles.encounterRow}>
                <span className={styles.encounterTitle}>{enc.title}</span>
                <span
                  className={`${styles.difficultyTag} ${difficultyClass(enc.rating)}`}
                >
                  {enc.rating}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.column} aria-label="Party Wealth & Treasure Progression">
          <div className={styles.columnHeader}>
            <h4 className={styles.columnTitle}>
              <Gem aria-hidden="true" size={15} />
              <span>Treasure Progression</span>
            </h4>
            <span className={styles.metricBadge}>
              Tier {model.wealth.tier} Expectation
            </span>
          </div>

          <div className={styles.wealthDetails}>
            <div className={styles.wealthRow}>
              <span className={styles.wealthLabel}>Campaign Placed Wealth:</span>
              <span className={styles.wealthValue}>
                {model.wealth.totalGp.toLocaleString()} gp
              </span>
            </div>

            <div className={styles.wealthRow}>
              <span className={styles.wealthLabel}>Scheduled Session Loot:</span>
              <span className={styles.wealthValue}>
                {model.wealth.scheduledSessionGp.toLocaleString()} gp
              </span>
            </div>

            <div className={styles.wealthRow}>
              <span className={styles.wealthLabel}>Expected Tier Range:</span>
              <span className={styles.wealthValue}>
                {model.wealth.minGp.toLocaleString()} –{' '}
                {model.wealth.maxGp.toLocaleString()} gp
              </span>
            </div>

            <div className={styles.wealthRow}>
              <span className={styles.wealthLabel}>Pacing Status:</span>
              <span className={styles.wealthValue}>{model.wealth.label}</span>
            </div>
          </div>
        </article>
      </div>

      {model.warnings.length > 0 && (
        <aside className={styles.warningsSection} aria-label="Balance Advisories">
          <div className={styles.warningsHeader}>
            <AlertTriangle aria-hidden="true" size={15} />
            <span>Pacing &amp; Lethality Advisories ({model.warnings.length})</span>
          </div>
          <ul className={styles.warningsList}>
            {model.warnings.map((warning) => (
              <li key={warning} className={styles.warningItem}>
                {warning}
              </li>
            ))}
          </ul>
          <p className={styles.disclaimer}>
            Advisories are for DM encounter calibration and pacing; they never
            restrict preparation or table play.
          </p>
        </aside>
      )}
    </section>
  );
}
