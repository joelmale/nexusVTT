import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { Session, SessionFormData } from '@/types/session';
import { generateId } from '@/lib/utils';

export function useSessions(campaignId?: string) {
  // Get all sessions for a campaign
  const sessions = useLiveQuery(
    () => {
      if (!campaignId) return [];
      return db.sessions
        .where('campaignId')
        .equals(campaignId)
        .sortBy('sessionNumber');
    },
    [campaignId]
  );

  // Get upcoming sessions
  const upcomingSessions = useLiveQuery(
    () => {
      if (!campaignId) return [];
      const now = Date.now();
      return db.sessions
        .where('campaignId')
        .equals(campaignId)
        .and((s) => s.status === 'planned' && (s.plannedDate || 0) >= now)
        .sortBy('plannedDate');
    },
    [campaignId]
  );

  // Get completed sessions
  const completedSessions = useLiveQuery(
    () => {
      if (!campaignId) return [];
      return db.sessions
        .where('campaignId')
        .equals(campaignId)
        .and((s) => s.status === 'completed')
        .reverse()
        .sortBy('sessionNumber');
    },
    [campaignId]
  );

  // Get session by ID
  const getSession = async (sessionId: string): Promise<Session | undefined> => {
    return db.sessions.get(sessionId);
  };

  // Get next session number
  const getNextSessionNumber = async (campaignId: string): Promise<number> => {
    const lastSession = await db.sessions
      .where('campaignId')
      .equals(campaignId)
      .reverse()
      .sortBy('sessionNumber');

    return lastSession.length > 0 ? lastSession[0].sessionNumber + 1 : 1;
  };

  // Create session
  const createSession = async (
    campaignId: string,
    data: SessionFormData
  ): Promise<Session> => {
    const session: Session = {
      id: generateId(),
      campaignId,
      title: data.title,
      sessionNumber: data.sessionNumber,
      plannedDate: data.plannedDate,
      actualDate: data.actualDate,
      duration: data.duration,
      status: data.status,
      worldId: data.worldId,
      summary: data.summary,
      notes: data.notes,
      participants: data.participants || [],
      experience_awarded: data.experience_awarded,
      treasure_awarded: data.treasure_awarded,
      quests_advanced: data.quests_advanced || [],
      npcs_encountered: data.npcs_encountered || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.sessions.add(session);
    return session;
  };

  // Update session
  const updateSession = async (
    id: string,
    data: Partial<SessionFormData>
  ): Promise<void> => {
    await db.sessions.update(id, {
      ...data,
      updatedAt: Date.now(),
    });
  };

  // Delete session
  const deleteSession = async (id: string): Promise<void> => {
    await db.transaction('rw', [db.sessions, db.notes, db.journalEntries], async () => {
      // Delete session
      await db.sessions.delete(id);

      // Clean up references
      await db.notes.where('sessionId').equals(id).modify({ sessionId: undefined });
      await db.journalEntries.where('sessionId').equals(id).modify({ sessionId: undefined });
    });
  };

  // Duplicate session
  const duplicateSession = async (id: string): Promise<Session> => {
    const original = await db.sessions.get(id);
    if (!original) throw new Error('Session not found');

    const nextSessionNumber = await getNextSessionNumber(original.campaignId);

    const duplicate: Session = {
      ...original,
      id: generateId(),
      sessionNumber: nextSessionNumber,
      title: `${original.title} (Copy)`,
      status: 'planned',
      actualDate: undefined,
      plannedDate: undefined,
      summary: undefined,
      notes: original.notes, // Keep planning notes
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.sessions.add(duplicate);
    return duplicate;
  };

  // Mark session as completed
  const completeSession = async (
    id: string,
    completionData: {
      actualDate?: number;
      duration?: number;
      summary?: string;
      experience_awarded?: number;
      treasure_awarded?: string;
      npcs_encountered?: string[];
      quests_advanced?: string[];
    }
  ): Promise<void> => {
    await db.sessions.update(id, {
      status: 'completed',
      actualDate: completionData.actualDate || Date.now(),
      duration: completionData.duration,
      summary: completionData.summary,
      experience_awarded: completionData.experience_awarded,
      treasure_awarded: completionData.treasure_awarded,
      npcs_encountered: completionData.npcs_encountered,
      quests_advanced: completionData.quests_advanced,
      updatedAt: Date.now(),
    });
  };

  // Cancel session
  const cancelSession = async (id: string): Promise<void> => {
    await db.sessions.update(id, {
      status: 'cancelled',
      updatedAt: Date.now(),
    });
  };

  // Reschedule session
  const rescheduleSession = async (id: string, newDate: number): Promise<void> => {
    await db.sessions.update(id, {
      plannedDate: newDate,
      updatedAt: Date.now(),
    });
  };

  return {
    sessions: sessions || [],
    upcomingSessions: upcomingSessions || [],
    completedSessions: completedSessions || [],
    getSession,
    getNextSessionNumber,
    createSession,
    updateSession,
    deleteSession,
    duplicateSession,
    completeSession,
    cancelSession,
    rescheduleSession,
  };
}
