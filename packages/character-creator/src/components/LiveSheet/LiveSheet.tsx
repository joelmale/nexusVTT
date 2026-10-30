import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterCreationData } from '../../types/dnd';
import { buildLiveSheet, type LiveSheetModel, type SheetSection } from './liveSheetModel';
import styles from './LiveSheet.module.css';

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const DASH = '—';

export interface LiveSheetProps {
  data: CharacterCreationData;
  /** Jump to the decision behind a section. Omit to render a read-only sheet. */
  onEdit?: (section: SheetSection) => void;
  /** Whether a section's decision can be reopened from here. */
  canEdit?: (section: SheetSection) => boolean;
}

/**
 * The character sheet that fills in as the player chooses. It is parchment
 * in every theme, and each section links back to the decision behind it.
 */
export const LiveSheet: React.FC<LiveSheetProps> = ({ data, onEdit, canEdit }) => {
  const sheet = useMemo(() => buildLiveSheet(data), [data]);
  const changed = useChangedValues(sheet);
  const [open, setOpen] = useState(false);
  const sectionProps = { sheet, onEdit, canEdit };

  const vital = (key: keyof LiveSheetModel['vitals'], label: string, value: string) => (
    <div className={`${styles.vital} ${changed.has(key) ? styles.changed : ''}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
  const v = sheet.vitals;

  return (
    <aside className={styles.sheet} aria-label="Character sheet" data-open={open}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          HP {v.hitPoints ?? DASH} · AC {v.armorClass ?? DASH} · Speed{' '}
          {v.speed ?? DASH}
        </span>
        <span>{open ? 'Hide sheet' : 'Show sheet'}</span>
      </button>

      <div className={styles.body}>
        <Section {...sectionProps} id="story" title="Hero">
          <span className={sheet.name ? styles.name : `${styles.name} ${styles.unnamed}`}>
            {sheet.name ?? 'Unnamed hero'}
          </span>
          <span className={styles.subtitle}>
            {[
              sheet.speciesName,
              sheet.className &&
                `${sheet.className} ${sheet.level}${sheet.subclassName ? ` (${sheet.subclassName})` : ''}`,
              sheet.backgroundName,
            ]
              .filter(Boolean)
              .join(' · ') || `Level ${sheet.level}`}
          </span>
        </Section>

        <div className={styles.vitals}>
          {vital('hitPoints', 'HP', `${v.hitPoints ?? DASH}`)}
          {vital('armorClass', 'AC', `${v.armorClass ?? DASH}`)}
          {vital('speed', 'Speed', v.speed === null ? DASH : `${v.speed}`)}
          {vital('initiative', 'Init', v.initiative === null ? DASH : signed(v.initiative))}
          {vital('proficiencyBonus', 'Prof', signed(v.proficiencyBonus))}
        </div>

        <Section {...sectionProps} id="abilities" title="Abilities">
          <span className={styles.abilities}>
            {sheet.abilities.map((a) => (
              <span
                key={a.key}
                className={`${styles.ability} ${changed.has(a.key) ? styles.changed : ''}`}
              >
                <small>
                  {a.key}
                  {a.savingThrow && <span title="Saving throw proficiency"> ●</span>}
                </small>
                <b>{a.modifier === null ? DASH : signed(a.modifier)}</b>
                <span>{a.score ?? ''}</span>
              </span>
            ))}
          </span>
          {sheet.skills.length > 0 && (
            <span className={styles.list}>
              <em>Skills:</em> {sheet.skills.join(', ')}
            </span>
          )}
        </Section>

        {sheet.spellcasting && (
          <Section {...sectionProps} id="magic" title={`Spellcasting${sheet.spellcasting.ability ? ` · ${sheet.spellcasting.ability}` : ''}`}>
            <span className={styles.list}>
              Save DC <b>{sheet.spellcasting.saveDC ?? DASH}</b> · Attack{' '}
              <b>
                {sheet.spellcasting.attackBonus === null
                  ? DASH
                  : signed(sheet.spellcasting.attackBonus)}
              </b>
            </span>
            {sheet.spellcasting.slots.length > 0 && (
              <span className={styles.slots}>
                {sheet.spellcasting.slots.map(({ level, count }) => (
                  <span key={level} aria-label={`${count} ${ORDINAL[level]}-level slots`}>
                    {sheet.spellcasting!.pactMagic ? 'Pact ' : ''}
                    {ORDINAL[level]}{' '}
                    {Array.from({ length: count }, (_, i) => (
                      <i key={i} aria-hidden="true" />
                    ))}
                  </span>
                ))}
                {sheet.spellcasting.pactMagic && (
                  <span className={styles.note}>refresh on a short rest</span>
                )}
              </span>
            )}
            {sheet.spellcasting.cantrips.length > 0 && (
              <span className={styles.list}>
                <em>Cantrips:</em> {sheet.spellcasting.cantrips.join(', ')}
              </span>
            )}
            {sheet.spellcasting.spells.length > 0 && (
              <span className={styles.list}>
                <em>Prepared:</em> {sheet.spellcasting.spells.join(', ')}
              </span>
            )}
          </Section>
        )}

        <Section {...sectionProps} id="species" title="Species traits">
          {sheet.traits.length > 0 && (
            <span className={styles.list}>{sheet.traits.join(' · ')}</span>
          )}
        </Section>

        <Section {...sectionProps} id="class" title="Features">
          {sheet.features.length > 0 && (
            <span className={styles.list}>{sheet.features.join(' · ')}</span>
          )}
        </Section>
      </div>
    </aside>
  );
};

const Section: React.FC<{
  id: SheetSection;
  title: string;
  children: React.ReactNode;
  sheet: LiveSheetModel;
  onEdit?: (section: SheetSection) => void;
  canEdit?: (section: SheetSection) => boolean;
}> = ({ id, title, children, sheet, onEdit, canEdit }) => {
  const editable = Boolean(onEdit) && (canEdit?.(id) ?? true);
  const body = (
    <>
      <span className={styles.sectionTitle}>
        {title}
        {editable && <span className={styles.editHint}>Change</span>}
      </span>
      {children}
      {sheet.pending[id] && <span className={styles.pending}>{sheet.pending[id]}</span>}
    </>
  );
  return editable ? (
    <button
      type="button"
      className={styles.section}
      onClick={() => onEdit?.(id)}
      aria-label={`${title}: change`}
    >
      {body}
    </button>
  ) : (
    <div className={styles.section}>{body}</div>
  );
};

/** Keys whose values changed since the last render, highlighted briefly. */
function useChangedValues(sheet: LiveSheetModel): Set<string> {
  const previous = useRef<Record<string, unknown> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  useEffect(() => {
    const current: Record<string, unknown> = { ...sheet.vitals };
    for (const a of sheet.abilities) current[a.key] = a.score;
    const before = previous.current;
    previous.current = current;
    if (!before) return;
    const keys = Object.keys(current).filter(
      (key) => before[key] !== current[key] && current[key] !== null,
    );
    if (!keys.length) return;
    setChanged(new Set(keys));
    const timer = window.setTimeout(() => setChanged(new Set()), 1200);
    return () => window.clearTimeout(timer);
  }, [sheet]);
  return changed;
}
