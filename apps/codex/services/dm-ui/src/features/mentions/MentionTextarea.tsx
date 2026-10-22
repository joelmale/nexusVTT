import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import Plus from 'lucide-react/dist/esm/icons/plus';

import { listEntities, type EntityRef } from '@/demo/fixture-registry';
import { ENTITY_KIND_LABELS } from '@/features/section-shell/entityMeta';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import {
  activeMention,
  applyMention,
  type ActiveMention,
} from '@/lib/mentions';

import { mentionCandidates } from './mentionCandidates';
import styles from './MentionTextarea.module.css';

export type MentionSuggestion =
  | { type: 'entity'; entity: EntityRef }
  | { type: 'create'; kind: 'npc' | 'location' | 'item'; name: string };

const CREATE_KIND_LABELS: Record<'npc' | 'location' | 'item', string> = {
  npc: 'NPC',
  location: 'Location',
  item: 'Item',
};

interface MentionTextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'value'
> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Textarea where typing `@` offers the campaign's objects and inserts a stable
 * `@[Title](ref:id)` mention. When typing an unrecognised name in editable mode,
 * offers inline quick creation of NPCs, Locations, or Items ("Create from context").
 */
export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  ...rest
}: MentionTextareaProps) {
  const { bundle, store } = useSectionBundle();
  const entities = useMemo(() => listEntities(bundle), [bundle]);
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | undefined>(undefined);
  const [active, setActive] = useState<ActiveMention | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [anchor, setAnchor] = useState<{
    left: number;
    top: number;
    width: number;
  }>();
  const listId = useId();

  const suggestions = useMemo<MentionSuggestion[]>(() => {
    if (!active) return [];
    const queryTrimmed = active.query.trim();
    const entityMatches = mentionCandidates(entities, active.query);

    const items: MentionSuggestion[] = entityMatches.map((entity) => ({
      type: 'entity',
      entity,
    }));

    if (store.editable && queryTrimmed.length > 0 && entityMatches.length === 0) {
      items.push(
        { type: 'create', kind: 'npc', name: queryTrimmed },
        { type: 'create', kind: 'location', name: queryTrimmed },
        { type: 'create', kind: 'item', name: queryTrimmed },
      );
    }

    return items;
  }, [active, entities, store.editable]);

  const open = active !== null && suggestions.length > 0;

  useEffect(() => {
    if (pendingCaret.current !== undefined && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = undefined;
    }
  });

  const refresh = (text: string, caret: number) => {
    setActive(activeMention(text, caret));
    setHighlight(0);
    const box = ref.current?.getBoundingClientRect();
    if (box) {
      setAnchor({ left: box.left, top: box.bottom + 4, width: box.width });
    }
  };

  const pick = async (suggestion: MentionSuggestion) => {
    const element = ref.current;
    if (!active || !element) return;
    const caret = element.selectionStart ?? value.length;

    if (suggestion.type === 'entity') {
      const next = applyMention(
        value,
        active,
        caret,
        suggestion.entity.label,
        suggestion.entity.id,
      );
      pendingCaret.current = next.caret;
      onChange(next.text);
      setActive(null);
      element.focus();
    } else {
      const name = suggestion.name;
      const kind = suggestion.kind;
      let draft: Record<string, unknown> = {
        campaignId: bundle.campaignId ?? bundle.campaign.id,
      };

      if (kind === 'npc') {
        draft = { ...draft, name, role: '' };
      } else if (kind === 'location') {
        draft = { ...draft, name, type: 'settlement', description: '' };
      } else if (kind === 'item') {
        draft = { ...draft, name, rarity: 'common', type: 'gear' };
      }

      const res = await store.addItem(kind, draft);
      if (res.ok && res.id) {
        const next = applyMention(value, active, caret, name, res.id);
        pendingCaret.current = next.caret;
        onChange(next.text);
        setActive(null);
        element.focus();
      }
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
    refresh(event.target.value, event.target.selectionStart ?? 0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (!open || event.defaultPrevented) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : suggestions.length - 1;
      setHighlight((current) => (current + step) % suggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      void pick(suggestions[Math.min(highlight, suggestions.length - 1)]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setActive(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <textarea
        {...rest}
        aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        onBlur={(event) => {
          rest.onBlur?.(event);
          // Let a click on an option land before the list closes.
          window.setTimeout(() => setActive(null), 120);
        }}
        onChange={handleChange}
        onClick={(event) =>
          refresh(event.currentTarget.value, event.currentTarget.selectionStart)
        }
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow') && !open) {
            refresh(
              event.currentTarget.value,
              event.currentTarget.selectionStart,
            );
          }
        }}
        ref={ref}
        role="combobox"
        value={value}
      />
      {open
        ? createPortal(
            // Portalled so the suggestions never become part of the field's label.
            <ul
              aria-label="Mention suggestions"
              className={styles.list}
              id={listId}
              role="listbox"
              style={
                anchor
                  ? {
                      left: anchor.left,
                      minWidth: anchor.width,
                      top: anchor.top,
                    }
                  : undefined
              }
            >
              {suggestions.map((item, index) => {
                if (item.type === 'entity') {
                  const entity = item.entity;
                  return (
                    <li
                      aria-selected={index === highlight}
                      className={index === highlight ? styles.selected : undefined}
                      id={`${listId}-${index}`}
                      key={`entity-${entity.id}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        void pick(item);
                      }}
                      role="option"
                    >
                      <span>{entity.label}</span>
                      <span className={styles.kind}>
                        {ENTITY_KIND_LABELS[entity.kind]}
                      </span>
                    </li>
                  );
                }

                return (
                  <li
                    aria-selected={index === highlight}
                    className={`${styles.createOption} ${index === highlight ? styles.selected : ''}`}
                    id={`${listId}-${index}`}
                    key={`create-${item.kind}-${item.name}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      void pick(item);
                    }}
                    role="option"
                  >
                    <span className={styles.createLabel}>
                      <Plus size={13} aria-hidden="true" />
                      Create {CREATE_KIND_LABELS[item.kind]} &ldquo;{item.name}&rdquo;
                    </span>
                    <span className={styles.kind}>New</span>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
