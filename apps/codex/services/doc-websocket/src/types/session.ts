import { z } from 'zod';

export const SyncSettingsSchema = z.object({
  syncScroll: z.boolean().default(true),
  syncPage: z.boolean().default(true),
  syncHighlight: z.boolean().default(true),
});

export const DocumentSessionSchema = z.object({
  sessionId: z.string().uuid(),
  documentId: z.string().uuid(),
  campaignId: z.string(),
  roomCode: z.string(),
  presenter: z.string(), // DM user ID
  viewers: z.array(z.string()).default([]),
  currentPage: z.number().int().positive().default(1),
  scrollPosition: z.number().default(0),
  activeHighlights: z.array(z.string()).default([]),
  syncSettings: SyncSettingsSchema,
  startedAt: z.string(), // ISO timestamp
  lastActivity: z.string(), // ISO timestamp
});

export type DocumentSession = z.infer<typeof DocumentSessionSchema>;
export type SyncSettings = z.infer<typeof SyncSettingsSchema>;

// Helper type for creating sessions
export const CreateSessionSchema = z.object({
  documentId: z.string().uuid(),
  campaignId: z.string(),
  roomCode: z.string(),
  presenter: z.string(),
  syncSettings: SyncSettingsSchema.optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

// Helper type for updating session settings
export const UpdateSessionSettingsSchema = z.object({
  syncSettings: SyncSettingsSchema.partial(),
});

export type UpdateSessionSettingsInput = z.infer<typeof UpdateSessionSettingsSchema>;
