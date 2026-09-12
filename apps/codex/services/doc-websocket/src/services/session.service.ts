import { v4 as uuidv4 } from 'uuid';
import { redisService } from './redis.service';
import { DocumentSession, CreateSessionInput, UpdateSessionSettingsInput } from '../types/session';

class SessionService {
  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput): Promise<DocumentSession> {
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const session: DocumentSession = {
      sessionId,
      documentId: input.documentId,
      campaignId: input.campaignId,
      roomCode: input.roomCode,
      presenter: input.presenter,
      viewers: [],
      currentPage: 1,
      scrollPosition: 0,
      activeHighlights: [],
      syncSettings: input.syncSettings || {
        syncScroll: true,
        syncPage: true,
        syncHighlight: true,
      },
      startedAt: now,
      lastActivity: now,
    };

    await redisService.setSession(sessionId, JSON.stringify(session));

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<DocumentSession | null> {
    const data = await redisService.getSession(sessionId);
    if (!data) {
      return null;
    }

    return JSON.parse(data) as DocumentSession;
  }

  /**
   * Update session (save changes)
   */
  async updateSession(session: DocumentSession): Promise<void> {
    session.lastActivity = new Date().toISOString();
    await redisService.setSession(session.sessionId, JSON.stringify(session));
  }

  /**
   * Add viewer to session
   */
  async addViewer(sessionId: string, userId: string): Promise<DocumentSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    if (!session.viewers.includes(userId)) {
      session.viewers.push(userId);
      await this.updateSession(session);
    }

    return session;
  }

  /**
   * Remove viewer from session
   */
  async removeViewer(sessionId: string, userId: string): Promise<DocumentSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    session.viewers = session.viewers.filter((id) => id !== userId);
    await this.updateSession(session);

    return session;
  }

  /**
   * Update current page
   */
  async updatePage(sessionId: string, page: number): Promise<DocumentSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    session.currentPage = page;
    await this.updateSession(session);

    return session;
  }

  /**
   * Update scroll position
   */
  async updateScroll(sessionId: string, position: number): Promise<DocumentSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    session.scrollPosition = position;
    await this.updateSession(session);

    return session;
  }

  /**
   * Update sync settings
   */
  async updateSyncSettings(
    sessionId: string,
    settings: UpdateSessionSettingsInput
  ): Promise<DocumentSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    session.syncSettings = {
      ...session.syncSettings,
      ...settings.syncSettings,
    };
    await this.updateSession(session);

    return session;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await redisService.deleteSession(sessionId);
  }

  /**
   * Refresh session TTL
   */
  async refreshSession(sessionId: string): Promise<void> {
    await redisService.refreshSession(sessionId);
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(): Promise<DocumentSession[]> {
    const sessionIds = await redisService.getAllSessionIds();
    const sessions: DocumentSession[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }
}

export const sessionService = new SessionService();
