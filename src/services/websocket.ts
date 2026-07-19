import type {
  WebSocketMessage,
  GameEvent,
  DiceRoll,
  DrawingCreateEvent,
  DrawingUpdateEvent,
  DrawingDeleteEvent,
  SessionCreatedEvent,
  SessionJoinedEvent,
  HeartbeatMessage,
} from '@/types/game';
import type { WebSocketCustomEvent } from '@/types/events';
import type { ChatMessage } from '@/types/game';
import { useGameStore } from '@/stores/gameStore';
import { gameStateSyncEngine } from '@/services/gameStateSync';
import { toast } from '@/utils/notifications';
import { applyPatch, Operation } from 'fast-json-patch';
import { encode, decode } from '@msgpack/msgpack';
import type { StateHash } from '../../shared/sync/contracts';
import { parseTransportEnvelope } from '../../shared/transport';

const SERVER_MESSAGE_TYPES = new Set([
  'event',
  'state',
  'dice-roll',
  'chat-message',
  'error',
  'heartbeat',
  'update-confirmed',
  'game-state-patch',
  'game-state-ack',
  'game-state-resync-required',
]);

const sanitizeLog = (value: unknown): string =>
  String(value)
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, 200);

interface ConnectionContext {
  roomCode: string;
  userType: 'host' | 'player';
  userName: string;
  userId: string;
  campaignId?: string;
}

class WebSocketService extends EventTarget {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: Array<string | Uint8Array> = [];
  private connectionPromise: Promise<void> | null = null;
  /** Signature of the last game-state snapshot sent, for dedup. Reset on
   *  (re)connect so a fresh session always re-baselines with a full snapshot. */
  private lastGameStateSignature: string | null = null;
  private lastSessionCreatedEvent: SessionCreatedEvent['data'] | null = null;
  private lastSessionJoinedEvent: SessionJoinedEvent['data'] | null = null;

  // Connection context for reconnection
  private connectionContext: ConnectionContext | null = null;

  // Heartbeat and connection quality monitoring
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 10 * 1000; // 10 seconds timeout
  private connectionQuality = {
    latency: 0,
    packetLoss: 0,
    lastPingTime: 0,
    consecutiveMisses: 0,
    quality: 'excellent' as 'excellent' | 'good' | 'poor' | 'critical',
    lastUpdate: 0,
  };

  // Get WebSocket URL dynamically from environment
  private getWebSocketUrl(
    roomCode?: string,
    userType?: 'host' | 'player',
    campaignId?: string,
    userId?: string,
    userName?: string,
    connectionMode?: 'host' | 'reconnect',
  ): string {
    const envUrl = import.meta.env.VITE_WS_URL;
    const wsHost =
      import.meta.env.VITE_WS_HOST || window.location.host || 'localhost';
    const wsPath = import.meta.env.VITE_WS_PATH || '/ws';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = envUrl || `${protocol}//${wsHost}${wsPath}`;

    const params = new URLSearchParams();
    if (roomCode) {
      if (userType === 'host') {
        if (connectionMode === 'host') {
          params.set('host', roomCode);
        } else {
          params.set('reconnect', roomCode);
        }
      } else {
        params.set('join', roomCode);
      }
    }
    if (campaignId) {
      params.set('campaignId', campaignId);
      if (userId) {
        params.set('userId', userId);
      }
    }
    if (userName) {
      params.set('userName', userName);
    }

    const queryString = params.toString();
    return queryString ? `${wsUrl}?${queryString}` : wsUrl;
  }

  private attemptConnection(url: string, port: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Connection timeout on port ${port}`));
      }, 1000); // Reduced timeout to 1 second

      ws.onopen = () => {
        clearTimeout(timeout);
        resolve(ws);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  connect(
    roomCode?: string,
    userType?: 'host' | 'player',
    campaignId?: string,
    userId?: string,
    userName?: string,
    connectionMode?: 'host' | 'reconnect',
  ): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      try {
        // A new connection cannot reuse session confirmations from a previous
        // one — a stale cache would let waitForSessionConfirmed() resolve for
        // a room the server no longer knows about.
        this.lastSessionCreatedEvent = null;
        this.lastSessionJoinedEvent = null;

        // Store connection context for reconnection (if we have enough info)
        if (roomCode && userType && userId && userName) {
          this.connectionContext = {
            roomCode,
            userType,
            userName,
            userId,
            campaignId,
          };
          // Persist to localStorage for page refresh recovery
          try {
            localStorage.setItem(
              'nexus-connection-context',
              JSON.stringify(this.connectionContext),
            );
          } catch (error) {
            console.warn('Failed to save connection context:', error);
          }
        }

        const url = this.getWebSocketUrl(
          roomCode,
          userType,
          campaignId,
          userId,
          userName,
          connectionMode,
        );
        console.log(`🔌 Attempting WebSocket connection to ${url}...`);
        this.ws = await this.attemptConnection(url, 'primary');
        this.ws.binaryType = 'arraybuffer';

        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        // Re-baseline game-state dedup: the server (re)starts from its own
        // snapshot on connect, so the next update must be a full send.
        this.lastGameStateSignature = null;
        // Re-baseline the delta-sync chain: on every (re)connect the server has
        // no acked base for us, so the next upload must be a full snapshot.
        gameStateSyncEngine.reset();

        // Send queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(message);
          }
        }

        // Set up message handlers
        this.ws.onmessage = (event) => {
          try {
            let decodedMessage: unknown;
            if (event.data instanceof ArrayBuffer) {
              decodedMessage = decode(new Uint8Array(event.data));
            } else {
              decodedMessage = JSON.parse(event.data) as unknown;
            }
            const message = parseTransportEnvelope(
              decodedMessage,
              SERVER_MESSAGE_TYPES,
            ) as WebSocketMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error(
              '🔌 [CLIENT] Failed to parse WebSocket message:',
              error,
            );
          }
        };

        // Start heartbeat mechanism
        this.startHeartbeat();

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.connectionPromise = null;

          if (event.code !== 1000) {
            // Not a normal closure
            this.handleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connectionPromise = null;
        };

        this.connectionPromise = null;
      } catch (error) {
        this.connectionPromise = null;
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  private handleMessage(message: WebSocketMessage) {
    console.log(
      '📨 Received WebSocket message:',
      sanitizeLog(message.type),
      message.data,
    );
    const gameStore = useGameStore.getState();

    // Emit custom event for components to listen to
    this.dispatchEvent(new CustomEvent('message', { detail: message }));

    switch (message.type) {
      case 'event': {
        console.log(
          '🎯 Processing event:',
          sanitizeLog(message.data.name),
          message.data,
        );

        // Session events will be handled by the gameStore's applyEvent method

        // The host removed this client from the session. Tear down locally and
        // return to the lobby without attempting to reconnect.
        if (message.data.name === 'session/kicked') {
          const kickMessage =
            (message.data as { message?: string }).message ||
            'You have been removed from the game by the host.';
          try {
            gameStore.resetSessionForExpiredRoom();
          } catch (error) {
            console.error('Failed to reset session after kick:', error);
          }
          this.disconnect();
          toast.error('Removed from game', { description: kickMessage });
          break;
        }

        if (
          (message.data.name === 'session/created' ||
            message.data.name === 'session/reconnected') &&
          'roomCode' in message.data
        ) {
          this.lastSessionCreatedEvent = {
            roomCode: message.data.roomCode as string,
          };
          const { user, session } = useGameStore.getState();
          if (user?.id && user?.name) {
            this.connectionContext = {
              roomCode: message.data.roomCode as string,
              userType: 'host',
              userName: user.name,
              userId: user.id,
              campaignId:
                (message.data.campaignId as string | undefined) ||
                session?.campaignId,
            };
            try {
              localStorage.setItem(
                'nexus-connection-context',
                JSON.stringify(this.connectionContext),
              );
            } catch (error) {
              console.warn('Failed to save connection context:', error);
            }
          }
        } else if (message.data.name === 'session/joined') {
          this.lastSessionJoinedEvent =
            message.data as unknown as SessionJoinedEvent['data'];
          const { user, session } = useGameStore.getState();
          const joinedRoomCode =
            session?.roomCode ||
            (message.data as unknown as { roomCode?: string })?.roomCode;
          if (user?.id && user?.name && joinedRoomCode) {
            this.connectionContext = {
              roomCode: joinedRoomCode,
              userType: 'player',
              userName: user.name,
              userId: user.id,
              campaignId: session?.campaignId,
            };
            try {
              localStorage.setItem(
                'nexus-connection-context',
                JSON.stringify(this.connectionContext),
              );
            } catch (error) {
              console.warn('Failed to save connection context:', error);
            }
          }
        }

        const gameEvent: GameEvent = {
          type: message.data.name,
          data: message.data,
        };
        gameStore.applyEvent(gameEvent);

        // Also emit a specific event for the drawing synchronization
        if (message.data.name === 'drawing/create') {
          this.dispatchEvent(
            new CustomEvent('drawingSync', {
              detail: {
                type: 'drawing/create',
                data: message.data,
              },
            }),
          );
        }
        break;
      }

      case 'dice-roll':
        gameStore.addDiceRoll(message.data);
        break;

      case 'chat-message':
        gameStore.addChatMessage(message.data);
        break;

      case 'update-confirmed':
        gameStore.confirmUpdate(message.data.updateId);
        break;

      case 'state':
        // Apply partial state updates
        if (message.data.session) {
          gameStore.setSession(message.data.session);
        }
        break;

      case 'game-state-patch': {
        // Apply JSON Patch for delta updates (80% reduction in payload size)
        try {
          const { patch, version } = message.data;

          console.log(
            `📦 Applying game state patch v${sanitizeLog(version)} (${patch.length} operations)`,
          );

          // Get current game state
          const currentState = useGameStore.getState();

          // Create a copy to apply patch to
          const stateCopy = JSON.parse(
            JSON.stringify({
              scenes: currentState.sceneState.scenes,
              activeSceneId: currentState.sceneState.activeSceneId,
              characters: [], // Characters are stored separately
              initiative: {}, // Initiative is stored separately
            }),
          );

          // Apply patch
          const patchResult = applyPatch(stateCopy, patch as Operation[]);

          if (patchResult.newDocument) {
            // Update game store with patched state
            useGameStore.setState((state) => {
              if (patchResult.newDocument.scenes) {
                state.sceneState.scenes = patchResult.newDocument.scenes;
              }
              if (patchResult.newDocument.activeSceneId !== undefined) {
                state.sceneState.activeSceneId =
                  patchResult.newDocument.activeSceneId;
              }
            });

            console.log(
              `✅ Game state patch v${sanitizeLog(version)} applied successfully`,
            );
          }
        } catch (error) {
          console.error('❌ Failed to apply game state patch:', error);
          // On patch failure, request full state sync from server
          toast.error('Sync Issue', {
            description: 'Requesting full state sync from server...',
          });
        }
        break;
      }

      case 'game-state-ack': {
        // Sender-only: server confirmed our commit and assigned the new
        // authoritative token. Promote the in-flight snapshot in the engine.
        gameStateSyncEngine.onAck({ token: message.data.token as StateHash });
        break;
      }

      case 'game-state-resync-required': {
        // Sender-only: the content-hash chain broke. Drop our base and
        // re-baseline with a full snapshot on the next flush. The reason
        // ('base-mismatch' | 'integrity-mismatch' | …) drives the dev log.
        const reason =
          (message.data as { reason?: string })?.reason ?? 'server';
        gameStateSyncEngine.onResyncRequired(reason);
        break;
      }

      case 'error':
        console.error('Server error:', sanitizeLog(message.data.message));

        // Handle specific error cases. startsWith: the player-join path sends
        // 'Room not found or offline - …', which must also clear state.
        if (message.data.message?.startsWith('Room not found')) {
          console.log('🗑️ Room not found - clearing stored session data');
          try {
            gameStore.resetSessionForExpiredRoom();
          } catch (error) {
            console.error('Failed to reset session state:', error);
          }
          // Close cleanly so handleReconnect doesn't keep retrying a room the
          // server just told us is gone.
          this.disconnect();
          toast.error('Session Expired', {
            description: 'Your previous session has ended.',
          });
        } else if (
          message.data.code === 409 &&
          message.data.message.includes('version conflict')
        ) {
          // Handle version conflict - rollback optimistic update
          console.warn(
            '⚠️ Version conflict detected, rolling back optimistic update',
          );
          // The updateId should be extracted from the error context if available
          // For now, we'll show a warning to the user
          toast.warning('Update Conflict', {
            description:
              'Your change was rejected due to a conflict. Please try again.',
          });
        } else {
          toast.error('Server Error', { description: message.data.message });
        }
        break;

      case 'heartbeat':
        this.handleHeartbeatMessage(message);
        break;

      default: {
        // This is an exhaustive check. If a new message type is added, this will cause a TypeScript error.
        const _exhaustiveCheck: never = message;
        console.warn('Unknown message type:', _exhaustiveCheck);
        break;
      }
    }
  }

  private handleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const baseDelay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      // ±20% jitter prevents thundering herd when many clients reconnect
      // simultaneously after a server restart
      const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.round(baseDelay + jitter);

      console.log(
        `🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );

      // Show reconnecting toast
      toast.loading('Reconnecting to server...', {
        id: 'reconnect-toast',
        duration: delay + 5000,
      });

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;

        // Try to load connection context from memory or localStorage
        let context = this.connectionContext;
        if (!context) {
          try {
            const saved = localStorage.getItem('nexus-connection-context');
            if (saved) {
              context = JSON.parse(saved) as ConnectionContext;
              this.connectionContext = context;
            }
          } catch (error) {
            console.warn('Failed to load connection context:', error);
          }
        }

        // Use connection context if available, otherwise fall back to session
        if (context) {
          console.log(`🔄 Reconnecting with context:`, {
            roomCode: context.roomCode,
            userType: context.userType,
            userName: context.userName,
          });
          this.connect(
            context.roomCode,
            context.userType,
            context.campaignId,
            context.userId,
            context.userName,
          )
            .then(() => {
              toast.success('Reconnected to server!', {
                id: 'reconnect-toast',
              });
            })
            .catch((error) => {
              console.error('Reconnection failed:', error);
              toast.error('Reconnection failed', {
                id: 'reconnect-toast',
                description: 'Retrying...',
              });
              this.handleReconnect();
            });
        } else {
          // Fallback to session-based reconnection (old behavior)
          const session = useGameStore.getState().session;
          const user = useGameStore.getState().user;
          if (session && user) {
            console.log(`🔄 Reconnecting with session fallback:`, {
              roomCode: session.roomCode,
              userType: user.type,
            });
            this.connect(
              session.roomCode,
              user.type as 'host' | 'player',
              undefined,
              user.id,
              user.name,
            )
              .then(() => {
                toast.success('Reconnected to server!', {
                  id: 'reconnect-toast',
                });
              })
              .catch((error) => {
                console.error('Reconnection failed:', error);
                toast.error('Reconnection failed', {
                  id: 'reconnect-toast',
                  description: 'Retrying...',
                });
                this.handleReconnect();
              });
          } else {
            console.warn(
              '⚠️ No connection context or session available for reconnection',
            );
          }
        }
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      toast.error('Connection Lost', {
        id: 'reconnect-toast',
        description: 'Unable to reconnect. Please refresh the page.',
      });

      // Don't automatically kick to lobby - let user decide
      // useGameStore.getState().setSession(null);

      // Reset for potential future connections
      this.reconnectAttempts = 0;
    }
  }

  sendEvent(event: GameEvent) {
    console.log('📤 Sending event:', event.type, event.data);
    this.sendMessage({
      type: 'event',
      data: { name: event.type, ...(event.data as object) },
      timestamp: Date.now(),
      src: useGameStore.getState().user.id,
    });
  }

  /** Host action: remove a player from the session. */
  sendKickPlayer(targetUserId: string) {
    this.sendEvent({
      type: 'session/kickPlayer',
      data: { targetUserId },
    } as GameEvent);
  }

  /** Host action: grant a player co-host ("DM") privileges. */
  sendAddCoHost(targetUserId: string) {
    this.sendEvent({
      type: 'host/add-cohost',
      data: { targetUserId },
    } as GameEvent);
  }

  /** Host action: revoke a player's co-host ("DM") privileges. */
  sendRemoveCoHost(targetUserId: string) {
    this.sendEvent({
      type: 'host/remove-cohost',
      data: { targetUserId },
    } as GameEvent);
  }

  sendDiceRoll(roll: DiceRoll) {
    this.sendMessage({
      type: 'dice-roll',
      data: roll,
      timestamp: Date.now(),
      src: useGameStore.getState().user.id,
    });
  }

  sendChatMessage(message: ChatMessage['data']) {
    console.log('💬 Sending chat message:', message.content);
    this.sendMessage({
      type: 'chat-message',
      data: message,
      timestamp: Date.now(),
      src: useGameStore.getState().user.id,
    } as WebSocketMessage);
  }

  // Send game state update to server for persistence
  sendGameStateUpdate(partialState: {
    sceneState?: { scenes?: unknown[]; activeSceneId?: string | null };
    characters?: unknown[];
    initiative?: unknown;
  }) {
    // Server expects type: 'event' with name: 'game-state-update'
    const payload = {
      name: 'game-state-update',
      scenes: partialState.sceneState?.scenes || [],
      activeSceneId: partialState.sceneState?.activeSceneId || null,
      characters: partialState.characters || [],
      initiative: partialState.initiative || {},
    };

    // Dedup: this is the heaviest recurring message (a full game-state snapshot,
    // incl. scene background images) and the autosave fires it on a timer even
    // when nothing changed. Skip a send that is byte-identical to the previous
    // one. The signature is reset on every (re)connection, so a fresh session
    // always re-baselines the server with a full snapshot.
    const signature = JSON.stringify(payload);
    if (signature === this.lastGameStateSignature) {
      return;
    }
    this.lastGameStateSignature = signature;

    console.log('📤 Sending game state update to server:', partialState);
    this.sendMessage({
      type: 'event',
      data: payload,
      timestamp: Date.now(),
      src: useGameStore.getState().user.id,
    });
  }

  // Specialized method for drawing synchronization
  sendDrawingEvent(
    type: 'create' | 'update' | 'delete',
    data:
      | DrawingCreateEvent['data']
      | DrawingUpdateEvent['data']
      | DrawingDeleteEvent['data'],
  ) {
    const drawingEvent: GameEvent = {
      type: `drawing/${type}`,
      data: data,
    };
    this.sendEvent(drawingEvent);
  }

  waitForSessionCreated(): Promise<SessionCreatedEvent['data']> {
    return new Promise((resolve, reject) => {
      if (this.lastSessionCreatedEvent) {
        resolve(this.lastSessionCreatedEvent);
        return;
      }

      const timeout = setTimeout(
        () => reject(new Error('Room creation timeout')),
        10000,
      );

      const handler = (event: Event) => {
        const customEvent = event as CustomEvent;
        const eventName = customEvent.detail?.data?.name;
        if (
          eventName === 'session/created' ||
          eventName === 'session/reconnected'
        ) {
          clearTimeout(timeout);
          this.removeEventListener('message', handler);
          resolve(customEvent.detail.data);
        }
      };

      this.addEventListener('message', handler);
    });
  }

  waitForSessionJoined(): Promise<SessionJoinedEvent['data']> {
    return new Promise((resolve, reject) => {
      if (this.lastSessionJoinedEvent) {
        resolve(this.lastSessionJoinedEvent);
        return;
      }

      const timeout = setTimeout(
        () => reject(new Error('Room join timeout')),
        10000,
      );

      const handler = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.data?.name === 'session/joined') {
          clearTimeout(timeout);
          this.removeEventListener('message', handler);
          this.removeEventListener('message', errorHandler);
          resolve(customEvent.detail.data);
        }
      };

      const errorHandler = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.type === 'error') {
          clearTimeout(timeout);
          this.removeEventListener('message', handler);
          this.removeEventListener('message', errorHandler);
          const message =
            customEvent.detail?.data?.message || 'Room join failed';
          reject(new Error(message));
        }
      };

      this.addEventListener('message', handler);
      this.addEventListener('message', errorHandler);
    });
  }

  /**
   * Wait until the server confirms this connection belongs to a live room
   * (session/created, session/reconnected, or session/joined). The socket
   * opening only proves the server is up — the room may no longer exist.
   * Rejects on a server error message or after timeoutMs; callers should
   * treat that as a dead room and clear recovery state.
   */
  waitForSessionConfirmed(timeoutMs = 10000): Promise<void> {
    if (this.lastSessionCreatedEvent || this.lastSessionJoinedEvent) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        this.removeEventListener('message', handler);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Session confirmation timeout'));
      }, timeoutMs);

      const handler = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        const eventName = detail?.data?.name;
        if (
          eventName === 'session/created' ||
          eventName === 'session/reconnected' ||
          eventName === 'session/joined'
        ) {
          cleanup();
          resolve();
        } else if (detail?.type === 'error') {
          cleanup();
          reject(
            new Error(detail?.data?.message || 'Session confirmation failed'),
          );
        }
      };

      this.addEventListener('message', handler);
    });
  }

  private sendMessage(
    message: Omit<WebSocketMessage, 'src'> & { src: string },
  ) {
    const useMessagePack = import.meta.env.VITE_USE_MESSAGEPACK === 'true';
    const payload = useMessagePack ? encode(message) : JSON.stringify(message);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      console.log('✅ Message sent successfully');
    } else {
      // Queue message for when connection is restored
      console.log('⏳ WebSocket not ready, queueing message');
      // Queue the already-encoded payload (string for JSON, Uint8Array for
      // MessagePack); it is sent as-is when the connection is restored.
      this.messageQueue.push(payload);

      // Limit queue size to prevent memory issues
      if (this.messageQueue.length > 50) {
        this.messageQueue.shift();
      }
    }
  }

  // Heartbeat methods
  private startHeartbeat() {
    // DISABLE CLIENT HEARTBEAT - let server handle heartbeat monitoring
    // Client only responds to server pings, doesn't initiate its own
    console.log('💓 Client heartbeat disabled - using server heartbeat only');
    return;

    // Original client heartbeat code (disabled):
    // if (this.heartbeatTimer) return; // Already running
    // console.log('💓 Starting client heartbeat');
    // this.heartbeatTimer = setInterval(() => {
    //   if (this.ws?.readyState === WebSocket.OPEN) {
    //     this.sendPing();
    //   }
    // }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('💓 Stopped client heartbeat');
    }
  }

  private sendPing() {
    // DISABLED: Client doesn't send pings anymore - only responds to server pings
    console.warn('⚠️ sendPing called but client heartbeat is disabled');
    return;

    // Original ping sending code (disabled):
    // const pingId = uuidv4();
    // this.connectionQuality.lastPingTime = Date.now();
    // this.sendMessage({
    //   type: 'heartbeat',
    //   data: { type: 'ping', id: pingId },
    //   timestamp: Date.now(),
    //   src: useGameStore.getState().user.id,
    // });
    // // Set timeout for pong response
    // setTimeout(() => {
    //   // Check if we still haven't received a pong for this ping
    //   if (
    //     this.connectionQuality.lastPingTime ===
    //     this.connectionQuality.lastPingTime
    //   ) {
    //     this.handleMissedPong();
    //   }
    // }, this.HEARTBEAT_TIMEOUT);
  }

  private handleHeartbeatMessage(message: HeartbeatMessage) {
    if (message.data.type === 'ping') {
      // Respond to server ping with pong
      this.sendMessage({
        type: 'heartbeat',
        data: {
          type: 'pong',
          id: message.data.id,
          serverTime: message.timestamp,
        },
        timestamp: Date.now(),
        src: useGameStore.getState().user.id,
      });

      // Update connection quality based on server ping timing
      const latency = Date.now() - message.timestamp;
      this.updateConnectionQuality(latency);
    }
    // Removed pong handling since client doesn't send pings anymore
  }

  private handleMissedPong() {
    // DISABLED: Client doesn't send pings anymore, so no missed pongs to handle
    console.warn('⚠️ handleMissedPong called but client heartbeat is disabled');
    return;

    // Original missed pong handling (disabled):
    // this.connectionQuality.consecutiveMisses += 1;
    // this.connectionQuality.packetLoss += 1;
    // // Update quality based on consecutive misses
    // if (this.connectionQuality.consecutiveMisses >= 3) {
    //   this.connectionQuality.quality = 'critical';
    // } else if (this.connectionQuality.consecutiveMisses >= 2) {
    //   this.connectionQuality.quality = 'poor';
    // } else if (this.connectionQuality.consecutiveMisses >= 1) {
    //   this.connectionQuality.quality = 'good';
    // }
    // this.connectionQuality.lastUpdate = Date.now();
    // console.warn(
    //   `⚠️ Missed pong response (${this.connectionQuality.consecutiveMisses} consecutive)`,
    // );
  }

  private updateConnectionQuality(latency: number) {
    this.connectionQuality.latency = latency;
    this.connectionQuality.consecutiveMisses = 0; // Reset on successful pong
    this.connectionQuality.lastUpdate = Date.now();

    // Update quality based on latency
    if (latency < 100) {
      this.connectionQuality.quality = 'excellent';
    } else if (latency < 500) {
      this.connectionQuality.quality = 'good';
    } else if (latency < 2000) {
      this.connectionQuality.quality = 'poor';
    } else {
      this.connectionQuality.quality = 'critical';
    }

    console.log(
      `📊 Connection quality: ${this.connectionQuality.quality} (${latency}ms latency)`,
    );
  }

  disconnect() {
    console.log('Manually disconnecting WebSocket');
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      // Use code 1000 for normal closure
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.connectionPromise = null;

    // Clear connection context on manual disconnect
    this.connectionContext = null;
    try {
      localStorage.removeItem('nexus-connection-context');
    } catch (error) {
      console.warn('Failed to clear connection context:', error);
    }
  }

  /**
   * Clear cached server port - useful if server restarts on different port
   * Run in browser console: window.webSocketService.clearCachedPort()
   */
  clearCachedPort(): void {
    try {
      localStorage.removeItem('nexus_ws_port');
      localStorage.removeItem('nexus_discovered_port');
      console.log(
        '✅ Cleared cached WebSocket routing hints; using unified /ws endpoint',
      );
    } catch (error) {
      console.warn('Failed to clear cached port:', error);
    }
  }

  resetSessionEventCache(): void {
    this.lastSessionCreatedEvent = null;
    this.lastSessionJoinedEvent = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionQuality(): {
    latency: number;
    packetLoss: number;
    quality: 'excellent' | 'good' | 'poor' | 'critical';
    lastUpdate: number;
    consecutiveMisses: number;
  } {
    return { ...this.connectionQuality };
  }

  getConnectionState(): string {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'unknown';
    }
  }

  /**
   * Subscribe to WebSocket messages
   * Returns an unsubscribe function
   */
  subscribe(callback: (event: WebSocketMessage['data']) => void): () => void {
    const handler = (event: WebSocketCustomEvent) => {
      if (event.detail?.type === 'event') {
        callback(event.detail.data);
      }
    };

    this.addEventListener('message', handler as EventListener);

    return () => {
      this.removeEventListener('message', handler as EventListener);
    };
  }
}

export const webSocketService = new WebSocketService();

// Expose to window for debugging
declare global {
  interface Window {
    webSocketService?: WebSocketService;
  }
}

if (import.meta.env.DEV) {
  window.webSocketService = webSocketService;
  console.log(
    '🔧 Debug: webSocketService available at window.webSocketService',
  );
  console.log(
    '   - window.webSocketService.clearCachedPort() to clear cached routing hints',
  );
}
