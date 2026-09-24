import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CatalogEntitiesQuerySchema } from '@nexus/rules-contracts';
import { prisma } from '../../services/database.service';
import {
  RulesCatalogService,
  entitiesEtag,
  manifestEtag,
} from '../../services/rules/rules-catalog.service';
import { sendRulesError } from './http';

export interface RulesCatalogRoutesOptions {
  service?: RulesCatalogService;
}

function etagMatches(request: FastifyRequest, etag: string): boolean {
  const header = request.headers['if-none-match'];
  if (!header) return false;
  return header
    .split(',')
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === '*' || candidate === etag);
}

/**
 * Read-only published catalog. The normal authenticated VTT/Forge backends
 * proxy and cache this; drafts and unpublished revisions are never exposed.
 */
export async function rulesCatalogRoutes(fastify: FastifyInstance, options: RulesCatalogRoutesOptions = {}) {
  const service = options.service ?? new RulesCatalogService(prisma);

  fastify.setErrorHandler((error, request, reply) => sendRulesError(request, reply, error));

  fastify.get('/api/rules/catalog/manifest', async (request, reply) => {
    const manifest = await service.manifest();
    const etag = manifestEtag(manifest.catalogVersion);
    reply.header('etag', etag).header('cache-control', 'no-cache');
    if (etagMatches(request, etag)) return reply.status(304).send();
    return reply.send(manifest);
  });

  fastify.get('/api/rules/catalog/entities', async (request, reply) => {
    const query = CatalogEntitiesQuerySchema.parse(request.query);
    const result = await service.entities(query);
    const etag = entitiesEtag(result.catalogVersion, query);
    reply.header('etag', etag).header('cache-control', 'no-cache');
    if (etagMatches(request, etag)) return reply.status(304).send();
    return reply.send(result);
  });
}
