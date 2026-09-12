import WebSocket from 'ws';
import { sessionService } from '../services/session.service';
import {
  VttRegisterPayload,
  VttEntityPushPayload,
  VttStateUpdatePayload,
  VttRegisterPayloadSchema,
  VttEntityPushPayloadSchema,
  VttStateUpdatePayloadSchema,
  OutgoingEventType,
} from '../types/events';

const ensurePresenter = async (sessionId: string, userId: string) => {
  const session = await sessionService.getSession(sessionId);
  if (!session) return { ok: false, session: null };
  if (session.presenter !== userId) return { ok: false, session };
  return { ok: true, session };
};

export async function handleVttRegister(
  ws: WebSocket,
  data: unknown
): Promise<void> {
  try {
    const payload: VttRegisterPayload = VttRegisterPayloadSchema.parse(data);
    const session = await sessionService.getSession(payload.sessionId);

    if (!session) {
      ws.send(JSON.stringify({ type: OutgoingEventType.ERROR, data: { message: 'Session not found' } }));
      return;
    }

    ws.send(
      JSON.stringify({
        type: OutgoingEventType.VTT_REGISTERED,
        data: { sessionId: payload.sessionId, vtt: payload.vtt },
      })
    );
  } catch (error: any) {
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to register VTT', error: error.message },
      })
    );
  }
}

export async function handleVttEntityPush(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: VttEntityPushPayload = VttEntityPushPayloadSchema.parse(data);
    const guard = await ensurePresenter(payload.sessionId, payload.userId);

    if (!guard.session) {
      ws.send(JSON.stringify({ type: OutgoingEventType.ERROR, data: { message: 'Session not found' } }));
      return;
    }
    if (!guard.ok) {
      ws.send(JSON.stringify({ type: OutgoingEventType.ERROR, data: { message: 'Presenter required' } }));
      return;
    }

    broadcast(
      payload.sessionId,
      JSON.stringify({
        type: OutgoingEventType.VTT_ENTITY_PUSHED,
        data: { entity: payload.entity },
      }),
      ws
    );
  } catch (error: any) {
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to push entity', error: error.message },
      })
    );
  }
}

export async function handleVttStateUpdate(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: VttStateUpdatePayload = VttStateUpdatePayloadSchema.parse(data);
    const guard = await ensurePresenter(payload.sessionId, payload.userId);

    if (!guard.session) {
      ws.send(JSON.stringify({ type: OutgoingEventType.ERROR, data: { message: 'Session not found' } }));
      return;
    }
    if (!guard.ok) {
      ws.send(JSON.stringify({ type: OutgoingEventType.ERROR, data: { message: 'Presenter required' } }));
      return;
    }

    broadcast(
      payload.sessionId,
      JSON.stringify({
        type: OutgoingEventType.VTT_STATE_UPDATED,
        data: { status: payload.status },
      }),
      ws
    );
  } catch (error: any) {
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to update VTT state', error: error.message },
      })
    );
  }
}
