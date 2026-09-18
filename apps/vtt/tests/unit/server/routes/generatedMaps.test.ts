import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import { setupGeneratedMapsRoute } from '../../../../server/routes/generatedMaps.js';

const realFetch = globalThis.fetch;

describe('setupGeneratedMapsRoute', () => {
  let app: Express;
  let server: Server;
  let baseUrl: string;
  let sessionUser: { id: string } | null = null;
  let isNonGuest = true;

  beforeEach(async () => {
    sessionUser = { id: 'user-123' };
    isNonGuest = true;

    app = express();

    // Mock session and auth middleware
    app.use((req, _res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).session = {
        passport: sessionUser ? { user: { id: sessionUser.id } } : undefined,
      };
      next();
    });

    const mockGuard = (_req: Request, res: Response, next: NextFunction) => {
      if (!isNonGuest) {
        return res.status(403).json({ error: 'Guest access forbidden' });
      }
      next();
    };

    setupGeneratedMapsRoute(app, mockGuard);

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

  it('rejects unauthenticated requests or requests with missing session userId', async () => {
    sessionUser = null;

    const res = await realFetch(`${baseUrl}/api/generated-maps`, {
      method: 'POST',
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('User ID not found in session');
  });

  it('rejects requests with missing file', async () => {
    const res = await realFetch(`${baseUrl}/api/generated-maps`, {
      method: 'POST',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No file provided');
  });

  it('forwards uploaded file and metadata to asset service', async () => {
    const mockAssetResponse = { mapId: 'map-abc', url: '/assets/maps/map-abc.png' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const urlStr =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as { url: string }).url;

      if (urlStr.includes('/user/user-123/generated-map')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockAssetResponse,
          text: async () => '',
        } as unknown as Response);
      }
      return realFetch(input, init);
    });

    const boundary = '----TestBoundary1234567890';
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test-map.png"',
      'Content-Type: image/png',
      '',
      'fake image content',
      `--${boundary}`,
      'Content-Disposition: form-data; name="importId"',
      '',
      'imp-1',
      `--${boundary}`,
      'Content-Disposition: form-data; name="width"',
      '',
      '20',
      `--${boundary}`,
      'Content-Disposition: form-data; name="height"',
      '',
      '20',
      `--${boundary}--`,
    ].join('\r\n');

    const res = await realFetch(`${baseUrl}/api/generated-maps`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockAssetResponse);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/user/user-123/generated-map'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('handles upstream asset service failure with 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const urlStr =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as { url: string }).url;

      if (urlStr.includes('/user/user-123/generated-map')) {
        return Promise.resolve({
          ok: false,
          status: 502,
          text: async () => 'Asset service unavailable',
        } as unknown as Response);
      }
      return realFetch(input, init);
    });

    const boundary = '----TestBoundary1234567890';
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test-map.png"',
      'Content-Type: image/png',
      '',
      'fake image content',
      `--${boundary}--`,
    ].join('\r\n');

    const res = await realFetch(`${baseUrl}/api/generated-maps`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to upload generated map');
  });
});
