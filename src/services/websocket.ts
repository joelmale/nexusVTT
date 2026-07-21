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
import {
  applyGameStateProjection,
  buildGameStateProjection,
} from '@/services/gameStateProjection';
import { toast } from '@/utils/notifications';
import { applyPatch, type Operation } from 'fast-json-patch';
import { encode, decode } from '@msgpack/msgpack';
import type { StateHash, SyncableGameState } from '../../shared/sync/contracts';
import {
  parseTransportEnvelope,
  type TransportEnvelope,
} from '../../shared/transport';
import {
  hasOrderedEventMetadata,
  isDurableTransportEvent,
  type EventAcknowledgement,
  type EventCursorUpdate,
  type OrderedTransportEnvelope,
} from '../../shared/events/contracts';
import { orderedEventClient } from '@/services/orderedEventClient';
import { v4 as uuidv4 } from 'uuid';

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
  'event-ack',
  'event-cursor',
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

interface PendingHeartbeat {
  socketInstanceId: string;
  startedAt: number;
  timeout: ReturnType<typeof setTimeout>;
}

class WebSocketService extends EventTarget {
  private ws: WebSocket | null = null;
  private socketInstanceId: string | null = null;
  private participantId: string | null = null;
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
  private pendingHeartbeats = new Map<string, PendingHeartbeat>();
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
    connectionInstanceId?: string,
    reconnectTrigger?: string,
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
    if (connectionInstanceId) {
      params.set('connectionInstanceId', connectionInstanceId);
    }
    if (reconnectTrigger) {
      params.set('reconnectTrigger', reconnectTrigger);
    }
    const lastSeenSequence = orderedEventClient.getRequestedCursor();
    if (roomCode && lastSeenSequence !== null) {
      params.set('lastSeenSequence', String(lastSeenSequence));
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
    reconnectTrigger = 'connect',
  ): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.info('[WebSocket] connect ignored; socket already open', {
        socketInstanceId: this.socketInstanceId,
        participantId: this.participantId,
        reconnectTrigger,
      });
      return Promise.resolve();
    }

    // Prevent multiple simultaneous connection attempts.
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

        const gameState = useGameStore.getState();
        const matchingContext =
          this.connectionContext?.roomCode === roomCode
            ? this.connectionContext
            : null;
        const resolvedUserType =
          userType ||
          matchingContext?.userType ||
          (gameState.session?.roomCode === roomCode
            ? (gameState.user.type as 'host' | 'player')
            : 'player');
        const resolvedUserId =
          userId || matchingContext?.userId || gameState.user.id;
        const resolvedUserName =
          userName || matchingContext?.userName || gameState.user.name || 'Guest';
        const resolvedCampaignId =
          campaignId || matchingContext?.campaignId || undefined;

        if (roomCode && resolvedUserId) {
          orderedEventClient.configure(roomCode, resolvedUserId);
        }

        // Store connection context for reconnection (if we have enough info)
        if (
          roomCode &&
          resolvedUserType &&
          resolvedUserId &&
          resolvedUserName
        ) {
          this.connectionContext = {
            roomCode,
            userType: resolvedUserType,
            userName: resolvedUserName,
            userId: resolvedUserId,
            campaignId: resolvedCampaignId,
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

        const nextSocketInstanceId = uuidv4();
        const url = this.getWebSocketUrl(
          roomCode,
          resolvedUserType,
          resolvedCampaignId,
          resolvedUserId,
          resolvedUserName,
          connectionMode,
          nextSocketInstanceId,
          reconnectTrigger,
        );
        console.info('[WebSocket] connecting', {
          socketInstanceId: nextSocketInstanceId,
          participantId: resolvedUserId || null,
          roomCode: roomCode || null,
          role: resolvedUserType || null,
          reconnectTrigger,
        });
        const socket = await this.attemptConnection(url, 'primary');
        this.ws = socket;
        this.socketInstanceId = nextSocketInstanceId;
        this.participantId = resolvedUserId || null;
        socket.binaryType = 'arraybuffer';

        console.info('[WebSocket] connected', {
          socketInstanceId: nextSocketInstanceId,
          participantId: this.participantId,
          reconnectTrigger,
        });

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
          if (message && socket.readyState === WebSocket.OPEN) {
            socket.send(message);
          }
        }

        // Set up message handlers
        socket.onmessage = (event) => {
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
            this.handleMessage(message, nextSocketInstanceId);
          } catch (error) {
            console.error(
              '🔌 [CLIENT] Failed to parse WebSocket message:',
              error,
            );
          }
        };

        // Start heartbeat mechanism
        this.startHeartbeat(nextSocketInstanceId);

        socket.onclose = (event) => {
          const superseded = !this.isActiveSocket(
            socket,
            nextSocketInstanceId,
          );
          console.info('[WebSocket] closed', {
            socketInstanceId: nextSocketInstanceId,
            participantId: resolvedUserId || null,
            closeCode: event.code,
            closeReason: event.reason || '',
            reconnectTrigger:
              event.code === 1000 || event.code === 4000
                ? 'none'
                : 'socket-close',
            superseded,
          });

          if (superseded) return;

          this.stopHeartbeat();
          this.ws = null;
          this.socketInstanceId = null;
          this.connectionPromise = null;

          if (event.code !== 1000 && event.code !== 4000) {
            // Not a normal closure
            this.handleReconnect('socket-close');
          }
        };

        socket.onerror = (error) => {
          console.error('[WebSocket] error', {
            socketInstanceId: nextSocketInstanceId,
            participantId: resolvedUserId || null,
            error,
          });
          if (this.isActiveSocket(socket, nextSocketInstanceId)) {
            this.connectionPromise = null;
          }
        };

        this.connectionPromise = null;
      } catch (error) {
        this.connectionPromise = null;
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  private isActiveSocket(socket: WebSocket, socketInstanceId: string): boolean {
    return this.ws === socket && this.socketInstanceId === socketInstanceId;
  }

  private handleMessage(
    message: WebSocketMessage,
    socketInstanceId: string,
  ) {
    if (socketInstanceId !== this.socketInstanceId) {
      console.warn('[WebSocket] ignored message from superseded socket', {
        socketInstanceId,
        activeSocketInstanceId: this.socketInstanceId,
        participantId: this.participantId,
        messageType: message.type,
      });
      return;
    }

    if (message.type === 'event-ack') {
      const ready = orderedEventClient.acknowledge(
        message.data as EventAcknowledgement,
      );
      this.processOrderedMessages(ready, socketInstanceId);
      return;
    }

    if (message.type === 'event-cursor') {
      const ready = orderedEventClient.establishCursor(
        message.data as EventCursorUpdate,
      );
      this.processOrderedMessages(ready, socketInstanceId);
      return;
    }

    if (hasOrderedEventMetadata(message)) {
      const ready = orderedEventClient.receive(message);
      this.processOrderedMessages(ready, socketInstanceId);
      return;
    }

    this.processMessage(message, socketInstanceId);
  }

  private processOrderedMessages(
    messages: OrderedTransportEnvelope[],
    socketInstanceId: string,
  ): void {
    for (const message of messages) {
      this.processMessage(
        message as unknown as WebSocketMessage,
        socketInstanceId,
      );
    }
  }

  private processMessage(
    message: WebSocketMessage,
    socketInstanceId: string,
  ) {
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
            orderedEventClient.configure(
              message.data.roomCode as string,
              user.id,
            );
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
            orderedEventClient.configure(joinedRoomCode, user.id);
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

        if (
          (message.data.name === 'session/joined' ||
            message.data.name === 'session/reconnected') &&
          'gameState' in message.data &&
          message.data.gameState
        ) {
          applyGameStateProjection(message.data.gameState);
        }

        if (
          message.data.name === 'session/created' ||
          message.data.name === 'session/joined' ||
          message.data.name === 'session/reconnected'
        ) {
          this.resendPendingOrderedMessages();
        }

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

          const stateCopy = buildGameStateProjection();

          // Apply patch
          const patchResult = applyPatch(
            stateCopy,
            patch as Operation[],
            true,
            false,
          );

          if (patchResult.newDocument) {
            if (!applyGameStateProjection(patchResult.newDocument)) {
              throw new Error('Server patch produced an invalid game state.');
            }

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
        // PostgreSQL rejected our compare-and-swap or validation rejected the
        // chain. Rebase from the authoritative snapshot; never upload the stale
        // losing state over a commit made by another host/replica.
        const resync = message.data as {
          reason?: string;
          serverToken?: string;
          gameState?: unknown;
        };
        const reason = resync.reason ?? 'server';
        if (
          typeof resync.serverToken === 'string' &&
          applyGameStateProjection(resync.gameState)
        ) {
          gameStateSyncEngine.onAuthoritativeSnapshot(
            resync.gameState as SyncableGameState,
            resync.serverToken as StateHash,
            reason,
          );
        } else {
          gameStateSyncEngine.onResyncRequired(reason);
        }
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
        this.handleHeartbeatMessage(message, socketInstanceId);
        break;

      case 'event-ack':
      case 'event-cursor':
        break;

      default: {
        // This is an exhaustive check. If a new message type is added, this will cause a TypeScript error.
        const _exhaustiveCheck: never = message;
        console.warn('Unknown message type:', _exhaustiveCheck);
        break;
      }
    }
  }

  private getReconnectContext(): ConnectionContext | null {
    if (this.connectionContext) return this.connectionContext;

    try {
      const saved = localStorage.getItem('nexus-connection-context');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ConnectionContext>;
        if (
          typeof parsed.roomCode === 'string' &&
          (parsed.userType === 'host' || parsed.userType === 'player') &&
          typeof parsed.userId === 'string' &&
          typeof parsed.userName === 'string'
        ) {
          this.connectionContext = parsed as ConnectionContext;
          return this.connectionContext;
        }
      }
    } catch (error) {
      console.warn('Failed to load connection context:', error);
    }

    const { session, user } = useGameStore.getState();
    if (!session?.roomCode || !user.id || !user.name) return null;

    this.connectionContext = {
      roomCode: session.roomCode,
      userType: user.type as 'host' | 'player',
      userId: user.id,
      userName: user.name,
      campaignId: session.campaignId,
    };
    return this.connectionContext;
  }

  reconnect(reconnectTrigger = 'manual'): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const context = this.getReconnectContext();
    if (!context) {
      return Promise.reject(new Error('No session is available to reconnect.'));
    }

    console.info('[WebSocket] reconnect requested', {
      socketInstanceId: this.socketInstanceId,
      participantId: context.userId,
      roomCode: context.roomCode,
      role: context.userType,
      reconnectTrigger,
    });

    return this.connect(
      context.roomCode,
      context.userType,
      context.campaignId,
      context.userId,
      context.userName,
      undefined,
      reconnectTrigger,
    );
  }

  private handleReconnect(reconnectTrigger: string) {
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

      console.info('[WebSocket] reconnect scheduled', {
        socketInstanceId: this.socketInstanceId,
        participantId: this.connectionContext?.userId || this.participantId,
        reconnectTrigger,
        delayMs: delay,
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });

      // Show reconnecting toast
      toast.loading('Reconnecting to server...', {
        id: 'reconnect-toast',
        duration: delay + 5000,
      });

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        void this.reconnect(reconnectTrigger)
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
            this.handleReconnect('retry-after-failure');
          });
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
    let outgoing = message;
    if (
      isDurableTransportEvent(message.type, message.data) &&
      !message.eventId
    ) {
      outgoing = { ...message, ...orderedEventClient.createIdentity() };
      orderedEventClient.track(outgoing as unknown as TransportEnvelope);
    }
    const useMessagePack = import.meta.env.VITE_USE_MESSAGEPACK === 'true';
    const payload = useMessagePack
      ? encode(outgoing)
      : JSON.stringify(outgoing);

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

  private resendPendingOrderedMessages(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const useMessagePack = import.meta.env.VITE_USE_MESSAGEPACK === 'true';
    for (const message of orderedEventClient.pendingMessages()) {
      this.ws.send(useMessagePack ? encode(message) : JSON.stringify(message));
    }
  }

  // Heartbeat methods. The client owns its RTT sample so the elapsed time is
  // measured entirely on one monotonic clock; server/client clock skew cannot
  // affect the result.
  private startHeartbeat(socketInstanceId: string) {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendPing(socketInstanceId);
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const pending of this.pendingHeartbeats.values()) {
      clearTimeout(pending.timeout);
    }
    this.pendingHeartbeats.clear();
  }

  private sendPing(socketInstanceId: string) {
    if (
      this.socketInstanceId !== socketInstanceId ||
      this.ws?.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const pingId = uuidv4();
    const startedAt = performance.now();
    this.connectionQuality.lastPingTime = startedAt;
    const timeout = setTimeout(() => {
      const pending = this.pendingHeartbeats.get(pingId);
      if (!pending || pending.socketInstanceId !== socketInstanceId) return;
      this.pendingHeartbeats.delete(pingId);
      this.handleMissedPong(socketInstanceId);
    }, this.HEARTBEAT_TIMEOUT);

    this.pendingHeartbeats.set(pingId, {
      socketInstanceId,
      startedAt,
      timeout,
    });
    this.sendMessage({
      type: 'heartbeat',
      data: { type: 'ping', id: pingId },
      timestamp: Date.now(),
      src: this.participantId || useGameStore.getState().user.id,
    });
  }

  private handleHeartbeatMessage(
    message: HeartbeatMessage,
    socketInstanceId: string,
  ) {
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
      return;
    }

    const pending = this.pendingHeartbeats.get(message.data.id);
    if (
      !pending ||
      pending.socketInstanceId !== socketInstanceId ||
      this.socketInstanceId !== socketInstanceId
    ) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingHeartbeats.delete(message.data.id);
    const rttMs = Math.max(0, performance.now() - pending.startedAt);
    this.updateConnectionQuality(rttMs);
    console.info('[WebSocket] heartbeat RTT', {
      socketInstanceId,
      participantId: this.participantId,
      rttMs: Math.round(rttMs),
    });
  }

  private handleMissedPong(socketInstanceId: string) {
    if (this.socketInstanceId !== socketInstanceId) return;

    this.connectionQuality.consecutiveMisses += 1;
    this.connectionQuality.packetLoss += 1;
    this.connectionQuality.lastUpdate = Date.now();
    if (this.connectionQuality.consecutiveMisses >= 3) {
      this.connectionQuality.quality = 'critical';
    } else if (this.connectionQuality.consecutiveMisses >= 2) {
      this.connectionQuality.quality = 'poor';
    } else {
      this.connectionQuality.quality = 'good';
    }
    console.warn('[WebSocket] heartbeat missed', {
      socketInstanceId,
      participantId: this.participantId,
      consecutiveMisses: this.connectionQuality.consecutiveMisses,
    });
  }

  private updateConnectionQuality(latency: number) {
    const roundedLatency = Math.round(latency);
    this.connectionQuality.latency = roundedLatency;
    this.connectionQuality.consecutiveMisses = 0; // Reset on successful pong
    this.connectionQuality.lastUpdate = Date.now();

    // Update quality based on latency
    if (roundedLatency < 100) {
      this.connectionQuality.quality = 'excellent';
    } else if (roundedLatency < 500) {
      this.connectionQuality.quality = 'good';
    } else if (roundedLatency < 2000) {
      this.connectionQuality.quality = 'poor';
    } else {
      this.connectionQuality.quality = 'critical';
    }

  }

  disconnect() {
    console.info('[WebSocket] manual disconnect', {
      socketInstanceId: this.socketInstanceId,
      participantId: this.participantId,
      reconnectTrigger: 'manual-disconnect',
    });
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      this.socketInstanceId = null;
      this.participantId = null;
      // Use code 1000 for normal closure
      socket.close(1000, 'Manual disconnect');
    }
    this.socketInstanceId = null;
    this.participantId = null;
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
