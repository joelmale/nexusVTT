import { prisma } from './database.service';

export type VttEntityPayload = {
  id: string;
  name: string;
  type: string;
  system: string;
  data: any;
  source: {
    documentId: string;
    entityId: string;
  };
};

export class VttService {
  async buildEntity(entityId: string, format: string = 'generic'): Promise<VttEntityPayload | null> {
    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) return null;

    const structured = await prisma.structuredData.findFirst({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
    });

    if (!structured) return null;

    const basePayload: VttEntityPayload = {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      system: format === 'foundry' ? 'dnd5e' : 'generic',
      data: structured.data,
      source: {
        documentId: structured.documentId,
        entityId: entity.id,
      },
    };

    if (format === 'foundry') {
      return {
        ...basePayload,
        data: {
          name: entity.name,
          type: entity.type,
          system: structured.data,
        },
      };
    }

    return basePayload;
  }
}

export const vttService = new VttService();
