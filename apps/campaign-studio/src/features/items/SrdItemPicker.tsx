import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { fetchSrdItems, type SrdItem } from '@/services/srd-items-api';

import { RarityBadge } from './RarityBadge';
import styles from './SrdItemPicker.module.css';

/**
 * "Start from SRD": a searchable list of catalog items that creates a campaign
 * item prefilled from the chosen entry. The catalog loads when opened; if it
 * cannot be reached, the picker displays an inline error with a Retry button.
 */
export function SrdItemPicker() {
  const { bundle, store, basePath } = useSectionBundle();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<SrdItem[]>();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [fetchError, setFetchError] = useState<string>();
  const [addError, setAddError] = useState<string>();
  const inputId = useId();

  const ruleset =
    bundle?.campaign?.edition === '2014' || bundle?.catalog?.edition === '2014'
      ? '2014'
      : '2024';

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = catalog ?? [];
    if (!needle) return pool;
    return pool.filter((item) => item.name.toLowerCase().includes(needle));
  }, [catalog, query]);

  if (!store.editable) return null;

  const show = async (forceRetry = false) => {
    setOpen(true);
    setFetchError(undefined);
    if (catalog && !forceRetry) return;
    setLoading(true);
    const result = await fetchSrdItems(ruleset);
    setLoading(false);
    if (!result.ok) {
      setFetchError(result.error);
      return;
    }
    if (result.items.length === 0) {
      setFetchError('Catalog is empty.');
      return;
    }
    setCatalog(result.items);
  };

  const pick = async (item: SrdItem) => {
    setBusy(true);
    setAddError(undefined);
    const added = await store.addItem('item', {
      name: item.name,
      itemType: item.itemType,
      rarity: item.rarity,
      requiresAttunement: item.requiresAttunement,
      ...(item.attunementNote ? { attunementNote: item.attunementNote } : {}),
      ...(item.valueGp !== undefined ? { valueGp: item.valueGp } : {}),
      ...(item.weightLb !== undefined ? { weightLb: item.weightLb } : {}),
      description: item.description,
      source: { ruleset: item.ruleset, entityId: item.id },
    });
    setBusy(false);
    if (!added.ok) {
      setAddError(added.error ?? 'Could not add.');
      return;
    }
    setOpen(false);
    setQuery('');
    if (added.id) navigate(`${basePath}/items/${encodeURIComponent(added.id)}`);
  };

  if (!open) {
    return (
      <div className={styles.picker}>
        <button onClick={() => void show()} type="button">
          Start from SRD
        </button>
        {fetchError ? (
          <div className={styles.error} role="alert">
            <span>{fetchError}</span>
            <button onClick={() => void show(true)} type="button">
              Retry
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div aria-label="Start from SRD" className={styles.picker} role="group">
      <div className={styles.searchHeader}>
        <label htmlFor={inputId}>Search SRD items ({ruleset})</label>
        {catalog ? (
          <span className={styles.count}>
            {results.length} of {catalog.length} items
          </span>
        ) : null}
      </div>
      <input
        autoFocus
        id={inputId}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by name..."
        type="search"
        value={query}
      />
      {loading ? <p>Loading the SRD catalog...</p> : null}
      {fetchError ? (
        <div className={styles.error} role="alert">
          <span>{fetchError}</span>
          <button onClick={() => void show(true)} type="button">
            Retry
          </button>
        </div>
      ) : null}
      {catalog && !loading && !fetchError ? (
        <ul>
          {results.map((item) => (
            <li key={item.id}>
              <button disabled={busy} onClick={() => void pick(item)} type="button">
                <span>{item.name}</span>
                <span className={styles.meta}>
                  <RarityBadge rarity={item.rarity} />
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <li className={styles.empty}>No matching items found.</li>
          ) : null}
        </ul>
      ) : null}
      {addError ? <p role="alert">{addError}</p> : null}
      <button onClick={() => setOpen(false)} type="button">
        Cancel
      </button>
    </div>
  );
}
