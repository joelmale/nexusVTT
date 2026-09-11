/**
 * Document WebSocket Client
 * Manages client connection to the NexusCodex doc-websocket server
 */

import { toast } from '@/utils/notifications';

export interface DocumentSessionSettings {
  syncScroll: boolean;
  syncPage: boolean;
  syncHighlight: boolean;
  syncZoom: boolean;
}

export interface DocumentSessionState {
  sessionId: string;
  documentId: string;
  campaignId: string;
  roomCode: string;
  presenter: string;
  viewers: string[];
  currentPage: number;
  scrollPosition: number;
  zoom: number;
  syncSettings: DocumentSessionSettings;
}

export interface DocumentWebSocketIncomingEvents {
  'session:created': DocumentSessionState;
  'session:joined': { session?: DocumentSessionState; userId: string };
  'session:left': { userId: string };
  'session:updated': { syncSettings: Partial<DocumentSessionSettings> };
  'page:changed': { page: number };
  'scroll:synced': { position: number };
  'zoom:synced': { zoom: number };
  error: { message: string; error?: string };
  heartbeat: { type: 'ping'; id: string };
}

type DocumentWebSocketIncomingType = keyof DocumentWebSocketIncomingEvents;

type DocumentWebSocketMessage = {
  [T in DocumentWebSocketIncomingType]: {
    type: T;
    data: DocumentWebSocketIncomingEvents[T];
    timestamp?: number;
  };
}[DocumentWebSocketIncomingType];

type DocumentWebSocketOutgoingMessage =
  | {
      type: 'doc:session:create';
      data: {
        documentId: string;
        campaignId: string;
        roomCode: string;
        presenter: string;
        syncSettings?: Partial<DocumentSessionSettings>;
      };
    }
  | { type: 'doc:session:join'; data: { sessionId: string; userId: string } }
  | { type: 'doc:session:leave'; data: { sessionId: string } }
  | {
      type: 'doc:session:update-settings';
      data: { sessionId: string; syncSettings: Partial<DocumentSessionSettings> };
    }
  | { type: 'doc:page:change'; data: { sessionId: string; page: number } }
  | { type: 'doc:scroll:sync'; data: { sessionId: string; position: number } }
  | { type: 'doc:zoom:sync'; data: { sessionId: string; zoom: number } }
  | { type: 'heartbeat'; data: { type: 'pong'; id: string; serverTime?: number } };

type MessageCallback<T extends DocumentWebSocketIncomingType> = (
  data: DocumentWebSocketIncomingEvents[T],
) => void;

class DocumentWebSocketClient extends EventTarget {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private currentSessionId: string | null = null;
  private currentUserId: string | null = null;
  private isPresenter = false;
  
  // Connection management
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageQueue: DocumentWebSocketOutgoingMessage[] = [];
  
  // Subscriptions by event type
  private callbacks: Partial<Record<DocumentWebSocketIncomingType, Set<(data: unknown) => void>>> = {};

  constructor() {
    super();
  }

  /**
   * Register a callback for a specific outgoing event type from the server
   */
  subscribe<T extends DocumentWebSocketIncomingType>(
    eventType: T,
    callback: MessageCallback<T>,
  ): () => void {
    if (!this.callbacks[eventType]) {
      this.callbacks[eventType] = new Set();
    }
    this.callbacks[eventType].add(callback as (data: unknown) => void);
    
    // Return unsubscribe function
    return () => {
      this.callbacks[eventType]?.delete(callback as (data: unknown) => void);
    };
  }

  /**
   * Connect to doc-websocket server
   */
  async connect(token: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.token = token;

    const baseWsUrl = import.meta.env.VITE_DOC_WS_URL || 'ws://localhost:3002';
    const wsUrl = `${baseWsUrl}/ws?token=${token}`;

    console.log(`🔌 Attempting doc-websocket connection to ${baseWsUrl}...`);

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          ws.close();
          this.isConnecting = false;
          reject(new Error('Document WebSocket connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.ws = ws;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log('✅ Document WebSocket connected successfully');
          
          // Dispatch open event
          this.dispatchEvent(new Event('open'));

          // Flush queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg) {
              this.send(msg);
            }
          }
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as DocumentWebSocketMessage;
            this.handleMessage(message);
          } catch (err) {
            console.error('Failed to parse doc-websocket message:', err);
          }
        };

        ws.onclose = (event) => {
          clearTimeout(timeout);
          this.ws = null;
          this.isConnecting = false;
          console.log('🔌 Document WebSocket disconnected:', event.code, event.reason);
          this.dispatchEvent(new Event('close'));

          if (event.code !== 1000 && event.code !== 1001) {
            this.handleReconnect();
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          console.error('❌ Document WebSocket error:', error);
          reject(error);
        };
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  /**
   * Disconnect WebSocket client
   */
  disconnect(): void {
    if (this.currentSessionId) {
      this.leaveSession();
    }
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
    this.token = null;
    this.currentUserId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send event payload to server
   */
  send(message: DocumentWebSocketOutgoingMessage): void;
  send<T extends DocumentWebSocketOutgoingMessage['type']>(
    type: T,
    data: Extract<DocumentWebSocketOutgoingMessage, { type: T }>['data'],
  ): void;
  send<T extends DocumentWebSocketOutgoingMessage['type']>(
    typeOrMessage: T | DocumentWebSocketOutgoingMessage,
    data?: Extract<DocumentWebSocketOutgoingMessage, { type: T }>['data'],
  ): void {
    const message =
      typeof typeOrMessage === 'string'
        ? ({ type: typeOrMessage, data } as DocumentWebSocketOutgoingMessage)
        : typeOrMessage;
    const payload = JSON.stringify(message);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      console.log(`⏳ doc-websocket not ready, queueing message: ${message.type}`);
      this.messageQueue.push(message);
      if (this.messageQueue.length > 50) {
        this.messageQueue.shift();
      }
    }
  }

  /**
   * Session Management Actions
   */
  createSession(documentId: string, campaignId: string, roomCode: string, userId: string, syncSettings?: Partial<DocumentSessionSettings>): void {
    this.isPresenter = true;
    this.currentUserId = userId;
    this.send('doc:session:create', {
      documentId,
      campaignId,
      roomCode,
      presenter: userId,
      syncSettings,
    });
  }

  joinSession(sessionId: string, userId: string, asPresenter = false): void {
    this.isPresenter = asPresenter;
    this.currentSessionId = sessionId;
    this.currentUserId = userId;
    this.send('doc:session:join', {
      sessionId,
      userId,
    });
  }

  leaveSession(): void {
    if (this.currentSessionId) {
      this.send('doc:session:leave', {
        sessionId: this.currentSessionId,
      });
      this.currentSessionId = null;
      this.currentUserId = null;
      this.isPresenter = false;
    }
  }

  updateSettings(syncSettings: Partial<DocumentSessionSettings>): void {
    if (this.currentSessionId) {
      this.send('doc:session:update-settings', {
        sessionId: this.currentSessionId,
        syncSettings,
      });
    }
  }

  /**
   * Navigation Sync Actions
   */
  syncPage(page: number): void {
    if (this.currentSessionId && this.isPresenter) {
      this.send('doc:page:change', {
        sessionId: this.currentSessionId,
        page,
      });
    }
  }

  syncScroll(position: number): void {
    if (this.currentSessionId && this.isPresenter) {
      this.send('doc:scroll:sync', {
        sessionId: this.currentSessionId,
        position,
      });
    }
  }

  syncZoom(zoom: number): void {
    if (this.currentSessionId && this.isPresenter) {
      this.send('doc:zoom:sync', {
        sessionId: this.currentSessionId,
        zoom,
      });
    }
  }

  /**
   * Handle incoming messages and dispatch to subscribers
   */
  private handleMessage(message: DocumentWebSocketMessage): void {
    // Heartbeat ping from server -> respond with pong
    if (message.type === 'heartbeat' && message.data?.type === 'ping') {
      this.send('heartbeat', {
        type: 'pong',
        id: message.data.id,
        serverTime: message.timestamp,
      });
      return;
    }

    // Keep track of current sessionId on join/creation success
    if (message.type === 'session:created') {
      this.currentSessionId = message.data.sessionId;
    } else if (message.type === 'session:joined' && message.data.session?.sessionId) {
      this.currentSessionId = message.data.session.sessionId;
    }

    // Dispatch to registered event listeners (DOM style)
    this.dispatchEvent(new CustomEvent(message.type, { detail: message.data }));

    // Dispatch to topic subscribers
    const topicCallbacks = this.callbacks[message.type];
    if (topicCallbacks) {
      topicCallbacks.forEach((cb) => {
        try {
          cb(message.data);
        } catch (err) {
          console.error(`Error in doc-websocket subscriber callback for ${message.type}:`, err);
        }
      });
    }
  }

  /**
   * Handle client-side auto-reconnection
   */
  private handleReconnect(): void {
    if (!this.token) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 Attempting to reconnect doc-websocket in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(async () => {
        try {
          if (this.token) {
            await this.connect(this.token);
            if (this.currentSessionId && this.currentUserId) {
              this.joinSession(this.currentSessionId, this.currentUserId, this.isPresenter);
            }
            toast.success('Document sync reconnected!');
          }
        } catch (err) {
          console.error('doc-websocket reconnection failed:', err);
        }
      }, delay);
    } else {
      console.error('❌ Max doc-websocket reconnection attempts reached');
      toast.error('Document Sync Connection Lost', {
        description: 'Sync features unavailable. Please reload.',
      });
    }
  }
}

export const documentWebSocketClient = new DocumentWebSocketClient();
