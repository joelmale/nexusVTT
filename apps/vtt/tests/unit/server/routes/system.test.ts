import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import type { Server } from 'node:http';
import {
  createSystemRouter,
  formatUptimeSeconds,
} from '../../../../server/routes/system.routes.js';
import type { DatabaseService } from '../../../../server/database.js';
import type { SocketManager } from '../../../../server/socket/SocketManager.js';

describe('system.routes', () => {
  describe('formatUptimeSeconds', () => {
    it('formats pure seconds', () => {
      expect(formatUptimeSeconds(45)).toBe('45s');
    });

    it('formats minutes and seconds', () => {
      expect(formatUptimeSeconds(125)).toBe('2m 5s');
    });

    it('formats hours, minutes, and seconds', () => {
      expect(formatUptimeSeconds(3665)).toBe('1h 1m 5s');
    });

    it('formats days, hours, minutes, and seconds', () => {
      expect(formatUptimeSeconds(90061)).toBe('1d 1h 1m 1s');
    });
  });

  describe('createSystemRouter', () => {
    let app: Express;
    let server: Server;
    let baseUrl: string;
    let mockPoolQuery: ReturnType<typeof vi.fn>;
    let mockDb: DatabaseService;
    let mockSocketManager: SocketManager;

    beforeEach(async () => {
      mockPoolQuery = vi.fn().mockResolvedValue({
        rows: [{ server_version: '16.3' }],
      });

      mockDb = {
        getPoolStats: vi.fn().mockReturnValue({
          totalConnections: 10,
          idleConnections: 7,
          waitingRequests: 0,
        }),
        getPool: vi.fn().mockReturnValue({
          query: mockPoolQuery,
        }),
      } as unknown as DatabaseService;

      mockSocketManager = {
        getStats: vi.fn().mockReturnValue({
          totalRooms: 3,
          totalConnections: 5,
          realtime: {
            enabled: true,
            connected: true,
            instanceId: 'test-instance',
          },
        }),
      } as unknown as SocketManager;

      app = express();
      const router = createSystemRouter({
        db: mockDb,
        getSocketManager: () => mockSocketManager,
        port: 5001,
      });
      app.use(router);

      server = app.listen(0, '127.0.0.1');
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address = server.address();
      if (address && typeof address !== 'string') {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      vi.restoreAllMocks();
    });

    it('returns 200 with full system information JSON', async () => {
      const res = await fetch(`${baseUrl}/api/system/info`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(typeof data.timestamp).toBe('number');

      // Runtime
      expect(data.runtime).toBeDefined();
      expect(data.runtime.nodeVersion).toBe(process.version);
      expect(data.runtime.platform).toBe(process.platform);
      expect(typeof data.runtime.formattedUptime).toBe('string');

      // Memory
      expect(data.memory).toBeDefined();
      expect(typeof data.memory.rssMb).toBe('number');
      expect(typeof data.memory.heapUsedMb).toBe('number');

      // Database
      expect(data.database.engine).toBe('PostgreSQL');
      expect(data.database.version).toBe('PostgreSQL 16.3');
      expect(data.database.totalConnections).toBe(10);
      expect(data.database.idleConnections).toBe(7);
      expect(data.database.activeConnections).toBe(3);

      // Realtime
      expect(data.realtime.enabled).toBe(true);
      expect(data.realtime.connected).toBe(true);
      expect(data.realtime.roomsCount).toBe(3);
      expect(data.realtime.connectionsCount).toBe(5);

      // Deployment
      expect(data.deployment.edition).toContain('Community');
      expect(data.deployment.license).toBe('MIT');
      expect(data.deployment.links.github).toBeDefined();
    });

    it('handles query failure for database version gracefully', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('connection timeout'));

      const res = await fetch(`${baseUrl}/api/system/info`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.database.version).toBe('PostgreSQL');
    });

    it('returns 500 when an unexpected exception occurs', async () => {
      const faultyDb = {
        getPoolStats: () => {
          throw new Error('Fatal pool failure');
        },
      } as unknown as DatabaseService;

      const faultApp = express();
      faultApp.use(
        createSystemRouter({
          db: faultyDb,
          getSocketManager: () => mockSocketManager,
          port: 5001,
        }),
      );

      const faultServer = faultApp.listen(0, '127.0.0.1');
      await new Promise<void>((resolve) => faultServer.once('listening', resolve));
      const address = faultServer.address();
      const faultBaseUrl =
        address && typeof address !== 'string' ? `http://127.0.0.1:${address.port}` : '';

      try {
        const res = await fetch(`${faultBaseUrl}/api/system/info`);
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.status).toBe('error');
        expect(data.message).toBe('Fatal pool failure');
      } finally {
        await new Promise<void>((resolve) => faultServer.close(() => resolve()));
      }
    });
  });
});
