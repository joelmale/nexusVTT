import type { FastifyInstance } from 'fastify';
import { rulesAdminRoutes } from './admin';
import { rulesCatalogRoutes } from './catalog';

export { rulesAdminRoutes } from './admin';
export { rulesCatalogRoutes } from './catalog';

/** Registers the rules registry. Each child plugin keeps its own error handler. */
export async function rulesRoutes(fastify: FastifyInstance) {
  await fastify.register(rulesAdminRoutes);
  await fastify.register(rulesCatalogRoutes);
}
