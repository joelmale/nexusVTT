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

interface MentionTextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'value'
> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Textarea where typing `@` offers the campaign's objects and inserts a stable
 * `@[Title](ref:id)` mention. Keyboard: arrows to move, Enter or Tab to pick,
 * Escape to dismiss. Falls back to a plain textarea when nothing matches.
 */
export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  ...rest
}: MentionTextareaProps) {
  const { bundle } = useSectionBundle();
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

  const results = useMemo(
    () => (active ? mentionCandidates(entities, active.query) : []),
    [active, entities],
  );
  const open = active !== null && results.length > 0;

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

  const pick = (entity: EntityRef) => {
    const element = ref.current;
    if (!active || !element) return;
    const caret = element.selectionStart ?? value.length;
    const next = applyMention(value, active, caret, entity.label, entity.id);
    pendingCaret.current = next.caret;
    onChange(next.text);
    setActive(null);
    element.focus();
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
      const step = event.key === 'ArrowDown' ? 1 : results.length - 1;
      setHighlight((current) => (current + step) % results.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pick(results[Math.min(highlight, results.length - 1)]);
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
              {results.map((entity, index) => (
                <li
                  aria-selected={index === highlight}
                  className={index === highlight ? styles.selected : undefined}
                  id={`${listId}-${index}`}
                  key={entity.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(entity);
                  }}
                  role="option"
                >
                  <span>{entity.label}</span>
                  <span className={styles.kind}>
                    {ENTITY_KIND_LABELS[entity.kind]}
                  </span>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
