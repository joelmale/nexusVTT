import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handler: (_req: unknown, _res: unknown, next: () => void) => next(),
  registerApiRoutes: vi.fn(),
  createAuthRouter: vi.fn(),
  createCampaignPrepRouter: vi.fn(),
  createAssetRouter: vi.fn(),
  createDocumentRoutes: vi.fn(),
  createHealthRouter: vi.fn(),
  createMetricsRouter: vi.fn(),
  createRulesCatalogRouter: vi.fn(),
  createSystemRouter: vi.fn(),
}));

vi.mock('pg', () => ({ Pool: class Pool {} }));
vi.mock('connect-pg-simple', () => ({ default: () => class SessionStore {} }));
vi.mock('express-session', () => ({ default: vi.fn(() => mocks.handler) }));
vi.mock('../../../../server/auth.js', () => ({ default: { initialize: () => mocks.handler, session: () => mocks.handler } }));
vi.mock('../../../../server/routes/api.js', () => ({ registerApiRoutes: mocks.registerApiRoutes }));
vi.mock('../../../../server/routes/auth.routes.js', () => ({ createAuthRouter: mocks.createAuthRouter }));
vi.mock('../../../../server/routes/campaignPrep.routes.js', () => ({ createCampaignPrepRouter: mocks.createCampaignPrepRouter }));
vi.mock('../../../../server/routes/assets.routes.js', () => ({ createAssetRouter: mocks.createAssetRouter }));
vi.mock('../../../../server/routes/documents.js', () => ({ createDocumentRoutes: mocks.createDocumentRoutes }));
vi.mock('../../../../server/routes/health.routes.js', () => ({ createHealthRouter: mocks.createHealthRouter }));
vi.mock('../../../../server/routes/metrics.routes.js', () => ({ createMetricsRouter: mocks.createMetricsRouter }));
vi.mock('../../../../server/routes/rulesCatalog.routes.js', () => ({ createRulesCatalogRouter: mocks.createRulesCatalogRouter }));
vi.mock('../../../../server/routes/system.routes.js', () => ({ createSystemRouter: mocks.createSystemRouter }));

import { createHttpApp } from '../../../../server/bootstrap/httpApp.js';

describe('HTTP app factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthRouter.mockReturnValue(mocks.handler);
    mocks.createCampaignPrepRouter.mockReturnValue(mocks.handler);
    mocks.createAssetRouter.mockReturnValue(mocks.handler);
    mocks.createDocumentRoutes.mockReturnValue(mocks.handler);
    mocks.createHealthRouter.mockReturnValue(mocks.handler);
    mocks.createMetricsRouter.mockReturnValue(mocks.handler);
    mocks.createRulesCatalogRouter.mockReturnValue(mocks.handler);
    mocks.createSystemRouter.mockReturnValue(mocks.handler);
  });

  it('composes middleware and route builders with lazy realtime dependencies', () => {
    const socketManager = { getStats: vi.fn() };
    const gameStateCommits = { queueDepth: 3 };
    const result = createHttpApp({
      assetsPath: '/assets',
      db: {} as never,
      deltaSyncMetrics: {} as never,
      documentClient: null,
      documentsEnabled: false,
      docApiUrl: undefined,
      getSocketManager: () => socketManager as never,
      getGameStateCommits: () => gameStateCommits as never,
      manifestStore: { current: null } as never,
      port: 5001,
    });
    expect(result.app).toBeDefined();
    expect(result.sessionMiddleware).toBeTypeOf('function');
    expect(mocks.registerApiRoutes).toHaveBeenCalledWith(
      result.app,
      expect.anything(),
      '/assets',
      expect.any(Function),
    );
    expect(mocks.createDocumentRoutes).toHaveBeenCalledWith(null, false, expect.anything());
    expect(mocks.createCampaignPrepRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        author: expect.anything(),
        db: expect.anything(),
        publisher: expect.anything(),
      }),
    );
    expect(mocks.createMetricsRouter).toHaveBeenCalledWith(expect.objectContaining({ getSocketManager: expect.any(Function), getGameStateQueueDepth: expect.any(Function) }));
    expect(mocks.createRulesCatalogRouter).toHaveBeenCalledWith(expect.objectContaining({ docApiUrl: undefined }));
    expect(mocks.createAssetRouter).toHaveBeenCalledWith(expect.objectContaining({ assetApiUrl: expect.any(String) }));
  });
});
