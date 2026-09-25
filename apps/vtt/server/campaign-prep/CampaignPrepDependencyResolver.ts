import type { CampaignObjectRef } from '@nexus/game-contracts';

import type { LibraryObjectRepository } from '../repositories/LibraryObjectRepository.js';
import type { CampaignPrepRepository } from '../repositories/CampaignPrepRepository.js';
import type { AssetManifest } from '../../shared/types.js';
import type { DocumentServiceClient } from '../services/documentServiceClient.js';
import type { RulesCatalogUpstream } from '../services/rulesCatalogClient.js';
import type {
  UserAssetCatalogClient,
  UserAssetResolution,
} from '../services/userAssetCatalogClient.js';
import type {
  PrepDependencyObjectType,
  PrepDependencyResolution,
  PrepDependencyResolutionContext,
  PrepDependencyResolver,
} from './SessionPlanPublishValidator.js';

type CampaignPrepLookup = Pick<
  CampaignPrepRepository,
  'getObject' | 'getRevision'
>;

type LibraryObjectLookup = Pick<
  LibraryObjectRepository,
  'getObjectById' | 'getRevision'
>;

export interface CampaignPrepDependencyResolverOptions {
  campaignPrep: CampaignPrepLookup;
  documentClient: Pick<DocumentServiceClient, 'getDocument'> | null;
  getAssetManifest: () => AssetManifest | null;
  libraryObjects: LibraryObjectLookup;
  rulesCatalog: RulesCatalogUpstream | null;
  userAssetCatalog: Pick<UserAssetCatalogClient, 'resolveAsset'> | null;
}

const CAMPAIGN_ENTRY_KINDS = new Set([
  'note',
  'npc',
  'location',
  'faction',
  'quest',
  'lore',
  'clue',
]);

function campaignObjectType(kind: string): PrepDependencyObjectType {
  if (CAMPAIGN_ENTRY_KINDS.has(kind)) {
    return 'campaign-entry';
  }
  if (kind === 'scene-template') {
    return 'scene-template';
  }
  if (kind === 'campaign-map') {
    return 'campaign-map';
  }
  return 'session-plan';
}

export class CampaignPrepDependencyResolver
  implements PrepDependencyResolver
{
  constructor(
    private readonly options: CampaignPrepDependencyResolverOptions,
  ) {}

  async resolve(
    reference: CampaignObjectRef,
    context: PrepDependencyResolutionContext,
  ): Promise<PrepDependencyResolution> {
    switch (reference.target) {
      case 'campaign-object':
        return this.resolveCampaignObject(reference);
      case 'definition':
        return this.resolveDefinition(reference, context);
      case 'asset':
        return this.resolveAsset(reference.assetId, context.principalId);
      case 'rules-entity':
        return this.resolveRulesEntity(reference);
      case 'document':
        return this.resolveDocument(reference.documentId, context);
    }
  }

  private async resolveCampaignObject(
    reference: Extract<CampaignObjectRef, { target: 'campaign-object' }>,
  ): Promise<PrepDependencyResolution> {
    const object = await this.options.campaignPrep.getObject(
      reference.campaignId,
      reference.id,
    );
    if (!object || object.status === 'archived') {
      return { status: 'missing' };
    }

    const revision = await this.options.campaignPrep.getRevision(
      reference.id,
      reference.revision,
    );
    if (!revision) {
      return { status: 'missing' };
    }

    return {
      status: 'available',
      objectType: campaignObjectType(object.kind),
    };
  }

  private async resolveDefinition(
    reference: Extract<CampaignObjectRef, { target: 'definition' }>,
    context: PrepDependencyResolutionContext,
  ): Promise<PrepDependencyResolution> {
    const object = await this.options.libraryObjects.getObjectById(
      reference.ref.id,
    );
    if (!object || object.isArchived || object.kind !== reference.ref.kind) {
      return { status: 'missing' };
    }
    if (
      object.ownerId !== context.principalId &&
      object.campaignId !== context.campaignId
    ) {
      return { status: 'forbidden' };
    }

    const revision = await this.options.libraryObjects.getRevision(
      reference.ref.id,
      reference.ref.revision,
    );
    return revision
      ? { status: 'available', objectType: 'definition' }
      : { status: 'missing' };
  }

  private async resolveAsset(
    assetId: string,
    principalId: string,
  ): Promise<PrepDependencyResolution> {
    const manifest = this.options.getAssetManifest();
    if (!manifest) {
      return { status: 'unavailable' };
    }
    if (manifest.assets.some((asset) => asset.id === assetId)) {
      return { status: 'available', objectType: 'asset' };
    }
    if (!this.options.userAssetCatalog) {
      return { status: 'missing' };
    }
    const resolution = await this.options.userAssetCatalog.resolveAsset(
      principalId,
      assetId,
    );
    return this.mapUserAssetResolution(resolution);
  }

  private mapUserAssetResolution(
    resolution: UserAssetResolution,
  ): PrepDependencyResolution {
    if (resolution === 'available') {
      return { status: 'available', objectType: 'asset' };
    }
    return { status: resolution };
  }

  private async resolveRulesEntity(
    reference: Extract<CampaignObjectRef, { target: 'rules-entity' }>,
  ): Promise<PrepDependencyResolution> {
    if (!this.options.rulesCatalog) {
      return { status: 'unavailable' };
    }

    try {
      const result = await this.options.rulesCatalog.fetchEntities(
        {
          type: reference.entityType,
          ruleset: reference.ruleset,
          since: 0,
        },
        null,
      );
      if (
        result.status !== 200 ||
        result.body.catalogVersion < reference.catalogVersion
      ) {
        return { status: 'unavailable' };
      }
      const exists = result.body.entities.some(
        (entity) =>
          entity.entityType === reference.entityType &&
          entity.ruleset === reference.ruleset &&
          entity.slug === reference.slug,
      );
      return exists
        ? { status: 'available', objectType: 'rules-entity' }
        : { status: 'missing' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  private async resolveDocument(
    documentId: string,
    context: PrepDependencyResolutionContext,
  ): Promise<PrepDependencyResolution> {
    if (!this.options.documentClient) {
      return { status: 'unavailable' };
    }

    try {
      const document = await this.options.documentClient.getDocument(documentId);
      const canAccess =
        document.isPublic ||
        document.uploadedBy === context.principalId ||
        document.campaigns.includes(context.campaignId);
      return canAccess
        ? { status: 'available', objectType: 'document' }
        : { status: 'forbidden' };
    } catch {
      return { status: 'unavailable' };
    }
  }
}
