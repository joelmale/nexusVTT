import type { Page } from '@playwright/test';

export interface ObservedServerMessage {
  type: string;
  data: Record<string, unknown>;
}

export interface WebSocketObservation {
  messages: ObservedServerMessage[];
  socketUrls: string[];
  closedSocketCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Observes every socket opened by a page, including automatic reconnects. */
export function observeWebSocketMessages(page: Page): WebSocketObservation {
  const observation: WebSocketObservation = {
    messages: [],
    socketUrls: [],
    closedSocketCount: 0,
  };

  page.on('websocket', (socket) => {
    observation.socketUrls.push(socket.url());
    socket.on('close', () => {
      observation.closedSocketCount += 1;
    });
    socket.on('framereceived', ({ payload }) => {
      const text =
        typeof payload === 'string' ? payload : payload.toString('utf8');
      try {
        const decoded: unknown = JSON.parse(text);
        if (
          isRecord(decoded) &&
          typeof decoded.type === 'string' &&
          isRecord(decoded.data)
        ) {
          observation.messages.push({
            type: decoded.type,
            data: decoded.data,
          });
        }
      } catch {
        // The production transport may negotiate MessagePack. UI assertions
        // remain authoritative; this observer only records JSON diagnostics.
      }
    });
  });

  return observation;
}

export function eventMessages(
  observation: WebSocketObservation,
  eventName: string,
): ObservedServerMessage[] {
  return observation.messages.filter(
    (message) => message.type === 'event' && message.data.name === eventName,
  );
}

export function messagesOfType(
  observation: WebSocketObservation,
  type: string,
): ObservedServerMessage[] {
  return observation.messages.filter((message) => message.type === type);
}
