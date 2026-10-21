import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LLM_BACKENDS, LLM_MODES } from '@nexus/document-contracts';
import {
  SettingsKeyMissingError,
  checkDeepSeek,
  getLlmSettingsView,
  saveDeepSeekKey,
  saveLlmSettings,
} from '../../services/settings.service';

const routingBody = z
  .object({
    mode: z.enum(LLM_MODES).optional(),
    routes: z
      .object({
        monster: z.enum(LLM_BACKENDS).optional(),
        spell: z.enum(LLM_BACKENDS).optional(),
        item: z.enum(LLM_BACKENDS).optional(),
      })
      .strict()
      .optional(),
    deepseekModel: z.string().trim().min(1).max(100).nullable().optional(),
    deepseekMaxTokens: z.number().int().min(256).max(8192).nullable().optional(),
    /** Stamped by control-api from the session; the audit trail of who last changed it. */
    updatedBy: z.string().max(128).optional(),
  })
  .strict();

// A DeepSeek key is `sk-` plus hex/alphanumerics; accept any single token so a format change does not lock users out.
const keyBody = z
  .object({
    apiKey: z
      .string()
      .trim()
      .min(8)
      .max(256)
      .regex(/^\S+$/, 'The key must not contain spaces'),
    updatedBy: z.string().max(128).optional(),
  })
  .strict();

const invalid = (reply: FastifyReply, error: z.ZodError) =>
  reply.status(400).send({ error: 'Invalid settings', details: error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`) });

/**
 * Extraction LLM settings (admin console Settings page). Reached only through
 * control-api, which requires codex:settings, audits each change and, for the
 * key, a recent re-login. The API key is write-only: no response contains it.
 */
export async function adminSettingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/settings/llm', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send(await getLlmSettingsView());
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to load settings' });
    }
  });

  fastify.put('/api/admin/settings/llm', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = routingBody.safeParse(request.body ?? {});
    if (!parsed.success) return invalid(reply, parsed.error);
    try {
      const { updatedBy, ...patch } = parsed.data;
      return reply.send(await saveLlmSettings(patch, updatedBy ?? null));
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to save settings' });
    }
  });

  fastify.put('/api/admin/settings/llm/key', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = keyBody.safeParse(request.body ?? {});
    if (!parsed.success) return invalid(reply, parsed.error);
    try {
      return reply.send(await saveDeepSeekKey(parsed.data.apiKey, parsed.data.updatedBy ?? null));
    } catch (error: any) {
      if (error instanceof SettingsKeyMissingError) return reply.status(409).send({ error: error.message, code: 'settings_key_missing' });
      // Never include the request body (it holds the key) in logs or the reply.
      fastify.log.error({ err: { message: error?.message } }, 'Failed to save DeepSeek key');
      return reply.status(500).send({ error: 'Failed to save the key' });
    }
  });

  fastify.delete('/api/admin/settings/llm/key', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send(await saveDeepSeekKey(null, null));
    } catch (error: any) {
      fastify.log.error({ err: { message: error?.message } }, 'Failed to remove DeepSeek key');
      return reply.status(500).send({ error: 'Failed to remove the key' });
    }
  });

  fastify.post('/api/admin/settings/llm/test', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send(await checkDeepSeek());
    } catch (error: any) {
      fastify.log.error({ err: { message: error?.message } }, 'DeepSeek check failed');
      return reply.status(500).send({ error: 'Failed to run the check' });
    }
  });
}
