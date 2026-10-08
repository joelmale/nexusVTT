import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { fetchSrdItems, type SrdItem } from '@/services/srd-items-api';

import { RARITY_LABELS } from './itemsModel';
import styles from './SrdItemPicker.module.css';

const MAX_RESULTS = 25;

/**
 * "Start from SRD": a searchable list of catalog items that creates a campaign
 * item prefilled from the chosen entry. The catalog loads when opened; if it
 * cannot be reached the picker removes itself.
 */
export function SrdItemPicker() {
  const { store, basePath } = useSectionBundle();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<SrdItem[]>();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inputId = useId();

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = catalog ?? [];
    return (
      needle
        ? pool.filter((item) => item.name.toLowerCase().includes(needle))
        : pool
    ).slice(0, MAX_RESULTS);
  }, [catalog, query]);

  if (!store.editable || unavailable) return null;

  const show = async () => {
    setOpen(true);
    if (catalog) return;
    setLoading(true);
    const result = await fetchSrdItems();
    setLoading(false);
    if (!result.ok || result.items.length === 0) {
      setUnavailable(true);
      return;
    }
    setCatalog(result.items);
  };

  const pick = async (item: SrdItem) => {
    setBusy(true);
    setError(undefined);
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
      setError(added.error ?? 'Could not add.');
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
      </div>
    );
  }
  return (
    <div aria-label="Start from SRD" className={styles.picker} role="group">
      <label htmlFor={inputId}>Search SRD items</label>
      <input
        autoFocus
        id={inputId}
        onChange={(event) => setQuery(event.target.value)}
        type="search"
        value={query}
      />
      {loading ? <p>Loading the SRD catalog...</p> : null}
      <ul>
        {results.map((item) => (
          <li key={item.id}>
            <button disabled={busy} onClick={() => void pick(item)} type="button">
              <span>{item.name}</span>
              <span className={styles.meta}>{RARITY_LABELS[item.rarity]}</span>
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert">{error}</p> : null}
      <button onClick={() => setOpen(false)} type="button">
        Cancel
      </button>
    </div>
  );
}
