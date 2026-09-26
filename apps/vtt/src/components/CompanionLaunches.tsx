import React from 'react';

import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Hammer from 'lucide-react/dist/esm/icons/hammer';
import Map from 'lucide-react/dist/esm/icons/map';

import styles from './CompanionLaunches.module.css';

interface CompanionLaunchesProps {
  campaignStudioUrl: string;
  characterForgeUrl: string;
}

export const CompanionLaunches: React.FC<CompanionLaunchesProps> = ({
  campaignStudioUrl,
  characterForgeUrl,
}) => (
  <section className={styles.launches} aria-label="Nexus creation tools">
    <div className={styles.item}>
      <a className={styles.link} href={campaignStudioUrl}>
        <span className={styles.icon} aria-hidden="true">
          <Map size={18} strokeWidth={1.8} />
        </span>
        <div className={styles.copy}>
          <span className={styles.label}>Campaign Studio</span>
          <span className={styles.category}>Plan a campaign</span>
        </div>
        <ArrowRight className={styles.arrow} size={17} aria-hidden="true" />
      </a>
    </div>

    <div className={styles.item}>
      <a
        className={`${styles.link} ${styles.characterLink}`}
        href={characterForgeUrl}
      >
        <span className={styles.icon} aria-hidden="true">
          <Hammer size={18} strokeWidth={1.8} />
        </span>
        <div className={styles.copy}>
          <span className={styles.label}>Character Forge</span>
          <span className={styles.category}>Create a character</span>
        </div>
        <blockquote className={styles.quote}>
          Great characters are forged in fire even if they start on paper.
        </blockquote>
        <ArrowRight className={styles.arrow} size={17} aria-hidden="true" />
      </a>
    </div>
  </section>
);
