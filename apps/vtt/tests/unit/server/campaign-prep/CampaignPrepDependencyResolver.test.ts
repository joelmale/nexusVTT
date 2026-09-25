import type { CampaignObjectRef } from '@nexus/game-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignPrepDependencyResolver } from '../../../../server/campaign-prep/CampaignPrepDependencyResolver.js';

const context = {
  campaignId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  principalId: '11111111-1111-4111-8111-111111111111',
};

const campaignObjectRef: CampaignObjectRef = {
  target: 'campaign-object',
  campaignId: context.campaignId,
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  revision: 2,
};

function createDependencies() {
  return {
    campaignPrep: {
      getObject: vi.fn(),
      getRevision: vi.fn(),
    },
    documentClient: {
      getDocument: vi.fn(),
    },
    getAssetManifest: vi.fn(),
    libraryObjects: {
      getObjectById: vi.fn(),
      getRevision: vi.fn(),
    },
    rulesCatalog: {
      fetchEntities: vi.fn(),
      fetchManifest: vi.fn(),
    },
  };
}

describe('CampaignPrepDependencyResolver', () => {
  let dependencies: ReturnType<typeof createDependencies>;
  let resolver: CampaignPrepDependencyResolver;

  beforeEach(() => {
    dependencies = createDependencies();
    resolver = new CampaignPrepDependencyResolver(dependencies);
  });

  it('resolves an exact campaign entry revision', async () => {
    dependencies.campaignPrep.getObject.mockResolvedValue({
      kind: 'note',
      status: 'draft',
    });
    dependencies.campaignPrep.getRevision.mockResolvedValue({ revision: 2 });

    await expect(resolver.resolve(campaignObjectRef, context)).resolves.toEqual({
      status: 'available',
      objectType: 'campaign-entry',
    });
    expect(dependencies.campaignPrep.getRevision).toHaveBeenCalledWith(
      campaignObjectRef.id,
      2,
    );
  });

  it('rejects archived or missing campaign object revisions', async () => {
    dependencies.campaignPrep.getObject.mockResolvedValue({
      kind: 'note',
      status: 'archived',
    });
    await expect(resolver.resolve(campaignObjectRef, context)).resolves.toEqual({
      status: 'missing',
    });

    dependencies.campaignPrep.getObject.mockResolvedValue({
      kind: 'scene-template',
      status: 'draft',
    });
    dependencies.campaignPrep.getRevision.mockResolvedValue(null);
    await expect(resolver.resolve(campaignObjectRef, context)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('requires definition ownership or campaign scope and an exact revision', async () => {
    const reference: CampaignObjectRef = {
      target: 'definition',
      ref: {
        kind: 'encounter',
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        revision: 5,
      },
    };
    dependencies.libraryObjects.getObjectById.mockResolvedValue({
      campaignId: null,
      isArchived: false,
      kind: 'encounter',
      ownerId: 'someone-else',
    });
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'forbidden',
    });

    dependencies.libraryObjects.getObjectById.mockResolvedValue({
      campaignId: context.campaignId,
      isArchived: false,
      kind: 'encounter',
      ownerId: 'someone-else',
    });
    dependencies.libraryObjects.getRevision.mockResolvedValue({ revision: 5 });
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'available',
      objectType: 'definition',
    });
  });

  it('resolves bundled assets and reports an unloaded manifest', async () => {
    const reference: CampaignObjectRef = {
      target: 'asset',
      assetId: 'glass-harbor-map',
    };
    dependencies.getAssetManifest.mockReturnValue(null);
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'unavailable',
    });

    dependencies.getAssetManifest.mockReturnValue({
      assets: [{ id: reference.assetId }],
    });
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'available',
      objectType: 'asset',
    });

    dependencies.getAssetManifest.mockReturnValue({ assets: [] });
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('resolves a live rules entity at or beyond its pinned catalog version', async () => {
    const reference: CampaignObjectRef = {
      target: 'rules-entity',
      entityType: 'monster',
      ruleset: '2024',
      slug: 'bandit',
      catalogVersion: 3,
    };
    dependencies.rulesCatalog.fetchEntities.mockResolvedValue({
      status: 200,
      etag: 'W/"4"',
      body: {
        catalogVersion: 4,
        entities: [
          { entityType: 'monster', ruleset: '2024', slug: 'bandit' },
        ],
        removed: [],
        since: 0,
        skipped: [],
      },
    });
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'available',
      objectType: 'rules-entity',
    });

    dependencies.rulesCatalog.fetchEntities.mockRejectedValue(
      new Error('offline'),
    );
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'unavailable',
    });

    resolver = new CampaignPrepDependencyResolver({
      ...dependencies,
      rulesCatalog: null,
    });
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('enforces document visibility without exposing document metadata', async () => {
    const reference: CampaignObjectRef = {
      target: 'document',
      documentId: 'doc-glass-harbor',
    };
    dependencies.documentClient.getDocument.mockResolvedValue({
      campaigns: [],
      isPublic: false,
      uploadedBy: 'someone-else',
    });
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'forbidden',
    });

    dependencies.documentClient.getDocument.mockResolvedValue({
      campaigns: [context.campaignId],
      isPublic: false,
      uploadedBy: 'someone-else',
    });
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'available',
      objectType: 'document',
    });

    resolver = new CampaignPrepDependencyResolver({
      ...dependencies,
      documentClient: null,
    });
    await expect(resolver.resolve(reference, context)).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
