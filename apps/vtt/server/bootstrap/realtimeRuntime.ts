import type { RequestHandler } from 'express';
import type { Server as HttpServer } from 'http';
import type { WebSocketServer } from 'ws';
import type { DatabaseService } from '../database.js';
import type { DeltaSyncMetrics } from '../observability/deltaSyncMetrics.js';
import { ConnectionLifecycle } from '../socket/ConnectionLifecycle.js';
import { GameStateCommitService } from '../socket/GameStateCommitService.js';
import { sendError } from '../socket/messaging.js';
import { CombatHandler } from '../socket/handlers/CombatHandler.js';
import { CharacterHandler } from '../socket/handlers/CharacterHandler.js';
import { ChatHandler } from '../socket/handlers/ChatHandler.js';
import { DiceHandler } from '../socket/handlers/DiceHandler.js';
import { DocumentSyncHandler } from '../socket/handlers/DocumentSyncHandler.js';
import { EntitySyncHandler } from '../socket/handlers/EntitySyncHandler.js';
import { HostHandler } from '../socket/handlers/HostHandler.js';
import { SceneHandler } from '../socket/handlers/SceneHandler.js';
import { SocketManager } from '../socket/SocketManager.js';
import { attachWebSocketUpgrade, registerWebSocketConnections } from '../socket/websocketUpgrade.js';
import type { Connection } from '../types.js';

export function createRealtimeRuntime({
  db,
  deltaSyncMetrics,
  wss,
}: {
  db: DatabaseService;
  deltaSyncMetrics: DeltaSyncMetrics;
  wss: WebSocketServer;
}): {
  socketManager: SocketManager;
  lifecycle: ConnectionLifecycle;
  gameStateCommits: GameStateCommitService;
  attach: (httpServer: HttpServer, sessionMiddleware: RequestHandler) => void;
} {
  const socketManager = new SocketManager(wss, db);
  const lifecycle = new ConnectionLifecycle({ socketManager, db });
  const gameStateCommits = new GameStateCommitService({ socketManager, db, deltaSyncMetrics });
  new ChatHandler(socketManager, db);
  new SceneHandler(socketManager, db);
  new DiceHandler(socketManager, db);
  new DocumentSyncHandler(socketManager, db);
  new HostHandler(socketManager, db);
  new EntitySyncHandler(socketManager, db);
  new CharacterHandler(socketManager, db);
  new CombatHandler(socketManager, db);

  socketManager.on('event:game-state-update', ({ connection, room, message }) => {
    if (room.host !== connection.id && !room.coHosts.has(connection.id)) {
      sendError(connection, 'Access denied: Host privilege required.');
      return;
    }
    gameStateCommits.enqueueUpload(room.code, connection, message.data);
  });
  socketManager.on('disconnect', ({ id, instanceId, connection }: { id: string; instanceId: string; connection: Connection }) => {
    void lifecycle.handleDisconnect(id, instanceId, connection);
  });

  return {
    socketManager,
    lifecycle,
    gameStateCommits,
    attach(httpServer, sessionMiddleware) {
      attachWebSocketUpgrade({ httpServer, wss, sessionMiddleware });
      registerWebSocketConnections(wss, (ws, request) => { void lifecycle.handleConnection(ws, request); });
    },
  };
}
