import type { ReactNode } from 'react';

import styles from './SectionSummary.module.css';

interface SectionSummaryProps {
  title: string;
  stats?: Array<{ label: string; value: number | string }>;
  children?: ReactNode;
}

/** Detail-pane card shown when no item is selected. */
export function SectionSummary({
  title,
  stats = [],
  children,
}: SectionSummaryProps) {
  return (
    <section className={styles.summary}>
      <h2>{title}</h2>
      {stats.length > 0 ? (
        <dl className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </section>
  );
}
