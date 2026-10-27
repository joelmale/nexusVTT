import { useRef, useState } from 'react';
import type { CharacterResource } from '@nexus/character-contracts';
import styles from './ClassResourceControls.module.css';

export interface ClassResourceControlsProps {
  resources: readonly CharacterResource[];
  disabled?: boolean;
  onConsume: (resourceId: string, amount: number) => void | Promise<void>;
  onRecord?: (
    resourceId: string,
    currentUses: number,
    cooldown: CharacterResource['cooldown'],
  ) => void | Promise<void>;
}

/** Hosts own persistence/authority; this view never invents a local balance. */
export function ClassResourceControls({
  resources,
  disabled = false,
  onConsume,
  onRecord,
}: ClassResourceControlsProps) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const inFlight = useRef(false);
  const record = async (
    id: string,
    currentUses: number,
    cooldown: CharacterResource['cooldown'],
  ) => {
    if (disabled || inFlight.current || !onRecord) return;
    inFlight.current = true;
    setPending(true);
    setStatus('Saving resource record…');
    try {
      await onRecord(id, currentUses, cooldown);
      setStatus('Resource record saved.');
    } catch {
      setStatus(
        'Resource record could not be saved. Check the values and retry.',
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const consume = async (resource: CharacterResource) => {
    if (
      disabled ||
      inFlight.current ||
      resource.active === false ||
      resource.unlimited ||
      (resource.cooldown && resource.cooldown.remaining > 0) ||
      resource.currentUses === undefined ||
      resource.currentUses < 1
    )
      return;
    inFlight.current = true;
    setPending(true);
    setStatus('Saving resource use…');
    try {
      await onConsume(resource.id, 1);
      setStatus(`${resource.name} use saved.`);
    } catch {
      setStatus(
        'Resource use could not be saved. Your displayed balance has not been confirmed.',
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const active = resources.filter((resource) => resource.active !== false);
  if (!active.length) return null;
  return (
    <fieldset className={styles.resources} disabled={disabled || pending}>
      <legend>Class resources</legend>
      {active.map((resource) => (
        <div key={resource.id} className={styles.row}>
          <strong>{resource.name}</strong>
          <span>
            {resource.unlimited
              ? 'Unlimited'
              : resource.currentUses === undefined
                ? 'Remaining uses not recorded'
                : `${resource.currentUses} / ${resource.maxUses} remaining`}
          </span>
          <button
            type="button"
            onClick={() => void consume(resource)}
            disabled={
              resource.unlimited ||
              Boolean(resource.cooldown && resource.cooldown.remaining > 0) ||
              resource.currentUses === undefined ||
              resource.currentUses < 1
            }
            aria-label={`Use ${resource.name}`}
          >
            Use 1
          </button>
          {resource.manualRecovery && (
            <p className={styles.note}>{resource.manualRecovery}</p>
          )}
          {resource.cooldown && resource.cooldown.remaining > 0 && (
            <p className={styles.note}>
              Cooldown: {resource.cooldown.remaining}{' '}
              {resource.cooldown.unit === 'day' ? 'days' : 'long rests'}{' '}
              remaining
            </p>
          )}
          {onRecord && !resource.unlimited && (
            <ResourceRecordEditor
              key={`${resource.id}:${resource.currentUses}:${resource.cooldown?.remaining}`}
              resource={resource}
              onRecord={record}
            />
          )}
        </div>
      ))}
      <div role="status" className={styles.status}>
        {status}
      </div>
    </fieldset>
  );
}

function ResourceRecordEditor({
  resource,
  onRecord,
}: {
  resource: CharacterResource;
  onRecord: NonNullable<ClassResourceControlsProps['onRecord']>;
}) {
  const [current, setCurrent] = useState(String(resource.currentUses ?? ''));
  const [remaining, setRemaining] = useState(
    String(resource.cooldown?.remaining ?? 0),
  );
  const [unit, setUnit] = useState<'day' | 'long-rest'>(
    resource.cooldown?.unit ?? 'long-rest',
  );
  const value = Number(current);
  const cooldown = Number(remaining);
  const valid =
    current.trim() !== '' &&
    remaining.trim() !== '' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= resource.maxUses &&
    Number.isSafeInteger(cooldown) &&
    cooldown >= 0 &&
    cooldown <= 1000 &&
    (cooldown === 0 || value === 0);
  return (
    <details className={styles.note}>
      <summary>Record {resource.name} recovery or correction</summary>
      <p>
        Record remaining uses after manual recovery, elapsed days, or correcting
        a balance. A rest does not advance a day-based cooldown.
      </p>
      <label>
        Remaining {resource.name} uses
        <input
          type="number"
          min={0}
          max={resource.maxUses}
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </label>
      <label>
        {resource.name} cooldown remaining
        <input
          type="number"
          min={0}
          max={1000}
          value={remaining}
          onChange={(event) => setRemaining(event.target.value)}
        />
      </label>
      <label>
        {resource.name} cooldown unit
        <select
          value={unit}
          onChange={(event) =>
            setUnit(event.target.value as 'day' | 'long-rest')
          }
        >
          <option value="day">Days</option>
          <option value="long-rest">Long rests</option>
        </select>
      </label>
      <button
        type="button"
        disabled={!valid}
        onClick={() =>
          void onRecord(resource.id, value, { remaining: cooldown, unit })
        }
      >
        Record {resource.name}
      </button>
    </details>
  );
}
