import WebSocket from 'ws';
import { sessionService } from '../services/session.service';
import {
  PageChangePayload,
  ScrollSyncPayload,
  OutgoingEventType,
  PageChangePayloadSchema,
  ScrollSyncPayloadSchema,
} from '../types/events';

/**
 * Handle page change event
 */
export async function handlePageChange(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: PageChangePayload = PageChangePayloadSchema.parse(data);

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

    // Only broadcast if page sync is enabled
    if (session.syncSettings.syncPage) {
      broadcast(
        payload.sessionId,
        JSON.stringify({
          type: OutgoingEventType.PAGE_CHANGED,
          data: { page: payload.page },
        }),
        ws
      );
    }

    console.log(`Page changed to ${payload.page} in session ${payload.sessionId}`);
  } catch (error: any) {
    console.error('Error changing page:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to change page', error: error.message },
      })
    );
  }
}

/**
 * Handle scroll sync event
 */
export async function handleScrollSync(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: ScrollSyncPayload = ScrollSyncPayloadSchema.parse(data);

    const session = await sessionService.updateScroll(payload.sessionId, payload.position);

    if (!session) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Session not found' },
        })
      );
      return;
    }

    // Only broadcast if scroll sync is enabled
    if (session.syncSettings.syncScroll) {
      broadcast(
        payload.sessionId,
        JSON.stringify({
          type: OutgoingEventType.SCROLL_SYNCED,
          data: { position: payload.position },
        }),
        ws
      );
    }

    console.log(`Scroll synced to ${payload.position} in session ${payload.sessionId}`);
  } catch (error: any) {
    console.error('Error syncing scroll:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to sync scroll', error: error.message },
      })
    );
  }
}
