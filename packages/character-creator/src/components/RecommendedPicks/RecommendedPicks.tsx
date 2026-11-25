import React, { useMemo, useState } from 'react';
import type { CharacterCreationData } from '../../types/dnd';
import type { CreationDraft } from '../../types/draft';
import { loadClasses } from '../../services/dataService';
import { getRecommendation } from '../../services/recommendationService';
import { STARTER_KITS_2024, starterKitFor } from '../../data/recommendations/2024/starterKits';
import { ChoiceCard } from '../ChoiceCard/ChoiceCard';
import styles from './RecommendedPicks.module.css';

interface RecommendedPicksProps {
  data: CharacterCreationData;
  /** Replaces the draft's recommended answers; the player's own stay put. */
  onApply: (draft: CreationDraft) => void;
  /** Called after a successful apply, to move the player on. */
  onApplied?: () => void;
}

/**
 * The "recommended picks" lane of the single creator.
 *
 * The player names a class; the rest of the character (species, background,
 * ability scores, skills, spells, gear) is filled from an authored starter kit
 * and then reviewed step by step like any other draft. Nothing here is locked:
 * every answer stays editable in the normal steps.
 */
export const RecommendedPicks: React.FC<RecommendedPicksProps> = ({
  data,
  onApply,
  onApplied,
}) => {
  const [classSlug, setClassSlug] = useState<string>();
  const [error, setError] = useState<string>();

  const classes = useMemo(() => {
    const kits = new Set(STARTER_KITS_2024.map((kit) => kit.classSlug));
    return loadClasses('2024').filter((c) => kits.has(c.slug));
  }, []);

  // Kits are authored for the 2024 rules only.
  if (data.edition !== '2024') return null;

  const kit = classSlug ? starterKitFor(classSlug) : undefined;

  const apply = () => {
    if (!classSlug) return;
    try {
      const result = getRecommendation({
        classSlug,
        edition: '2024',
        // Kits are authored for 1st level. A higher level keeps the player's own
        // level choice; the later-level steps (ASI, spells, HP) stay theirs to make.
        level: 1,
      });
      if (!result.evaluation.isValid) {
        setError('Those picks are not available yet. Choose everything yourself instead.');
        return;
      }
      setError(undefined);
      onApply(result.draft);
      onApplied?.();
    } catch {
      setError('Could not build recommended picks. Choose everything yourself instead.');
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="recommended-picks-title">
      <h4 id="recommended-picks-title" className={styles.title}>
        Start with recommended picks
      </h4>
      <p className={styles.hint}>
        Choose a class and we fill in the rest with a well-rounded set of
        choices. You review every step and can change anything.
      </p>
      {data.level > 1 && (
        <p className={styles.hint}>
          Picks cover your 1st-level choices. The extra choices for level{' '}
          {data.level} (ability improvements, spells, hit points) are yours to make
          in the steps that follow.
        </p>
      )}
      <div className={styles.grid} role="group" aria-label="Class">
        {classes.map((c) => (
          <ChoiceCard
            key={c.slug}
            title={c.name}
            details={[`Hit Die: d${c.hit_die}`]}
            selected={classSlug === c.slug}
            onSelect={() => setClassSlug(c.slug)}
          />
        ))}
      </div>
      {kit && (
        <div className={styles.why} role="status">
          <p>
            <strong>Origin:</strong> {kit.why.origin}
          </p>
          <p>
            <strong>Abilities:</strong> {kit.why.abilities}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <button
        type="button"
        className={styles.apply}
        disabled={!classSlug}
        onClick={apply}
      >
        Use recommended picks
      </button>
    </section>
  );
};
