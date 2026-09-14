import { prisma } from './database.service';
import { StructuredDataType } from '@prisma/client';

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

export class EntityResolverService {
  async resolveEntity(params: {
    name: string;
    type: StructuredDataType;
    sourceDocumentId?: string;
  }): Promise<string> {
    const normalized = normalizeName(params.name);

    const aliasMatch = await prisma.entityAlias.findFirst({
      where: {
        entityType: params.type,
        normalizedAlias: normalized,
      },
      select: { entityId: true },
    });

    if (aliasMatch?.entityId) {
      return aliasMatch.entityId;
    }

    const entityMatch = await prisma.entity.findFirst({
      where: {
        type: params.type,
        normalizedName: normalized,
      },
      select: { id: true },
    });

    if (entityMatch?.id) {
      await prisma.entityAlias.create({
        data: {
          entityId: entityMatch.id,
          entityType: params.type,
          alias: params.name,
          normalizedAlias: normalized,
          sourceDocumentId: params.sourceDocumentId,
        },
      }).catch(() => {});

      return entityMatch.id;
    }

    const entity = await prisma.entity.create({
      data: {
        name: params.name,
        type: params.type,
        normalizedName: normalized,
        metadata: {},
      },
    });

    await prisma.entityAlias.create({
      data: {
        entityId: entity.id,
        entityType: params.type,
        alias: params.name,
        normalizedAlias: normalized,
        sourceDocumentId: params.sourceDocumentId,
      },
    });

    return entity.id;
  }
}

export const entityResolverService = new EntityResolverService();
