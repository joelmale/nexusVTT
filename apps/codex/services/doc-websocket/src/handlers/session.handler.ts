import WebSocket from 'ws';
import { sessionService } from '../services/session.service';
import {
  SessionCreatePayload,
  SessionJoinPayload,
  SessionLeavePayload,
  SessionUpdateSettingsPayload,
  OutgoingEventType,
  SessionCreatePayloadSchema,
  SessionJoinPayloadSchema,
  SessionLeavePayloadSchema,
  SessionUpdateSettingsPayloadSchema,
} from '../types/events';

/**
 * Handle session creation
 */
export async function handleSessionCreate(
  ws: WebSocket,
  data: unknown
): Promise<void> {
  try {
    const payload: SessionCreatePayload = SessionCreatePayloadSchema.parse(data);

    const session = await sessionService.createSession({
      documentId: payload.documentId,
      campaignId: payload.campaignId,
      roomCode: payload.roomCode,
      presenter: payload.presenter,
      syncSettings: payload.syncSettings,
    });

    // Send success response to creator
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.SESSION_CREATED,
        data: session,
      })
    );

    console.log(`Session created: ${session.sessionId}`);
  } catch (error: any) {
    console.error('Error creating session:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to create session', error: error.message },
      })
    );
  }
}

/**
 * Handle session join
 */
export async function handleSessionJoin(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: SessionJoinPayload = SessionJoinPayloadSchema.parse(data);

    const session = await sessionService.addViewer(payload.sessionId, payload.userId);

    if (!session) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Session not found' },
        })
      );
      return;
    }

    // Send current session state to joining user
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.SESSION_JOINED,
        data: { session, userId: payload.userId },
      })
    );

    // Broadcast to others in the session
    broadcast(
      payload.sessionId,
      JSON.stringify({
        type: OutgoingEventType.SESSION_JOINED,
        data: { userId: payload.userId },
      }),
      ws
    );

    console.log(`User ${payload.userId} joined session ${payload.sessionId}`);
  } catch (error: any) {
    console.error('Error joining session:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to join session', error: error.message },
      })
    );
  }
}

/**
 * Handle session leave
 */
export async function handleSessionLeave(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void,
  userId?: string
): Promise<void> {
  try {
    const payload: SessionLeavePayload = SessionLeavePayloadSchema.parse(data);

    if (!userId) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'User ID not provided' },
        })
      );
      return;
    }

    const session = await sessionService.removeViewer(payload.sessionId, userId);

    if (session) {
      // Broadcast to others in the session
      broadcast(
        payload.sessionId,
        JSON.stringify({
          type: OutgoingEventType.SESSION_LEFT,
          data: { userId },
        })
      );

      console.log(`User ${userId} left session ${payload.sessionId}`);
    }
  } catch (error: any) {
    console.error('Error leaving session:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to leave session', error: error.message },
      })
    );
  }
}

/**
 * Handle session settings update
 */
export async function handleSessionUpdateSettings(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: SessionUpdateSettingsPayload = SessionUpdateSettingsPayloadSchema.parse(data);

    const session = await sessionService.updateSyncSettings(payload.sessionId, {
      syncSettings: payload.syncSettings,
    });

    if (!session) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Session not found' },
        })
      );
      return;
    }

    // Broadcast updated settings to all in session
    broadcast(
      payload.sessionId,
      JSON.stringify({
        type: OutgoingEventType.SESSION_UPDATED,
        data: { syncSettings: session.syncSettings },
      })
    );

    console.log(`Session ${payload.sessionId} settings updated`);
  } catch (error: any) {
    console.error('Error updating session settings:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to update settings', error: error.message },
      })
    );
  }
}
