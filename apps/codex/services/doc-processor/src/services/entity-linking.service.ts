import { prisma } from './database.service';

export class EntityLinkingService {
  async linkSpellMentions(params: {
    documentId: string;
    monsters: Array<{ entityId: string; rawSnippet: string }>;
  }) {
    if (params.monsters.length === 0) return;

    const aliases = await prisma.entityAlias.findMany({
      where: { entityType: 'spell' },
      select: { entityId: true, alias: true, normalizedAlias: true },
    });

    if (aliases.length === 0) return;

    const mentions: Array<{
      documentId: string;
      sourceEntityId: string;
      mentionText: string;
      context: string;
      targetType: 'spell';
      resolvedEntityId: string;
      confidence: number;
    }> = [];

    const links: Array<{
      sourceEntityId: string;
      targetEntityId: string;
      type: 'uses';
      confidence: number;
      metadata: any;
    }> = [];

    params.monsters.forEach((monster) => {
      const snippet = monster.rawSnippet.toLowerCase();
      aliases.forEach((alias) => {
        if (alias.normalizedAlias.length < 3) return;
        if (!snippet.includes(alias.normalizedAlias)) return;

        mentions.push({
          documentId: params.documentId,
          sourceEntityId: monster.entityId,
          mentionText: alias.alias,
          context: monster.rawSnippet.slice(0, 500),
          targetType: 'spell',
          resolvedEntityId: alias.entityId,
          confidence: 0.7,
        });

        links.push({
          sourceEntityId: monster.entityId,
          targetEntityId: alias.entityId,
          type: 'uses',
          confidence: 0.7,
          metadata: { source: 'spell_mention' },
        });
      });
    });

    if (mentions.length > 0) {
      await prisma.entityMention.createMany({ data: mentions });
    }
    if (links.length > 0) {
      await prisma.entityLink.createMany({ data: links, skipDuplicates: true });
    }
  }
}

export const entityLinkingService = new EntityLinkingService();
