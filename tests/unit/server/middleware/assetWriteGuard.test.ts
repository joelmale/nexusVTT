import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assetWriteGuard } from '../../../../server/middleware/assetWriteGuard.js';
import type { Request, Response, NextFunction } from 'express';

function makeReq(opts: {
  isAuthenticated: boolean;
  user?: { id: string; provider?: string };
  path: string;
}): Request {
  return {
    isAuthenticated: () => opts.isAuthenticated,
    user: opts.user,
    path: opts.path,
  } as unknown as Request;
}

function makeRes() {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res as Response;
  });
  return res as Response & { statusCode?: number; body?: unknown };
}

describe('assetWriteGuard', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('rejects unauthenticated requests with 401', () => {
    const req = makeReq({ isAuthenticated: false, path: '/user123/upload' });
    const res = makeRes();

    assetWriteGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects authenticated requests with no req.user with 401', () => {
    const req = makeReq({ isAuthenticated: true, user: undefined, path: '/user123/upload' });
    const res = makeRes();

    assetWriteGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects guest users with a distinct 403 guest-upload-forbidden body', () => {
    const req = makeReq({
      isAuthenticated: true,
      user: { id: 'user123', provider: 'guest' },
      path: '/user123/upload',
    });
    const res = makeRes();

    assetWriteGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'guest-upload-forbidden',
      message: 'Sign in to upload assets',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a mismatched :userId path segment for a non-guest authenticated user with 403', () => {
    const req = makeReq({
      isAuthenticated: true,
      user: { id: 'user123', provider: 'google' },
      path: '/someone-else/upload',
    });
    const res = makeRes();

    assetWriteGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden: cannot act on behalf of another user',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for a non-guest authenticated user whose id matches the path', () => {
    const req = makeReq({
      isAuthenticated: true,
      user: { id: 'user123', provider: 'discord' },
      path: '/user123/upload',
    });
    const res = makeRes();

    assetWriteGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() for a non-guest authenticated user hitting the nested asset delete path', () => {
    const req = makeReq({
      isAuthenticated: true,
      user: { id: 'user123', provider: 'google' },
      path: '/user123/asset/some-asset-id',
    });
    const res = makeRes();

    assetWriteGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
