import { useRef, useState } from 'react';
import type { CharacterResource } from '@nexus/character-contracts';
import styles from './ClassResourceControls.module.css';

export interface ClassResourceControlsProps {
  resources: readonly CharacterResource[];
  disabled?: boolean;
  onConsume: (resourceId: string, amount: number) => void | Promise<void>;
}

/** Hosts own persistence/authority; this view never invents a local balance. */
export function ClassResourceControls({
  resources,
  disabled = false,
  onConsume,
}: ClassResourceControlsProps) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const inFlight = useRef(false);
  const consume = async (resource: CharacterResource) => {
    if (
      disabled ||
      inFlight.current ||
      resource.active === false ||
      resource.unlimited ||
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
        </div>
      ))}
      <div role="status" className={styles.status}>
        {status}
      </div>
    </fieldset>
  );
}
