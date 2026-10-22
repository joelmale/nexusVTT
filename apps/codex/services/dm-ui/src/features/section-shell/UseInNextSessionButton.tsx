import { useMemo, useState } from 'react';
import CalendarCheck from 'lucide-react/dist/esm/icons/calendar-check';
import CalendarPlus from 'lucide-react/dist/esm/icons/calendar-plus';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

import { pickUpcomingSession } from '@/features/campaign-overview/overviewModel';
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

  const nextSession = useMemo(() => {
    const curatedId = bundle.campaign.nextSession?.sessionId;
    return curatedId
      ? bundle.sessions.find((s) => s.id === curatedId)
      : pickUpcomingSession(bundle.sessions, Date.now());
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
      return nextSession.npcIds?.includes(id) ?? false;
    }
    if (kind === 'encounter') {
      return nextSession.encounterIds?.includes(id) ?? false;
    }
    if (kind === 'location') {
      return nextSession.locationIds?.includes(id) ?? false;
    }
    if (kind === 'quest') {
      return nextSession.questIds?.includes(id) ?? false;
    }
    return false;
  }, [bundle, id, kind, nextSession]);

  if (!nextSession) return null;

  if (!store.editable) {
    if (!isLinked) return null;
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

  const handleToggle = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      if (kind === 'item') {
        await store.updateItem('item', id, {
          sessionId: isLinked ? undefined : nextSession.id,
        });
      } else if (kind === 'secret') {
        await store.updateItem('secret', id, {
          revealedInSessionId: isLinked ? undefined : nextSession.id,
        });
      } else {
        const key = `${kind}Ids` as
          | 'npcIds'
          | 'encounterIds'
          | 'locationIds'
          | 'questIds';
        const currentList: string[] = nextSession[key] ?? [];
        const nextList = isLinked
          ? currentList.filter((itemId) => itemId !== id)
          : [...currentList, id];
        await store.updateItem('session', nextSession.id, {
          [key]: nextList,
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const title = isLinked
    ? `In Session ${nextSession.number} prep (${nextSession.title}) — click to remove`
    : `Add to Session ${nextSession.number} prep (${nextSession.title})`;

  return (
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
        <Loader2 className={styles.spinner} size={14} aria-hidden="true" />
      ) : isLinked ? (
        <CalendarCheck size={14} aria-hidden="true" />
      ) : (
        <CalendarPlus size={14} aria-hidden="true" />
      )}
      <span>{isLinked ? 'In next session' : 'Use in next session'}</span>
    </button>
  );
}
