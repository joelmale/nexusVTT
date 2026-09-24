import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CreateRulesEntityRequestSchema,
  RulesEntityListQuerySchema,
  RulesRollbackRequestSchema,
  RulesTransitionRequestSchema,
  SaveRulesDraftRequestSchema,
} from '@nexus/rules-contracts';
import { prisma } from '../../services/database.service';
import { RulesRegistryService } from '../../services/rules/rules-registry.service';
import {
  createServiceTokenGuard,
  expectedRevision,
  requireActor,
  revisionEtag,
  sendRulesError,
  serviceTokenRequired,
} from './http';

export interface RulesAdminRoutesOptions {
  service?: RulesRegistryService;
  /**
   * Defaults to RULES_ADMIN_SERVICE_TOKEN. When unset, production refuses
   * every admin route with 503; elsewhere the check is disabled.
   */
  serviceToken?: string;
  /** Overrides the NODE_ENV-based default for refusing requests without a token. */
  requireServiceToken?: boolean;
}

const IdParams = z.object({ id: z.string().uuid() });
const RevisionParams = IdParams.extend({ revisionNumber: z.coerce.number().int().min(1) });
const PreviewQuery = z.object({ revision: z.coerce.number().int().min(1).optional() }).strict();
const DiffQuery = z
  .object({ from: z.coerce.number().int().min(1), to: z.coerce.number().int().min(1) })
  .strict();
const OptionalBody = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((body) => body ?? {}, schema) as unknown as T;

/**
 * Internal rules-authoring API. Called only by the control-api, which
 * authenticates the administrator and forwards the actor ID in
 * `X-Nexus-Actor`. Browsers never reach doc-api directly.
 */
export async function rulesAdminRoutes(fastify: FastifyInstance, options: RulesAdminRoutesOptions = {}) {
  const service = options.service ?? new RulesRegistryService(prisma);
  const token = options.serviceToken ?? process.env.RULES_ADMIN_SERVICE_TOKEN;
  const guardOptions = { requireToken: options.requireServiceToken };
  if (!token && serviceTokenRequired(guardOptions)) {
    fastify.log.error('RULES_ADMIN_SERVICE_TOKEN is not set; rules admin routes will refuse every request (503)');
  }
  const guard = createServiceTokenGuard(token, guardOptions);

  fastify.addHook('onRequest', guard);
  fastify.setErrorHandler((error, request, reply) => sendRulesError(request, reply, error));

  fastify.get('/api/admin/rules/entities', async (request) => {
    const query = RulesEntityListQuerySchema.parse(request.query);
    return service.listEntities(query);
  });

  fastify.post('/api/admin/rules/entities', async (request, reply) => {
    const actor = requireActor(request);
    const body = CreateRulesEntityRequestSchema.parse(request.body);
    const entity = await service.createEntity(body, actor);
    return reply.status(201).header('etag', revisionEtag(entity.headRevisionNumber)).send(entity);
  });

  fastify.get('/api/admin/rules/entities/:id', async (request, reply) => {
    const { id } = IdParams.parse(request.params);
    const entity = await service.getEntity(id);
    return reply.header('etag', revisionEtag(entity.headRevisionNumber)).send(entity);
  });

  fastify.get('/api/admin/rules/entities/:id/revisions/:revisionNumber', async (request) => {
    const { id, revisionNumber } = RevisionParams.parse(request.params);
    return service.getRevision(id, revisionNumber);
  });

  fastify.put('/api/admin/rules/entities/:id/draft', async (request, reply) => {
    const actor = requireActor(request);
    const { id } = IdParams.parse(request.params);
    const body = SaveRulesDraftRequestSchema.parse(request.body);
    const expected = expectedRevision(request, body.expectedRevisionNumber, true) as number;
    const entity = await service.saveDraft(id, expected, body, actor);
    return reply.header('etag', revisionEtag(entity.headRevisionNumber)).send(entity);
  });

  fastify.post('/api/admin/rules/entities/:id/validate', async (request, reply) => {
    const actor = requireActor(request);
    const { id } = IdParams.parse(request.params);
    const body = OptionalBody(RulesTransitionRequestSchema).parse(request.body);
    const expected = expectedRevision(request, body.expectedRevisionNumber, true) as number;
    const result = await service.validate(id, expected, actor);
    return reply.header('etag', revisionEtag(result.entity.headRevisionNumber)).send(result);
  });

  fastify.get('/api/admin/rules/entities/:id/preview', async (request) => {
    const { id } = IdParams.parse(request.params);
    const { revision } = PreviewQuery.parse(request.query);
    return service.preview(id, revision);
  });

  fastify.post('/api/admin/rules/entities/:id/publish', async (request, reply) => {
    const actor = requireActor(request);
    const { id } = IdParams.parse(request.params);
    const body = OptionalBody(RulesTransitionRequestSchema).parse(request.body);
    const expected = expectedRevision(request, body.expectedRevisionNumber, true) as number;
    const result = await service.publish(id, expected, actor);
    return reply.header('etag', revisionEtag(result.entity.headRevisionNumber)).send(result);
  });

  fastify.post('/api/admin/rules/entities/:id/rollback', async (request, reply) => {
    const actor = requireActor(request);
    const { id } = IdParams.parse(request.params);
    const body = RulesRollbackRequestSchema.parse(request.body);
    const expected = expectedRevision(request, body.expectedRevisionNumber, true) as number;
    const result = await service.rollback(id, expected, body.targetRevisionNumber, actor);
    return reply.header('etag', revisionEtag(result.entity.headRevisionNumber)).send(result);
  });

  fastify.get('/api/admin/rules/entities/:id/diff', async (request) => {
    const { id } = IdParams.parse(request.params);
    const { from, to } = DiffQuery.parse(request.query);
    return service.diff(id, from, to);
  });

  for (const [action, archived] of [
    ['archive', true],
    ['unarchive', false],
  ] as const) {
    fastify.post(`/api/admin/rules/entities/:id/${action}`, async (request, reply) => {
      const actor = requireActor(request);
      const { id } = IdParams.parse(request.params);
      const body = OptionalBody(RulesTransitionRequestSchema).parse(request.body);
      const expected = expectedRevision(request, body.expectedRevisionNumber, false);
      const entity = await service.setArchived(id, archived, expected, actor);
      return reply.header('etag', revisionEtag(entity.headRevisionNumber)).send(entity);
    });
  }
}
