import type express from 'express';
import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Duplex } from 'stream';
import type { WebSocket, WebSocketServer } from 'ws';
import type { RequestWithSession } from './ConnectionLifecycle.js';

export interface WebSocketUpgradeOptions {
  httpServer: HttpServer;
  wss: WebSocketServer;
  /** The same express-session middleware the HTTP app uses. */
  sessionMiddleware: express.RequestHandler;
}

/**
 * Routes HTTP upgrade requests into the WebSocket server, running the Express
 * session middleware first so `req.session` is populated before admission.
 */
export function attachWebSocketUpgrade({
  httpServer,
  wss,
  sessionMiddleware,
}: WebSocketUpgradeOptions): void {
  httpServer.on(
    'upgrade',
    (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      sessionMiddleware(req as express.Request, {} as express.Response, () => {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      });
    },
  );
}

/** Registers the accepted-connection handler on the WebSocket server. */
export function registerWebSocketConnections(
  wss: WebSocketServer,
  onConnection: (ws: WebSocket, req: RequestWithSession) => void,
): void {
  wss.on('connection', (ws, req) => {
    onConnection(ws, req as RequestWithSession);
  });
}
