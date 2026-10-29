import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import { useNavigate } from 'react-router-dom';

import { ENTITY_ICONS, ENTITY_KIND_LABELS } from '@/features/section-shell/entityMeta';
import { useSectionBundle } from '@/features/section-shell/SectionContext';

import styles from './CampaignSearchDialog.module.css';
import { searchCampaign } from './searchCampaign';

interface CampaignSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Search over the open campaign. Arrow keys move through results, Enter opens
 * one, Escape closes and returns focus to where the dialog was opened from.
 */
export function CampaignSearchDialog({ open, onClose }: CampaignSearchDialogProps) {
  const { bundle, basePath } = useSectionBundle();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const listId = useId();

  const results = useMemo(() => searchCampaign(bundle, query), [bundle, query]);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setHighlight(0);
    inputRef.current?.focus();
    return () => opener.current?.focus?.();
  }, [open]);

  if (!open) return null;

  const choose = (index: number) => {
    const result = results[index];
    if (!result?.entity.href) return;
    onClose();
    navigate(`${basePath}${result.entity.href}`);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setHighlight((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setHighlight((current) => (current + results.length - 1) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(highlight);
    }
  };

  const hasQuery = query.trim().length > 0;
  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        aria-label="Search campaign"
        aria-modal="true"
        className={styles.panel}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <input
          aria-activedescendant={
            results.length > 0 ? `${listId}-${highlight}` : undefined
          }
          aria-controls={listId}
          aria-expanded={results.length > 0}
          aria-label="Search this campaign"
          autoComplete="off"
          className={styles.input}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
          }}
          placeholder="Search NPCs, quests, locations, notes…"
          ref={inputRef}
          role="combobox"
          type="search"
          value={query}
        />
        <ul
          aria-label="Search results"
          className={styles.results}
          id={listId}
          role="listbox"
        >
          {results.map((result, index) => {
            const Icon = ENTITY_ICONS[result.entity.kind] ?? BookOpen;
            return (
              <li
                aria-selected={index === highlight}
                className={index === highlight ? styles.selected : undefined}
                id={`${listId}-${index}`}
                key={result.entity.id}
                onClick={() => choose(index)}
                onMouseEnter={() => setHighlight(index)}
                role="option"
              >
                <Icon aria-hidden="true" size={16} />
                <span className={styles.text}>
                  <span className={styles.label}>{result.entity.label}</span>
                  {result.snippet ? (
                    <span className={styles.snippet}>{result.snippet}</span>
                  ) : null}
                </span>
                <span className={styles.kind}>
                  {ENTITY_KIND_LABELS[result.entity.kind]}
                </span>
              </li>
            );
          })}
        </ul>
        <p className={styles.status} role="status">
          {!hasQuery
            ? 'Type to search this campaign.'
            : results.length === 0
              ? 'No matches in this campaign.'
              : `${results.length} result${results.length === 1 ? '' : 's'}`}
        </p>
      </div>
    </div>
  );
}
