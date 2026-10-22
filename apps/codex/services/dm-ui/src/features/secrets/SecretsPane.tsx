import { useState } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';

import type { CampaignSecret } from '@/demo/fixture-registry';
import { FilterBar, type FilterFacet } from '@/features/section-shell/FilterBar';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { useSectionQuery } from '@/features/section-shell/useSectionQuery';

import {
  computeSecretStats,
  filterSecrets,
  type SecretFilterOptions,
} from './secretsModel';
import { SecretModal } from './SecretModal';
import { SecretRow } from './SecretRow';
import styles from './SecretsPane.module.css';

export interface SecretsPaneProps {
  /** Optional override if rendering inside another section or standalone. */
  className?: string;
}

export function SecretsPane({ className }: SecretsPaneProps) {
  const { bundle, basePath, store } = useSectionBundle();
  const { get } = useSectionQuery();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<CampaignSecret | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const rawSecrets = bundle.secrets ?? [];
  const stats = computeSecretStats(rawSecrets);

  const queryParam = get('q') || undefined;
  const statusParam = (get('status') as SecretFilterOptions['status']) || 'all';
  const kindParam = get('kind') || undefined;

  const filtered = filterSecrets(rawSecrets, {
    query: queryParam,
    status: statusParam,
    attachedKind: kindParam,
  });

  const facets: FilterFacet[] = [
    {
      key: 'status',
      label: 'Status',
      allLabel: 'All status',
      options: [
        { value: 'unrevealed', label: 'Unrevealed', count: stats.unrevealed },
        { value: 'revealed', label: 'Revealed', count: stats.revealed },
      ],
    },
    {
      key: 'kind',
      label: 'Attached to',
      allLabel: 'All entities',
      options: [
        { value: 'npc', label: 'NPCs' },
        { value: 'location', label: 'Locations' },
        { value: 'quest', label: 'Quests' },
        { value: 'encounter', label: 'Encounters' },
        { value: 'item', label: 'Items' },
      ],
    },
  ];

  const handleOpenNew = () => {
    setEditingSecret(null);
    setModalOpen(true);
  };

  const handleEdit = (secret: CampaignSecret) => {
    setEditingSecret(secret);
    setModalOpen(true);
  };

  const handleToggleRevealed = async (secret: CampaignSecret) => {
    if (!store.editable) return;
    await store.updateItem('secret', secret.id, {
      revealed: !secret.revealed,
    });
  };

  const handleDelete = async (secret: CampaignSecret) => {
    if (!store.editable) return;
    await store.removeItem('secret', secret.id);
  };

  const handleSaveModal = async (secretData: {
    id?: string;
    text: string;
    attachedTo: Array<{ kind: string; id: string }>;
    revealed: boolean;
    revealedInSessionId?: string;
  }) => {
    setIsSaving(true);
    try {
      if (secretData.id) {
        await store.updateItem('secret', secretData.id, {
          text: secretData.text,
          attachedTo: secretData.attachedTo,
          revealed: secretData.revealed,
          revealedInSessionId: secretData.revealedInSessionId,
        });
      } else {
        await store.addItem('secret', {
          campaignId: bundle.campaign.id,
          text: secretData.text,
          attachedTo: secretData.attachedTo,
          revealed: secretData.revealed,
          revealedInSessionId: secretData.revealedInSessionId,
        });
      }
      setModalOpen(false);
      setEditingSecret(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`${styles.pane} ${className ?? ''}`} data-testid="secrets-pane">
      <div className={styles.topBar}>
        <div className={styles.statsBar}>
          <span>
            <strong className={styles.statHighlight}>{stats.total}</strong> total
          </span>
          <span>•</span>
          <span>
            <strong className={styles.statHighlight}>{stats.unrevealed}</strong> unrevealed
          </span>
          <span>•</span>
          <span>
            <strong className={styles.statHighlight}>{stats.revealed}</strong> revealed
          </span>
        </div>

        {store.editable ? (
          <button
            className={styles.addBtn}
            onClick={handleOpenNew}
            type="button"
          >
            <Plus size={15} aria-hidden="true" />
            Add Secret
          </button>
        ) : null}
      </div>

      <FilterBar
        facets={facets}
        plural="secrets"
        resultCount={filtered.length}
        searchLabel="Search secrets"
        singular="secret"
      />

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyTitle}>No secrets found</h3>
          <p className={styles.emptyDesc}>
            {rawSecrets.length === 0
              ? 'Prepare whispers, rumors, clues, and hidden truths to reveal during upcoming sessions.'
              : 'No secrets match your current search and filter criteria.'}
          </p>
          {store.editable && rawSecrets.length === 0 ? (
            <button
              className={styles.addBtn}
              onClick={handleOpenNew}
              type="button"
            >
              <Plus size={15} aria-hidden="true" />
              Add your first secret
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((secret) => (
            <SecretRow
              key={secret.id}
              basePath={basePath}
              bundle={bundle}
              editable={store.editable}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onToggleRevealed={handleToggleRevealed}
              secret={secret}
            />
          ))}
        </div>
      )}

      <SecretModal
        bundle={bundle}
        isOpen={modalOpen}
        isSaving={isSaving}
        initialSecret={editingSecret}
        onClose={() => {
          setModalOpen(false);
          setEditingSecret(null);
        }}
        onSave={handleSaveModal}
      />
    </div>
  );
}
