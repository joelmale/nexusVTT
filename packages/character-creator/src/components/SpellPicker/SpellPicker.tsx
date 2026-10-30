import React, { useId, useMemo, useState } from 'react';
import type { AppSpell } from '../../services/dataService';
import styles from './SpellPicker.module.css';

/** Case-insensitive name match plus an optional school filter. */
export function filterSpells(
  spells: readonly AppSpell[],
  query: string,
  school: string,
): AppSpell[] {
  const needle = query.trim().toLowerCase();
  return spells.filter(
    (spell) =>
      (!school || spell.school === school) &&
      (!needle || spell.name.toLowerCase().includes(needle)),
  );
}

interface SpellPickerProps {
  title: string;
  hint?: string;
  spells: readonly AppSpell[];
  /** Slugs currently chosen. */
  selected: readonly string[];
  max: number;
  onToggle: (slug: string) => void;
  onDetails: (spell: AppSpell) => void;
  /** Heading per spell level (for 1st-level-and-up lists). */
  groupByLevel?: boolean;
}

const levelLabel = (level: number) =>
  level === 0 ? 'Cantrips' : `Level ${level} spells`;

/**
 * Pick-N spell list: search, school filter, a tray of chosen spells that can be
 * removed in one click, and cards that disable once the limit is reached.
 */
export const SpellPicker: React.FC<SpellPickerProps> = ({
  title,
  hint,
  spells,
  selected,
  max,
  onToggle,
  onDetails,
  groupByLevel = false,
}) => {
  const [query, setQuery] = useState('');
  const [school, setSchool] = useState('');
  const id = useId();

  const schools = useMemo(
    () => [...new Set(spells.map((spell) => spell.school))].sort(),
    [spells],
  );
  const visible = useMemo(
    () => filterSpells(spells, query, school),
    [spells, query, school],
  );
  const bySlug = useMemo(
    () => new Map(spells.map((spell) => [spell.slug, spell])),
    [spells],
  );

  const full = selected.length >= max;
  const levels = groupByLevel
    ? [...new Set(visible.map((spell) => spell.level))].sort((a, b) => a - b)
    : [-1];

  const renderSpell = (spell: AppSpell) => {
    const isSelected = selected.includes(spell.slug);
    return (
      <div key={spell.slug} className={styles.cell}>
        <button
          type="button"
          className={styles.spell}
          aria-pressed={isSelected}
          disabled={!isSelected && full}
          onClick={() => onToggle(spell.slug)}
        >
          <span className={styles.name}>{spell.name}</span>
          <span className={styles.meta}>
            {spell.school} · {spell.castingTime} · {spell.range}
            {spell.concentration ? ' · Concentration' : ''}
            {spell.ritual ? ' · Ritual' : ''}
          </span>
          <span className={styles.blurb}>{spell.description}</span>
          {isSelected && <span className={styles.check}>✓ Chosen</span>}
        </button>
        <button
          type="button"
          className={styles.info}
          aria-label={`Details for ${spell.name}`}
          onClick={() => onDetails(spell)}
        >
          i
        </button>
      </div>
    );
  };

  return (
    <section className={styles.picker} aria-labelledby={`${id}-title`}>
      <div className={styles.header}>
        <h4 id={`${id}-title`} className={styles.title}>
          {title}
        </h4>
        <span className={styles.count} role="status">
          {selected.length} / {max} chosen
        </span>
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}

      {selected.length > 0 && (
        <ul className={styles.tray} aria-label="Chosen">
          {selected.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                className={styles.chip}
                aria-label={`Remove ${bySlug.get(slug)?.name ?? slug}`}
                onClick={() => onToggle(slug)}
              >
                {bySlug.get(slug)?.name ?? slug} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.filters}>
        <input
          type="search"
          className={styles.field}
          placeholder="Search by name"
          aria-label={`Search ${title}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {schools.length > 1 && (
          <select
            className={styles.field}
            aria-label={`Filter ${title} by school`}
            value={school}
            onChange={(event) => setSchool(event.target.value)}
          >
            <option value="">All schools</option>
            {schools.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 && (
        <p className={styles.empty}>No spells match.</p>
      )}
      {levels.map((level) => {
        const group = groupByLevel
          ? visible.filter((spell) => spell.level === level)
          : visible;
        return (
          <div key={level}>
            {groupByLevel && <h5 className={styles.group}>{levelLabel(level)}</h5>}
            <div className={styles.grid}>{group.map(renderSpell)}</div>
          </div>
        );
      })}
    </section>
  );
};
