import type { NextFunction, Request, Response } from 'express';

import type { AssetReference } from '../repositories/CampaignPrepRepository.js';

export type FindAssetReferences = (
  ownerUserId: string,
  assetId: string,
) => Promise<AssetReference[]>;

/**
 * Mounted under '/api/user' (so req.path is '/:userId/asset/:assetId'; like
 * assetWriteGuard it reads the path itself). Non-DELETE requests and other
 * paths pass straight through. Blocks DELETE of an asset while a non-archived
 * Campaign Studio object still points at the asset, so a hard delete cannot
 * leave a campaign map pointing at a missing image. Runs after assetWriteGuard
 * (the session user already matches :userId); unreferenced deletes fall through
 * to the proxy.
 */
export function createAssetDeleteGuard(
  findAssetReferences: FindAssetReferences,
) {
  return async function assetDeleteGuard(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const match =
      req.method === 'DELETE'
        ? /^\/([^/]+)\/asset\/([^/]+)\/?$/.exec(req.path)
        : null;
    if (!match) {
      next();
      return;
    }
    const [, userId, assetId] = match;
    if (!/^[a-zA-Z0-9-]+$/.test(assetId)) {
      res.status(400).json({ error: 'Invalid assetId' });
      return;
    }
    try {
      const references = await findAssetReferences(userId, assetId);
      if (references.length > 0) {
        res.status(409).json({
          error: 'This asset is still used by campaign content.',
          references,
        });
        return;
      }
      next();
    } catch (error) {
      console.error('Asset reference check failed:', error);
      res.status(500).json({ error: 'Could not verify asset usage' });
    }
  };
}
