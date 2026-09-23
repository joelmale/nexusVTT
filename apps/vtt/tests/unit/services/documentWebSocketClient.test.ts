import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/notifications', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  send = vi.fn();
  close = vi.fn((code = 1000, reason = '') => { this.readyState = MockWebSocket.CLOSED; this.onclose?.({ code, reason }); });
  constructor(readonly url: string) { MockWebSocket.instances.push(this); }
  open(): void { this.readyState = MockWebSocket.OPEN; this.onopen?.(); }
}

describe('DocumentWebSocketClient', () => {
  beforeEach(() => { MockWebSocket.instances = []; vi.stubGlobal('WebSocket', MockWebSocket); });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('queues messages until connected, dispatches server events, and answers heartbeat pings', async () => {
    const { documentWebSocketClient: client } = await import('@/services/documentWebSocketClient');
    const callback = vi.fn();
    const unsubscribe = client.subscribe('session:created', callback);
    client.createSession('doc-1', 'campaign-1', 'ROOM', 'host-1');
    const connection = client.connect('token-1');
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toContain('/ws?token=token-1');
    socket.open(); await connection;
    expect(client.isConnected()).toBe(true);
    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('doc:session:create'));
    socket.onmessage?.({ data: JSON.stringify({ type: 'session:created', data: { sessionId: 'session-1' } }) });
    socket.onmessage?.({ data: JSON.stringify({ type: 'heartbeat', data: { type: 'ping', id: 'ping-1' }, timestamp: 42 }) });
    expect(callback).toHaveBeenCalledWith({ sessionId: 'session-1' });
    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('"pong"'));
    unsubscribe(); client.disconnect();
  });

  it('sends presenter navigation updates and skips them for a viewer', async () => {
    const { documentWebSocketClient: client } = await import('@/services/documentWebSocketClient');
    const connecting = client.connect('token'); const socket = MockWebSocket.instances[0]; socket.open(); await connecting;
    client.joinSession('session-1', 'host-1', true);
    client.updateSettings({ syncPage: false }); client.syncPage(3); client.syncScroll(20); client.syncZoom(1.5);
    const sent = socket.send.mock.calls.map(([value]) => String(value)).join('\n');
    expect(sent).toContain('doc:session:update-settings'); expect(sent).toContain('doc:page:change'); expect(sent).toContain('doc:scroll:sync'); expect(sent).toContain('doc:zoom:sync');
    const callsBeforeViewer = socket.send.mock.calls.length;
    client.joinSession('session-1', 'viewer-1', false); client.syncPage(4); client.syncScroll(30); client.syncZoom(2);
    expect(socket.send).toHaveBeenCalledTimes(callsBeforeViewer + 1);
    client.disconnect();
  });
});
