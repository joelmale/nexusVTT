import type { WebSocket } from 'ws';
import type { Session } from 'express-session';
import type { IncomingMessage } from 'http';

import type { Connection, GameState, Room } from '../types.js';
import type { DatabaseService, SessionRecord } from '../database.js';
import type { SocketManager } from './SocketManager.js';
import type { EventReplayWindow } from '../../shared/events/contracts.js';
import type { JsonValue } from '../../shared/sync/contracts.js';
import { createEmptySyncableGameState } from '../../shared/sync/contracts.js';
import { hashSync } from '../../shared/sync/hashSync.js';
import { generateSecureJoinCode } from '../utils/secureCode.js';
import { resolveSocketIdentity } from './resolveSocketIdentity.js';
import { authorizeCampaignHost } from './campaignAuthorization.js';
import { buildSyncableFromLegacy } from './syncableState.js';
import { sendError, sendMessage } from './messaging.js';

export interface CustomSession extends Session {
  guestUser?: {
    id: string;
    name: string;
    provider: string;
  };
  passport?: {
    user?: string;
  };
}

export interface RequestWithSession extends IncomingMessage {
  session: CustomSession;
}

export interface ConnectionLifecycleDependencies {
  socketManager: SocketManager;
  db: DatabaseService;
}

/**
 * Owns the WebSocket session lifecycle: identity resolution on connect, the
 * host / host-reconnect / join / default admission flows, event-journal replay
 * delivery, disconnection handling, and room hibernation, abandonment and
 * recovery.
 *
 * Message routing itself lives in SocketManager and its handlers; this class is
 * only concerned with connection admission and room presence.
 */
export class ConnectionLifecycle {
  private readonly socketManager: SocketManager;
  private readonly db: DatabaseService;

  // Session timeouts (72 hours = 259200000 ms)
  private readonly HIBERNATION_TIMEOUT = 72 * 60 * 60 * 1000; // 72 hours before abandoning inactive session
  private readonly ABANDONMENT_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours after abandonment before database cleanup

  constructor({ socketManager, db }: ConnectionLifecycleDependencies) {
    this.socketManager = socketManager;
    this.db = db;
  }

  private parseEventCursor(value: string | null): number | null {
    if (value === null) return null;
    const sequence = Number(value);
    return Number.isSafeInteger(sequence) && sequence >= 0 ? sequence : null;
  }

  private async prepareRoomReplay(
    roomCode: string,
    requestedSequence: number | null | undefined,
  ): Promise<EventReplayWindow | null> {
    try {
      return await this.socketManager.getRoomReplayWindow(
        roomCode,
        requestedSequence ?? null,
      );
    } catch (error) {
      console.error(`Failed to prepare event replay for ${roomCode}:`, error);
      return null;
    }
  }

  /**
   * Delivers the captured replay, then closes the small race between capturing
   * it and installing the connection in the live room. Events accepted after
   * membership was installed are also delivered live, so duplicate catch-up
   * frames are harmless at the client's sequence cursor.
   */
  private async deliverReplayWithCatchUp(
    connection: Connection,
    roomCode: string,
    replay: EventReplayWindow,
    requestedSequence: number | null,
  ): Promise<void> {
    this.socketManager.deliverRoomReplay(connection, replay, requestedSequence);
    const catchUp = await this.prepareRoomReplay(
      roomCode,
      replay.latestSequence,
    );
    if (catchUp && catchUp.latestSequence > replay.latestSequence) {
      this.socketManager.deliverRoomReplay(
        connection,
        catchUp,
        replay.latestSequence,
      );
    }
  }

  public async handleConnection(ws: WebSocket, req: RequestWithSession) {
    const url = new URL(req.url!, 'ws://localhost');
    const params = url.searchParams;
    const connectionInstanceId = params.get('connectionInstanceId');
    const reconnectTrigger = params.get('reconnectTrigger') || 'connect';

    const { uuid, displayName, userType } = await resolveSocketIdentity(
      req.session,
      this.db,
    );

    const connection = this.socketManager.addConnection(
      ws,
      displayName,
      uuid,
      connectionInstanceId || undefined,
      reconnectTrigger,
    );
    console.info('[WebSocket] accepted connection', {
      socketInstanceId: connection.instanceId,
      participantId: connection.id,
      identityType: userType,
      displayName,
      reconnectTrigger: connection.reconnectTrigger,
    });
    const requestedEventCursor = params.get('lastSeenSequence');
    connection.requestedEventCursor =
      this.parseEventCursor(requestedEventCursor);

    const host = params.get('host');
    const join = params.get('join')?.toUpperCase();
    const reconnect = params.get('reconnect')?.toUpperCase();
    const campaignId = params.get('campaignId');

    if (host) {
      await this.handleHostConnection(connection, userType, host, campaignId);
    } else if (reconnect) {
      await this.handleHostReconnection(connection, userType, reconnect, campaignId);
    } else if (join) {
      await this.handleJoinConnection(connection, join);
    } else {
      await this.handleDefaultConnection(connection, userType, campaignId);
    }
  }

  /**
   * Handles a new host connection (creates campaign and session)
   * If campaignId is provided, uses existing campaign; otherwise creates a new one.
   * Creates session in database, then initializes in-memory room state.
   * @private
   * @param {Connection} connection - WebSocket connection object
   * @param {string} [hostRoomCode] - Optional specific room code to use
   * @param {string | null} [campaignId] - Optional campaign ID to use (from authenticated user)
   * @returns {Promise<void>}
   */
  private async handleHostConnection(
    connection: Connection,
    userType: 'Authenticated' | 'Guest' | 'Anonymous',
    hostRoomCode?: string,
    campaignId?: string | null,
  ): Promise<void> {
    try {
      const normalizedHostCode = hostRoomCode?.toUpperCase();
      let preferredRoomCode = normalizedHostCode;

      let usedCampaignId: string;
      let campaignScenes: unknown[] = [];

      if (campaignId) {
        console.log(`🗂️ Using existing campaign: ${campaignId}`);
        usedCampaignId = campaignId;

        const campaign = await this.db.getCampaignById(campaignId);
        if (!campaign) {
          sendError(connection, 'Campaign not found');
          return;
        }

        // Authorize BEFORE reading scenes or mutating state
        if (!authorizeCampaignHost(connection.id, campaign)) {
          sendError(connection, 'Unauthorized to host this campaign');
          connection.ws.close(4403, 'Unauthorized');
          return;
        }

        if (!preferredRoomCode && campaign.lastRoomCode) {
          preferredRoomCode = campaign.lastRoomCode.toUpperCase();
        }
        if (campaign.scenes) {
          campaignScenes = Array.isArray(campaign.scenes)
            ? campaign.scenes
            : [];
          console.log(
            `📚 Loaded ${campaignScenes.length} scenes from campaign`,
          );
        }
      } else {
        // Only authenticated users can create new guest campaigns
        if (userType === 'Anonymous') {
          sendError(connection, 'Unauthorized to create campaign');
          connection.ws.close(4403, 'Unauthorized');
          return;
        }

        console.log(`🗂️ Creating new campaign for guest DM`);
        const campaign = await this.db.createCampaign(
          connection.id,
          `Campaign ${preferredRoomCode || 'Session'}`,
          'Auto-created campaign for quick session',
        );
        usedCampaignId = campaign.id;
      }

      if (
        preferredRoomCode &&
        this.socketManager.rooms.has(preferredRoomCode)
      ) {
        console.log(
          `🔄 Reusing active room code ${preferredRoomCode} for campaign ${usedCampaignId}`,
        );
        await this.handleHostReconnection(
          connection,
          userType,
          preferredRoomCode,
          campaignId,
        );
        return;
      }

      let sessionId = '';
      let joinCode = '';

      if (preferredRoomCode) {
        const existingSession =
          await this.db.getSessionByJoinCode(preferredRoomCode);
        if (existingSession) {
          if (existingSession.campaignId === usedCampaignId) {
            const activated = await this.db.activateSessionByJoinCode(
              preferredRoomCode,
              connection.id,
            );
            if (!activated) {
              sendError(connection, 'Failed to reactivate session');
              return;
            }
            sessionId = activated.id;
            joinCode = activated.joinCode;
          } else {
            preferredRoomCode = undefined;
          }
        } else {
          const created = await this.db.createSessionWithJoinCode(
            usedCampaignId,
            connection.id,
            preferredRoomCode,
          );
          sessionId = created.sessionId;
          joinCode = created.joinCode;
        }
      }

      if (!preferredRoomCode) {
        const created = await this.db.createSession(
          usedCampaignId,
          connection.id,
        );
        sessionId = created.sessionId;
        joinCode = created.joinCode;
      }

      try {
        await this.db.updateCampaign(usedCampaignId, {
          lastRoomCode: joinCode,
          lastRoomCodeUpdatedAt: new Date(),
        });
      } catch (error) {
        console.warn('Failed to update campaign room code:', error);
      }

      // Create in-memory room state for real-time operations
      const room: Room = {
        code: joinCode,
        host: connection.id,
        coHosts: new Set(),
        players: new Set([connection.id]),
        connections: new Map([[connection.id, connection.ws]]),
        created: Date.now(),
        lastActivity: Date.now(),
        status: 'active',
        dmConnected: true,
        gameState: createEmptySyncableGameState() as unknown as GameState,
        stateVersion: 0, // Initialize state version for delta updates
        entityVersions: new Map(),
        syncToken: hashSync(
          createEmptySyncableGameState() as unknown as JsonValue,
        ),
      };

      this.socketManager.rooms.set(joinCode, room);
      connection.room = joinCode;
      connection.user!.type = 'host'; // Preserve the user's actual name from OAuth/guest login
      if (
        !(await this.socketManager.registerDistributedConnection(
          room,
          connection,
          'host',
        ))
      ) {
        room.connections.delete(connection.id);
        room.players.delete(connection.id);
        connection.room = undefined;
        sendError(connection, 'This room already has an active host');
        return;
      }

      // Send session created confirmation to client
      sendMessage(connection, {
        type: 'event',
        data: {
          name: 'session/created',
          roomCode: joinCode,
          room: joinCode, // Keep for backward compatibility
          sessionId,
          campaignId: usedCampaignId,
          campaignScenes, // Include campaign scenes for loading into game state
          uuid: connection.id,
          hostId: connection.id,
          coHostIds: Array.from(room.coHosts),
          dmConnected: room.dmConnected,
          players: [
            {
              id: connection.id,
              name: connection.user!.name || 'Host',
              type: 'host',
              color: 'blue',
              connected: true,
              canEditScenes: true,
            },
          ],
        },
        timestamp: Date.now(),
      });
      const initialReplay = await this.prepareRoomReplay(
        joinCode,
        connection.requestedEventCursor,
      );
      if (initialReplay) {
        await this.deliverReplayWithCatchUp(
          connection,
          joinCode,
          initialReplay,
          connection.requestedEventCursor ?? null,
        );
      }

      console.log(
        `🏠 Session created: ${joinCode} (${sessionId}) for campaign ${usedCampaignId}`,
      );
    } catch (error) {
      console.error('Failed to create session:', error);
      sendError(connection, 'Failed to create session');
    }
  }

  private async handleHostReconnection(
    connection: Connection,
    userType: 'Authenticated' | 'Guest' | 'Anonymous',
    roomCode: string,
    campaignId?: string | null,
  ) {
    const normalizedRoomCode = roomCode.toUpperCase();

    // 1. Resolve target
    const session = await this.db.getSessionByJoinCode(normalizedRoomCode);
    let resolvedCampaignId = campaignId;
    if (session) {
      if (campaignId && session.campaignId !== campaignId) {
        sendError(connection, 'Room code belongs to another campaign');
        connection.ws.close(4403, 'Unauthorized');
        return;
      }
      resolvedCampaignId = session.campaignId;
    } else if (!campaignId) {
      sendError(connection, 'Room not found');
      connection.ws.close(4403, 'Room not found');
      return;
    }

    const campaign = await this.db.getCampaignById(resolvedCampaignId!);
    if (!campaign || (!session && campaign.lastRoomCode?.toUpperCase() !== normalizedRoomCode)) {
      sendError(connection, 'Room not found');
      connection.ws.close(4403, 'Room not found');
      return;
    }

    // 2. Authorize
    if (!authorizeCampaignHost(connection.id, campaign)) {
      sendError(connection, 'Unauthorized to host this campaign');
      connection.ws.close(4403, 'Unauthorized');
      return;
    }

    if (userType === 'Anonymous') {
      sendError(connection, 'Anonymous reconnect not allowed');
      connection.ws.close(4403, 'Unauthorized');
      return;
    }

    // 3. Prepare replay
    const replay = await this.prepareRoomReplay(
      normalizedRoomCode,
      connection.requestedEventCursor,
    );
    if (!replay) {
      sendError(connection, 'Unable to prepare room event recovery');
      return;
    }

    // 4. Register distributed connection (using partial room state for now since room isn't fully hydrated)
    // Wait, we need an active room to pass to registerDistributedConnection.
    let room = this.socketManager.rooms.get(normalizedRoomCode);
    if (!room) {
      room = {
        code: normalizedRoomCode,
        host: connection.id,
        coHosts: new Set(),
        players: new Set([connection.id]),
        connections: new Map(),
        created: Date.now(),
        lastActivity: Date.now(),
        status: 'active',
        dmConnected: true,
        gameState: createEmptySyncableGameState() as unknown as GameState,
        stateVersion: 0,
        entityVersions: new Map(),
        syncToken: hashSync(createEmptySyncableGameState() as unknown as JsonValue),
      };
      this.socketManager.rooms.set(normalizedRoomCode, room);
    }
    
    room.connections.set(connection.id, connection.ws);
    connection.room = normalizedRoomCode;
    connection.user!.type = 'host';
    
    if (!(await this.socketManager.registerDistributedConnection(room, connection, 'host'))) {
      room.connections.delete(connection.id);
      connection.room = undefined;
      sendError(connection, 'Failed to register presence');
      return;
    }

    // 5. Commit database changes
    if (session) {
      await this.db.activateSessionByJoinCode(normalizedRoomCode, connection.id);
    } else {
      const result = await this.db.createSessionWithJoinCode(resolvedCampaignId!, connection.id, normalizedRoomCode);
      room.sessionId = result.sessionId;
    }

    // 6. Hydrate room
    if (session) {
      const recoveredRoom = await this.recoverRoomFromSession(normalizedRoomCode);
      if (recoveredRoom) {
        room = recoveredRoom;
      } else {
        sendError(connection, 'Room not found');
        return;
      }
    }

    if (!room) {
      sendError(connection, 'Room not found');
      return;
    }

    // Reactivate hibernated room and restore host
    if (room.status === 'hibernating') {
      console.log(
        `🔄 Host reconnecting to hibernated room: ${normalizedRoomCode}`,
      );

      room.status = 'active';
      room.lastActivity = Date.now();

      // Clear hibernation timer
      if (room.hibernationTimer) {
        clearTimeout(room.hibernationTimer);
        room.hibernationTimer = undefined;
      }

      // Load game state from database if not in memory
      if (!room.gameState) {
        try {
          const session =
            await this.db.getSessionByJoinCode(normalizedRoomCode);
          if (session?.gameState) {
            room.gameState = session.gameState as GameState;
            console.log(
              `📂 Loaded game state from database: ${(session.gameState as GameState).scenes?.length || 0} scenes`,
            );
          }
        } catch (error) {
          console.error(
            `Failed to load game state for room ${roomCode}:`,
            error,
          );
        }
      }
    } else {
      console.log(`🔄 Host reconnecting to active room: ${normalizedRoomCode}`);
    }

    // Set up host connection
    room.host = connection.id;
    room.dmConnected = true;
    room.players.add(connection.id);
    room.connections.set(connection.id, connection.ws);
    room.lastActivity = Date.now();
    connection.room = normalizedRoomCode;
    connection.user = {
      name: connection.user?.name || 'Host',
      type: 'host',
    };
    if (
      !(await this.socketManager.registerDistributedConnection(
        room,
        connection,
        'host',
        replay.latestSequence,
      ))
    ) {
      room.connections.delete(connection.id);
      room.players.delete(connection.id);
      connection.room = undefined;
      sendError(connection, 'This room already has an active host');
      return;
    }

    if (campaignId) {
      try {
        await this.db.updateCampaign(campaignId, {
          lastRoomCode: normalizedRoomCode,
          lastRoomCodeUpdatedAt: new Date(),
        });
      } catch (error) {
        console.error('Failed to update campaign room code:', error);
      }
    }

    try {
      const session = await this.db.getSessionByJoinCode(normalizedRoomCode);
      if (session) {
        await this.db.addPlayerToSession(connection.id, session.id);
      }
    } catch (error) {
      console.error('Failed to update host connection in database:', error);
    }

    // Send reconnection confirmation
    console.log(
      `🎮 Room gameState when reconnecting:`,
      room.gameState ? 'exists' : 'null',
      room.gameState
        ? `${room.gameState.scenes?.length || 0} scenes`
        : 'no data',
    );
    sendMessage(connection, {
      type: 'event',
      data: {
        name: 'session/reconnected',
        roomCode: normalizedRoomCode,
        room: normalizedRoomCode,
        uuid: connection.id,
        hostId: room.host,
        roomStatus: room.status,
        gameState: room.gameState,
        dmConnected: room.dmConnected,
        players: Array.from(room.players).map((playerId) => {
          const playerConnection = this.socketManager.connections.get(playerId);
          return {
            id: playerId,
            name: playerConnection?.user?.name || 'Unknown',
            type:
              playerId === room.host || room.coHosts.has(playerId)
                ? 'host'
                : 'player',
            color: 'blue',
            connected: room.connections.has(playerId),
            canEditScenes: playerId === room.host || room.coHosts.has(playerId),
          };
        }),
      },
      timestamp: Date.now(),
    });
    await this.deliverReplayWithCatchUp(
      connection,
      normalizedRoomCode,
      replay,
      connection.requestedEventCursor ?? null,
    );

    // Notify all players about host reconnection
    this.socketManager.broadcastToRoom(
      normalizedRoomCode,
      {
        type: 'event',
        data: {
          name: 'session/host-reconnected',
          uuid: connection.id,
        },
        timestamp: Date.now(),
      },
      connection.id,
    );

    this.socketManager.broadcastToRoom(
      normalizedRoomCode,
      {
        type: 'event',
        data: {
          name: 'session/dm-status',
          dmConnected: true,
        },
        timestamp: Date.now(),
      },
      connection.id,
    );

    console.log(
      `🏠 Host reconnected to room ${normalizedRoomCode}: ${connection.id}`,
    );
  }

  /**
   * Handles a player joining an existing room/session
   * Adds player to session in database and broadcasts to other players
   * @private
   * @param {Connection} connection - WebSocket connection object
   * @param {string} roomCode - Join code of the room to join
   * @returns {Promise<void>}
   */
  private async handleJoinConnection(
    connection: Connection,
    roomCode: string,
  ): Promise<void> {
    let room = this.socketManager.rooms.get(roomCode);
    let sessionRecord: SessionRecord | null = null;

    if (!room) {
      const recoveredRoom = await this.recoverRoomFromSession(roomCode);
      if (!recoveredRoom) {
        sendError(
          connection,
          'Room not found or offline - ask the host to reopen the session',
        );
        return;
      }
      room = recoveredRoom;
    }

    // Attempt room recovery if needed
    if (room.status !== 'active') {
      const recovered = this.attemptRoomRecovery(roomCode, connection);
      if (!recovered) {
        sendError(connection, 'Room is no longer available');
        return;
      }
    }

    const replay = await this.prepareRoomReplay(
      roomCode,
      connection.requestedEventCursor,
    );
    if (!replay) {
      sendError(connection, 'Unable to prepare room event recovery');
      return;
    }

    // Add player to in-memory room state
    room.players.add(connection.id);
    room.connections.set(connection.id, connection.ws);
    room.lastActivity = Date.now();
    connection.room = roomCode;
    // Preserve the identity established from the authenticated/guest session
    // (or the verified userName query fallback) during WebSocket admission.
    // Replacing it with the literal "Player" loses names in presence, chat,
    // dice attribution, and reconnect identity checks.
    connection.user = {
      name: connection.user?.name || 'Player',
      type: 'player',
    };
    await this.socketManager.registerDistributedConnection(
      room,
      connection,
      room.coHosts.has(connection.id) ? 'cohost' : 'player',
      replay.latestSequence,
    );

    // Add player to database session
    try {
      sessionRecord = await this.db.getSessionByJoinCode(roomCode);
      if (sessionRecord) {
        await this.db.addPlayerToSession(connection.id, sessionRecord.id);
      }
    } catch (error) {
      console.error('Failed to add player to session in database:', error);
    }

    // Notify player they joined
    sendMessage(connection, {
      type: 'event',
      data: {
        name: 'session/joined',
        roomCode,
        room: roomCode, // Keep for backward compatibility
        uuid: connection.id,
        hostId: room.host,
        coHostIds: Array.from(room.coHosts),
        roomStatus: room.status,
        gameState: room.gameState,
        campaignId: sessionRecord?.campaignId,
        dmConnected: room.dmConnected,
        players: Array.from(room.players).map((playerId) => {
          const conn = this.socketManager.connections.get(playerId);
          return {
            id: playerId,
            name: conn?.user?.name || 'Unknown',
            type:
              playerId === room.host
                ? 'host'
                : room.coHosts.has(playerId)
                  ? 'host'
                  : 'player',
            color: 'blue',
            connected: true,
            canEditScenes: playerId === room.host || room.coHosts.has(playerId),
          };
        }),
      },
      timestamp: Date.now(),
    });
    await this.deliverReplayWithCatchUp(
      connection,
      roomCode,
      replay,
      connection.requestedEventCursor ?? null,
    );

    // Notify other players about the new player
    this.socketManager.broadcastToRoom(
      roomCode,
      {
        type: 'event',
        data: {
          name: 'session/join',
          uuid: connection.id,
          player: {
            id: connection.id,
            name: connection.user!.name || 'Player',
            type: 'player',
            color: 'blue',
            connected: true,
            canEditScenes: false,
          },
        },
        timestamp: Date.now(),
      },
      connection.id,
    );

    console.log(`👋 Player joined room ${roomCode}: ${connection.id}`);
  }

  private async handleDefaultConnection(
    connection: Connection,
    userType: 'Authenticated' | 'Guest' | 'Anonymous',
    campaignId?: string | null,
  ) {
    const roomCode = this.generateRoomCode();
    await this.handleHostConnection(connection, userType, roomCode, campaignId);
  }

  /**
   * Handles a WebSocket disconnection
   * Updates database and manages host transfer or room hibernation as needed
   * @private
   * @param {string} uuid - Connection UUID that disconnected
   * @returns {Promise<void>}
   */
  public async handleDisconnect(
    uuid: string,
    instanceId: string,
    disconnectedConnection?: Connection,
  ): Promise<void> {
    const activeConnection = this.socketManager.connections.get(uuid);
    if (activeConnection && activeConnection.instanceId !== instanceId) {
      console.info('[WebSocket] ignored superseded disconnect', {
        socketInstanceId: instanceId,
        activeSocketInstanceId: activeConnection.instanceId,
        participantId: uuid,
      });
      return;
    }

    const connection = disconnectedConnection || activeConnection;
    const deleteConnectionIfCurrent = () => {
      if (this.socketManager.connections.get(uuid)?.instanceId === instanceId) {
        this.socketManager.connections.delete(uuid);
      }
    };
    if (!connection?.room) {
      deleteConnectionIfCurrent();
      return;
    }

    const room = this.socketManager.rooms.get(connection.room);
    if (!room) {
      deleteConnectionIfCurrent();
      return;
    }

    const hasReplacement = () => {
      const current = this.socketManager.connections.get(uuid);
      const roomSocket = room.connections.get(uuid);
      return Boolean(
        (current && current.instanceId !== instanceId) ||
        (roomSocket && roomSocket !== connection.ws),
      );
    };
    const deleteRoomSocketIfCurrent = () => {
      if (room.connections.get(uuid) === connection.ws) {
        room.connections.delete(uuid);
      }
    };

    // Idempotency: a single socket can reach here through more than one path
    // (e.g. a forced terminate plus the ws 'close' event it triggers). Claim
    // this member synchronously — before any await — so an interleaved second
    // pass bails out here instead of re-broadcasting the leave or re-hibernating.
    if (room.connections.get(uuid) !== connection.ws) {
      deleteConnectionIfCurrent();
      return;
    }
    deleteRoomSocketIfCurrent();
    try {
      await this.socketManager.unregisterDistributedConnection(
        connection.room,
        uuid,
      );
    } catch (error) {
      console.error('Failed to clear distributed presence:', error);
    }
    if (hasReplacement()) {
      const replacement = this.socketManager.connections.get(uuid);
      if (replacement?.room === room.code) {
        const role =
          room.host === uuid
            ? 'host'
            : room.coHosts.has(uuid)
              ? 'cohost'
              : 'player';
        try {
          await this.socketManager.registerDistributedConnection(
            room,
            replacement,
            role,
          );
        } catch (error) {
          console.error('Failed to restore replacement presence:', error);
        }
      }
      console.info('[WebSocket] replacement preserved during disconnect', {
        socketInstanceId: instanceId,
        participantId: uuid,
        phase: 'presence',
      });
      return;
    }

    // Get session from database to find sessionId
    let session: SessionRecord | null = null;
    try {
      session = await this.db.getSessionByJoinCode(connection.room);
    } catch (error) {
      console.error('Failed to fetch session from database:', error);
    }
    if (hasReplacement()) {
      if (session) {
        try {
          await this.db.updatePlayerConnection(uuid, session.id, true);
        } catch (error) {
          console.error(
            'Failed to restore replacement connection status:',
            error,
          );
        }
      }
      console.info('[WebSocket] replacement preserved during disconnect', {
        socketInstanceId: instanceId,
        participantId: uuid,
        phase: 'session-lookup',
      });
      return;
    }

    // Update player connection status in database
    if (session) {
      try {
        await this.db.updatePlayerConnection(uuid, session.id, false);
      } catch (error) {
        console.error('Failed to update player connection status:', error);
      }
    }
    if (hasReplacement()) {
      if (session) {
        try {
          await this.db.updatePlayerConnection(uuid, session.id, true);
        } catch (error) {
          console.error(
            'Failed to restore replacement connection status:',
            error,
          );
        }
      }
      console.info('[WebSocket] replacement preserved during disconnect', {
        socketInstanceId: instanceId,
        participantId: uuid,
        phase: 'status-update',
      });
      return;
    }

    // Handle host disconnection
    if (room.host === uuid) {
      console.log(
        `👑 Host left room ${connection.room}, entering DM offline mode`,
      );

      room.dmConnected = false;
      room.players.delete(uuid);
      deleteRoomSocketIfCurrent();
      room.lastActivity = Date.now();

      this.hibernateRoom(connection.room);

      this.socketManager.broadcastToRoom(connection.room, {
        type: 'event',
        data: {
          name: 'session/hibernated',
          message:
            'Host disconnected. Room is still available while players remain connected.',
          reconnectWindow: this.HIBERNATION_TIMEOUT,
          dmConnected: false,
        },
        timestamp: Date.now(),
      });

      this.socketManager.broadcastToRoom(connection.room, {
        type: 'event',
        data: {
          name: 'session/dm-status',
          dmConnected: false,
        },
        timestamp: Date.now(),
      });
    } else {
      // Regular player disconnection
      console.log(`👋 Player left room ${connection.room}: ${uuid}`);
      room.players.delete(uuid);
      deleteRoomSocketIfCurrent();
      room.lastActivity = Date.now();

      this.socketManager.broadcastToRoom(connection.room, {
        type: 'event',
        data: { name: 'session/leave', uuid },
        timestamp: Date.now(),
      });

      if (!room.dmConnected && room.players.size === 0) {
        this.hibernateRoom(connection.room);
      }
    }

    deleteConnectionIfCurrent();
  }

  /**
   * Hibernates a room when the host disconnects with no replacement
   * Room enters hibernation mode for HIBERNATION_TIMEOUT before being abandoned
   * @private
   * @param {string} roomCode - Join code of the room to hibernate
   * @returns {Promise<void>}
   */
  private async hibernateRoom(roomCode: string): Promise<void> {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room || room.status === 'hibernating') return;

    room.status = 'hibernating';
    room.lastActivity = Date.now();

    // Update session status in database
    try {
      const session = await this.db.getSessionByJoinCode(roomCode);
      if (session) {
        await this.db.updateSessionStatus(session.id, 'hibernating');
      }
    } catch (error) {
      console.error('Failed to update session status to hibernating:', error);
    }

    // Clear any existing hibernation timer
    if (room.hibernationTimer) {
      clearTimeout(room.hibernationTimer);
    }

    // Only schedule abandonment if no players are connected
    if (room.players.size === 0) {
      room.hibernationTimer = setTimeout(() => {
        this.abandonRoom(roomCode);
      }, this.HIBERNATION_TIMEOUT);
    } else {
      room.hibernationTimer = undefined;
    }

    console.log(
      `😴 Room ${roomCode} hibernated${room.players.size === 0 ? `, will be abandoned in ${this.HIBERNATION_TIMEOUT / 1000}s` : ', waiting for host reconnect'}`,
    );
  }

  /**
   * Abandons a room after hibernation timeout expires
   * Closes all connections and schedules database cleanup
   * @private
   * @param {string} roomCode - Join code of the room to abandon
   * @returns {Promise<void>}
   */
  private async abandonRoom(roomCode: string): Promise<void> {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room) return;

    console.log(`🗑️ Abandoning room: ${roomCode}`);

    // Update session status in database
    try {
      const session = await this.db.getSessionByJoinCode(roomCode);
      if (session) {
        await this.db.updateSessionStatus(session.id, 'abandoned');
      }
    } catch (error) {
      console.error('Failed to update session status to abandoned:', error);
    }

    // Clear hibernation timer
    if (room.hibernationTimer) {
      clearTimeout(room.hibernationTimer);
    }

    // Close all remaining connections
    room.connections.forEach((ws, connUuid) => {
      ws.close();
      this.socketManager.connections.delete(connUuid);
    });

    // Remove room from memory
    this.socketManager.removeRoom(roomCode);

    // Schedule database cleanup after abandonment timeout
    setTimeout(async () => {
      try {
        const session = await this.db.getSessionByJoinCode(roomCode);
        if (session) {
          await this.db.deleteSession(session.id);
          console.log(
            `🗑️ Deleted abandoned session from database: ${roomCode}`,
          );
        }
      } catch (error) {
        console.error('Failed to delete session from database:', error);
      }
    }, this.ABANDONMENT_TIMEOUT);
  }

  private attemptRoomRecovery(
    roomCode: string,
    _connection: Connection,
  ): boolean {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room) return false;
    if (room.status === 'abandoned') {
      return false;
    }
    if (room.status === 'hibernating') {
      if (!room.dmConnected) {
        return true;
      }
      console.log(`🔄 Reactivating hibernated room: ${roomCode}`);
      room.status = 'active';
      room.lastActivity = Date.now();
      if (room.hibernationTimer) {
        clearTimeout(room.hibernationTimer);
        room.hibernationTimer = undefined;
      }
      this.socketManager.broadcastToRoom(roomCode, {
        type: 'event',
        data: {
          name: 'session/reactivated',
          message: 'Room has been reactivated.',
          reconnectBy: _connection.id,
        },
        timestamp: Date.now(),
      });
      return true;
    }
    return room.status === 'active';
  }

  /**
   * Rehydrates an in-memory room from persisted session data when a join request
   * arrives but the room map does not contain the code (e.g., after a restart
   * or when a player hit a different instance). This is a best-effort recovery;
   * host connections are not restored here.
   */
  private async recoverRoomFromSession(
    roomCode: string,
  ): Promise<Room | undefined> {
    try {
      let session = await this.db.getSessionByJoinCode(roomCode);
      if (!session || session.status === 'abandoned') {
        return undefined;
      }

      let recoveredState = buildSyncableFromLegacy(session.gameState);
      let recoveredToken = hashSync(recoveredState as unknown as JsonValue);
      if (session.syncToken !== recoveredToken) {
        const repaired = await this.db.repairGameStateMetadata(
          roomCode,
          session.stateVersion,
          session.syncToken,
          recoveredState,
          recoveredToken,
        );
        if (repaired) {
          session = repaired;
          recoveredState = buildSyncableFromLegacy(session.gameState);
          recoveredToken = hashSync(recoveredState as unknown as JsonValue);
        }
      }

      const hosts = await this.db.getHostsBySession(session.id);
      const coHostsSet = new Set<string>();
      for (const host of hosts) {
        if (!host.isPrimary) {
          coHostsSet.add(host.userId);
        }
      }

      const recoveredRoom: Room = {
        code: session.joinCode,
        host: session.primaryHostId,
        coHosts: coHostsSet,
        sessionId: session.id,
        players: new Set<string>(),
        connections: new Map(),
        created: session.createdAt
          ? new Date(session.createdAt).getTime()
          : Date.now(),
        lastActivity: Date.now(),
        status: session.status === 'hibernating' ? 'hibernating' : 'active',
        dmConnected: false,
        hibernationTimer: undefined,
        gameState: recoveredState as unknown as GameState,
        previousGameState: undefined,
        stateVersion: session.stateVersion,
        entityVersions: new Map(),
        syncToken: recoveredToken,
      };

      this.socketManager.rooms.set(roomCode, recoveredRoom);
      await this.socketManager.hydrateDistributedPresence(recoveredRoom);
      console.log(
        `🔄 Recovered room ${roomCode} from session; status: ${recoveredRoom.status}`,
      );
      return recoveredRoom;
    } catch (error) {
      console.error(`Failed to recover room ${roomCode} from session:`, error);
      return undefined;
    }
  }

  private generateRoomCode(): string {
    // A room code is the only credential needed to join a room, so it is drawn
    // from the OS CSPRNG rather than Math.random(), whose stream is
    // reconstructable from a handful of observed outputs.
    let result: string;
    do {
      result = generateSecureJoinCode(4);
    } while (this.socketManager.rooms.has(result));
    return result;
  }
}
