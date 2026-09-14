import type { Page, WebSocketRoute } from '@playwright/test';

export interface ObservedServerMessage {
  type: string;
  data: Record<string, unknown>;
  eventId?: string;
  serverSequence?: number;
}

export interface WebSocketObservation {
  messages: ObservedServerMessage[];
  sentMessages: ObservedServerMessage[];
  socketUrls: string[];
  closedSocketCount: number;
  disconnect(): Promise<void>;
  reconnect(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Observes every socket opened by a page, including automatic reconnects. */
interface BrowserSocketTestHooks {
  resendLast(type: string, eventName?: string): boolean;
}

declare global {
  interface Window {
    __nexusSocketTestHooks?: BrowserSocketTestHooks;
    __nexusWebSocketBackend?: string;
  }
}

/**
 * Pins every WebSocket opened by this page to one backend replica. HTTP still
 * flows through the frontend proxy, so isolated contexts share the normal
 * session/cookie behavior while the test controls socket placement.
 */
export async function routeWebSocketsToBackend(
  page: Page,
  backendUrl: string,
): Promise<void> {
  await page.addInitScript((initialBackendUrl: string) => {
    window.__nexusWebSocketBackend = initialBackendUrl;
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = new Proxy(NativeWebSocket, {
      construct(target, argumentsList) {
        const requestedUrl = new URL(String(argumentsList[0]), location.href);
        const backend = new URL(
          window.__nexusWebSocketBackend || initialBackendUrl,
        );
        requestedUrl.protocol = backend.protocol === 'https:' ? 'wss:' : 'ws:';
        requestedUrl.host = backend.host;
        argumentsList[0] = requestedUrl.toString();
        return Reflect.construct(target, argumentsList);
      },
    });
  }, backendUrl);
}

export async function setWebSocketBackend(
  page: Page,
  backendUrl: string,
): Promise<void> {
  await page.evaluate((target) => {
    window.__nexusWebSocketBackend = target;
  }, backendUrl);
}

function parseObservedMessage(payload: string): ObservedServerMessage | null {
  try {
    const decoded: unknown = JSON.parse(payload);
    if (
      isRecord(decoded) &&
      typeof decoded.type === 'string' &&
      isRecord(decoded.data)
    ) {
      return {
        type: decoded.type,
        data: decoded.data,
        eventId:
          typeof decoded.eventId === 'string' ? decoded.eventId : undefined,
        serverSequence:
          typeof decoded.serverSequence === 'number'
            ? decoded.serverSequence
            : undefined,
      };
    }
  } catch {
    // MessagePack frames are intentionally ignored by JSON diagnostics.
  }
  return null;
}

export async function observeWebSocketMessages(
  page: Page,
): Promise<WebSocketObservation> {
  let networkAvailable = true;
  const activeRoutes = new Set<WebSocketRoute>();
  const observation: WebSocketObservation = {
    messages: [],
    sentMessages: [],
    socketUrls: [],
    closedSocketCount: 0,
    async disconnect(): Promise<void> {
      networkAvailable = false;
      await Promise.all(
        Array.from(activeRoutes).map((route) =>
          route.close({ code: 1012, reason: 'E2E simulated connection loss' }),
        ),
      );
      activeRoutes.clear();
    },
    reconnect(): void {
      networkAvailable = true;
    },
  };

  await page.routeWebSocket(/.*/, async (route) => {
    if (!networkAvailable) {
      await route.close({ code: 1013, reason: 'E2E network unavailable' });
      return;
    }
    activeRoutes.add(route);
    route.onClose(() => activeRoutes.delete(route));
    route.connectToServer();
  });

  await page.addInitScript(() => {
    const frames: string[] = [];
    const sockets = new Set<WebSocket>();
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function send(
      data: string | ArrayBufferLike | Blob | ArrayBufferView,
    ): void {
      sockets.add(this);
      if (typeof data === 'string') frames.push(data);
      originalSend.call(this, data);
    };
    window.__nexusSocketTestHooks = {
      resendLast(type: string, eventName?: string): boolean {
        const frame = frames.findLast((candidate) => {
          try {
            const parsed = JSON.parse(candidate) as {
              type?: string;
              data?: { name?: string };
            };
            return (
              parsed.type === type &&
              (eventName === undefined || parsed.data?.name === eventName)
            );
          } catch {
            return false;
          }
        });
        const socket = Array.from(sockets).findLast(
          (candidate) => candidate.readyState === WebSocket.OPEN,
        );
        if (!frame || !socket) return false;
        originalSend.call(socket, frame);
        return true;
      },
    };
  });

  page.on('websocket', (socket) => {
    observation.socketUrls.push(socket.url());
    socket.on('close', () => {
      observation.closedSocketCount += 1;
    });
    socket.on('framereceived', ({ payload }) => {
      const text =
        typeof payload === 'string' ? payload : payload.toString('utf8');
      const message = parseObservedMessage(text);
      if (message) observation.messages.push(message);
    });
    socket.on('framesent', ({ payload }) => {
      const text =
        typeof payload === 'string' ? payload : payload.toString('utf8');
      const message = parseObservedMessage(text);
      if (message) observation.sentMessages.push(message);
    });
  });

  return observation;
}

export async function resendLastClientMessage(
  page: Page,
  type: string,
  eventName?: string,
): Promise<void> {
  const resent = await page.evaluate(
    ({ messageType, name }) =>
      window.__nexusSocketTestHooks?.resendLast(messageType, name) ?? false,
    { messageType: type, name: eventName },
  );
  if (!resent) {
    throw new Error(`No open socket frame found for ${eventName || type}`);
  }
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
