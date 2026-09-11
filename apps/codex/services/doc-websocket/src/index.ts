import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { env } from './config/env';
import { DocumentWebSocketServer } from './websocket/server';
import { redisService } from './services/redis.service';
import { prisma } from './services/database.service';

const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'doc-websocket',
    timestamp: new Date().toISOString(),
  });
});

// WebSocket upgrade endpoint
const wss = new WebSocketServer({
  server,
  path: '/ws',
});

// Initialize WebSocket server
const wsServer = new DocumentWebSocketServer(wss);

console.log('WebSocket server initialized on path: /ws');

// Start server
server.listen(env.PORT, () => {
  console.log(`Doc-WebSocket service running on port ${env.PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${env.PORT}/ws`);
  console.log(`Health check: http://localhost:${env.PORT}/health`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');

  // Close WebSocket server
  wsServer.shutdown();

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Close database connections
  await Promise.all([
    prisma.$disconnect(),
    redisService.close(),
  ]);

  console.log('All connections closed');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
