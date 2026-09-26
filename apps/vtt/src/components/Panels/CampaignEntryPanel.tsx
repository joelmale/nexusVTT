import React, { useEffect, useMemo, useState } from 'react';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';

import type { CampaignEntry } from '@nexus/game-contracts';

import { campaignPrepClient } from '@/services/campaignPrepClient';
import type { PanelComponentProps } from '@/services/panelRegistry';
import styles from './CampaignEntryPanel.module.css';

function collectLexicalText(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectLexicalText);
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return [record.text];
  return Object.values(record).flatMap(collectLexicalText);
}

export const CampaignEntryPanel: React.FC<PanelComponentProps> = ({ link }) => {
  const [entry, setEntry] = useState<CampaignEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!link.campaignId) {
      return () => {
        active = false;
      };
    }

    void campaignPrepClient
      .getCampaignEntry(link.campaignId, link.id)
      .then((response) => {
        if (active) {
          setError(null);
          setEntry(response.revision.data);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load campaign entry.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [link.campaignId, link.id]);

  const content = useMemo(
    () => (entry ? collectLexicalText(entry.content.value).join(' ') : ''),
    [entry],
  );

  if (!link.campaignId) {
    return (
      <div className={styles.message}>
        This campaign entry is missing its campaign reference.
      </div>
    );
  }

  if (error) {
    return <div className={styles.message}>{error}</div>;
  }

  if (!entry) {
    return <div className={styles.message}>Loading campaign entry...</div>;
  }

  return (
    <article className={styles.entry}>
      <header className={styles.header}>
        <BookOpen aria-hidden="true" size={18} />
        <div>
          <span className={styles.kind}>{entry.kind}</span>
          <h2>{entry.title}</h2>
        </div>
      </header>
      <p className={styles.content}>
        {content || 'This entry has no text content.'}
      </p>
      {entry.tags.length > 0 && (
        <ul aria-label="Campaign entry tags" className={styles.tags}>
          {entry.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
    </article>
  );
};
