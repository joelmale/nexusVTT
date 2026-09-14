import WebSocket from 'ws';
import { sessionService } from '../services/session.service';
import {
  PushPagePayload,
  PushReferencePayload,
  OutgoingEventType,
  PushPagePayloadSchema,
  PushReferencePayloadSchema,
} from '../types/events';

/**
 * Handle DM push page (force navigation)
 * Forces all viewers to navigate to a specific page
 */
export async function handlePushPage(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: PushPagePayload = PushPagePayloadSchema.parse(data);

    const session = await sessionService.updatePage(payload.sessionId, payload.page);

    if (!session) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Session not found' },
        })
      );
      return;
    }

    // Force push to all viewers (excluding presenter)
    broadcast(
      payload.sessionId,
      JSON.stringify({
        type: OutgoingEventType.PAGE_PUSHED,
        data: { page: payload.page },
      }),
      ws
    );

    console.log(`DM pushed page ${payload.page} to session ${payload.sessionId}`);
  } catch (error: any) {
    console.error('Error pushing page:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to push page', error: error.message },
      })
    );
  }
}

/**
 * Handle DM push reference
 * Pushes a bookmark/reference to all viewers
 */
export async function handlePushReference(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: PushReferencePayload = PushReferencePayloadSchema.parse(data);

    const session = await sessionService.getSession(payload.sessionId);

    if (!session) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Session not found' },
        })
      );
      return;
    }

    // Broadcast reference to all viewers (excluding presenter)
    broadcast(
      payload.sessionId,
      JSON.stringify({
        type: OutgoingEventType.REFERENCE_PUSHED,
        data: { referenceId: payload.referenceId },
      }),
      ws
    );

    console.log(`DM pushed reference ${payload.referenceId} to session ${payload.sessionId}`);
  } catch (error: any) {
    console.error('Error pushing reference:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to push reference', error: error.message },
      })
    );
  }
}
