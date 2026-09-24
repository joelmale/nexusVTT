import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { RULES_ACTOR_HEADER } from '@nexus/rules-contracts';
import { RulesError } from '../../services/rules/rules-errors';

export const RULES_SERVICE_TOKEN_HEADER = 'x-nexus-service-token';

const MAX_ACTOR_LENGTH = 200;

/** Actor ID the control-api authenticated; mandatory on every mutation. */
export function requireActor(request: FastifyRequest): string {
  const raw = request.headers[RULES_ACTOR_HEADER];
  const actor = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!actor || actor.length > MAX_ACTOR_LENGTH) {
    throw new RulesError(401, 'actor_required', `${RULES_ACTOR_HEADER} header is required for rules mutations`);
  }
  return actor;
}

/** Parse `If-Match: "3"` / `W/"3"` / `3` into a revision number. */
export function parseIfMatch(header: string | undefined): number | undefined {
  if (header === undefined) return undefined;
  const match = /^\s*(?:W\/)?"?(\d+)"?\s*$/.exec(header);
  if (!match) throw new RulesError(400, 'bad_request', 'If-Match must be a revision number such as "3"');
  return Number(match[1]);
}

/**
 * Combine the body's `expectedRevisionNumber` with `If-Match`. When
 * `required`, one of them must be present so no mutation of an existing
 * entity can silently last-write-win.
 */
export function expectedRevision(
  request: FastifyRequest,
  fromBody: number | undefined,
  required: boolean,
): number | undefined {
  const fromHeader = parseIfMatch(request.headers['if-match']);
  if (fromHeader !== undefined && fromBody !== undefined && fromHeader !== fromBody) {
    throw new RulesError(400, 'bad_request', 'If-Match and expectedRevisionNumber disagree');
  }
  const expected = fromBody ?? fromHeader;
  if (required && expected === undefined) {
    throw new RulesError(400, 'bad_request', 'expectedRevisionNumber (or If-Match) is required');
  }
  return expected;
}

export function revisionEtag(revisionNumber: number): string {
  return `"${revisionNumber}"`;
}

/**
 * Optional shared-secret check for control-api -> doc-api calls. When no
 * token is configured the routes rely on doc-api's private network placement,
 * like the other `/api/admin/*` routes.
 */
export function createServiceTokenGuard(token: string | undefined) {
  const expected = token ? Buffer.from(token) : undefined;
  return async (request: FastifyRequest): Promise<void> => {
    if (!expected) return;
    const raw = request.headers[RULES_SERVICE_TOKEN_HEADER];
    const supplied = Buffer.from((Array.isArray(raw) ? raw[0] : raw) ?? '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new RulesError(401, 'service_token_invalid', 'service token missing or invalid');
    }
  };
}

export function sendRulesError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof RulesError) {
    return reply.status(error.statusCode).send(error.toResponse());
  }
  // Duck-typed: the contracts package may load a separate (CJS) zod instance.
  if (error instanceof ZodError || (error instanceof Error && error.name === 'ZodError' && 'issues' in error)) {
    const { issues } = error as ZodError;
    return reply.status(400).send({
      error: 'invalid request',
      code: 'bad_request',
      issues: issues.map((issue) => ({ path: issue.path, code: issue.code, message: issue.message })),
    });
  }
  const statusCode = (error as { statusCode?: unknown })?.statusCode;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    // Fastify's own client errors, e.g. a malformed JSON body.
    return reply.status(statusCode).send({ error: (error as Error).message, code: 'bad_request' });
  }
  request.log.error(error);
  return reply.status(500).send({ error: 'rules registry request failed' });
}
