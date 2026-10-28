import { useMemo, useState } from 'react';
import CalendarCheck from 'lucide-react/dist/esm/icons/calendar-check';
import CalendarPlus from 'lucide-react/dist/esm/icons/calendar-plus';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

import { selectNextSession } from '@/features/campaign-overview/overviewModel';
import { useSectionBundle } from './SectionContext';
import styles from './UseInNextSessionButton.module.css';

export interface UseInNextSessionButtonProps {
  kind: 'npc' | 'location' | 'encounter' | 'quest' | 'item' | 'secret';
  id: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function UseInNextSessionButton({
  kind,
  id,
  className,
  size = 'md',
}: UseInNextSessionButtonProps) {
  const { bundle, store } = useSectionBundle();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string>();

  const nextSession = useMemo(() => {
    return selectNextSession(bundle);
  }, [bundle]);

  const isLinked = useMemo(() => {
    if (!nextSession) return false;
    if (kind === 'item') {
      return (
        bundle.items?.some(
          (item) => item.id === id && item.sessionId === nextSession.id,
        ) ?? false
      );
    }
    if (kind === 'secret') {
      return (
        bundle.secrets?.some(
          (s) => s.id === id && s.revealedInSessionId === nextSession.id,
        ) ?? false
      );
    }
    if (kind === 'npc') {
      return (
        (nextSession.npcIds?.includes(id) ?? false) ||
        bundle.campaign.nextSession?.npcId === id
      );
    }
    if (kind === 'encounter') {
      return (
        (nextSession.encounterIds?.includes(id) ?? false) ||
        bundle.campaign.nextSession?.encounterId === id
      );
    }
    if (kind === 'location') {
      return (
        (nextSession.locationIds?.includes(id) ?? false) ||
        bundle.campaign.nextSession?.locationId === id
      );
    }
    if (kind === 'quest') {
      return (
        (nextSession.questIds?.includes(id) ?? false) ||
        bundle.campaign.nextSession?.questId === id
      );
    }
    return false;
  }, [bundle, id, kind, nextSession]);

  if (!nextSession) {
    return (
      <button
        aria-label="No sessions found. Create a session to link entities."
        className={`${styles.button} ${size === 'sm' ? styles.sm : styles.md} ${className ?? ''}`}
        disabled
        title="No sessions found. Create a session to link entities."
        type="button"
      >
        <CalendarPlus size={size === 'sm' ? 12 : 14} aria-hidden="true" />
        <span>Use in next session</span>
      </button>
    );
  }

  if (!store.editable) {
    if (isLinked) {
      return (
        <span
          className={`${styles.readOnlyBadge} ${className ?? ''}`}
          title={`Linked to Session ${nextSession.number}: ${nextSession.title}`}
        >
          <CalendarCheck size={12} aria-hidden="true" />
          <span>Next session</span>
        </span>
      );
    }
    return (
      <button
        aria-label="Example campaign is read-only. Clone this campaign to customize session prep."
        className={`${styles.button} ${size === 'sm' ? styles.sm : styles.md} ${className ?? ''}`}
        disabled
        title="Example campaign is read-only. Clone this campaign to customize session prep."
        type="button"
      >
        <CalendarPlus size={size === 'sm' ? 12 : 14} aria-hidden="true" />
        <span>Use in next session</span>
      </button>
    );
  }

  const handleToggle = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setError(undefined);
    try {
      let result;
      if (kind === 'item') {
        result = await store.updateItem('item', id, {
          sessionId: isLinked ? undefined : nextSession.id,
        });
      } else if (kind === 'secret') {
        result = await store.updateItem('secret', id, {
          revealedInSessionId: isLinked ? undefined : nextSession.id,
        });
      } else {
        const key = `${kind}Ids` as
          'npcIds' | 'encounterIds' | 'locationIds' | 'questIds';
        const currentList: string[] = nextSession[key] ?? [];
        const nextList = isLinked
          ? currentList.filter((itemId) => itemId !== id)
          : [...currentList, id];
        result = await store.updateItem('session', nextSession.id, {
          [key]: nextList,
        });
      }
      if (!result.ok)
        throw new Error(
          result.error || 'The session link could not be saved. Try again.',
        );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The session link could not be saved. Try again.',
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const title = isLinked
    ? `In Session ${nextSession.number} prep (${nextSession.title}) — click to remove`
    : `Add to Session ${nextSession.number} prep (${nextSession.title})`;

  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <>
      <button
        aria-label={title}
        aria-pressed={isLinked}
        className={`${styles.button} ${size === 'sm' ? styles.sm : styles.md} ${isLinked ? styles.linked : ''} ${className ?? ''}`}
        disabled={isUpdating}
        onClick={handleToggle}
        title={title}
        type="button"
      >
        {isUpdating ? (
          <Loader2
            className={styles.spinner}
            size={iconSize}
            aria-hidden="true"
          />
        ) : isLinked ? (
          <CalendarCheck size={iconSize} aria-hidden="true" />
        ) : (
          <CalendarPlus size={iconSize} aria-hidden="true" />
        )}
        <span>{isLinked ? 'In next session' : 'Use in next session'}</span>
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
