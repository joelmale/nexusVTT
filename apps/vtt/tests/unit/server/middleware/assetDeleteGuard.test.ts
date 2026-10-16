import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { createAssetDeleteGuard } from '../../../../server/middleware/assetDeleteGuard.js';

function run(
  find: Parameters<typeof createAssetDeleteGuard>[0],
  assetId = 'asset-1',
  method = 'DELETE',
) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const next = vi.fn();
  const req = {
    method,
    path: `/user-1/asset/${assetId}`,
  } as unknown as Request;
  const res = { status } as unknown as Response;
  return createAssetDeleteGuard(find)(req, res, next as NextFunction).then(
    () => ({ json, status, next }),
  );
}

describe('assetDeleteGuard', () => {
  it('returns 409 with the references when the asset is still used', async () => {
    const references = [
      {
        campaignId: 'c1',
        campaignName: 'Ashes',
        objectId: 'o1',
        kind: 'campaign-map' as const,
        title: 'Harbor',
      },
    ];
    const find = vi.fn().mockResolvedValue(references);
    const { status, json, next } = await run(find);
    expect(find).toHaveBeenCalledWith('user-1', 'asset-1');
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String), references }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('passes unreferenced deletes on to the proxy', async () => {
    const { status, next } = await run(vi.fn().mockResolvedValue([]));
    expect(next).toHaveBeenCalledWith();
    expect(status).not.toHaveBeenCalled();
  });

  it('ignores non-DELETE requests', async () => {
    const find = vi.fn();
    const { next } = await run(find, 'asset-1', 'PATCH');
    expect(next).toHaveBeenCalledWith();
    expect(find).not.toHaveBeenCalled();
  });

  it('rejects malformed asset ids without querying', async () => {
    const find = vi.fn();
    const { status } = await run(find, "a'b");
    expect(status).toHaveBeenCalledWith(400);
    expect(find).not.toHaveBeenCalled();
  });

  it('fails closed with 500 when the lookup throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { status, next } = await run(vi.fn().mockRejectedValue(new Error('db')));
    expect(status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
