import { z } from 'zod';

/**
 * Result outcome of an executed domain command
 */
export const commandExecutionResultSchema = z.object({
  success: z.boolean(),
  committedVersions: z.record(z.string().uuid(), z.number().int().nonnegative()),
  roomStateVersion: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  data: z.unknown().optional(),
});
export type CommandExecutionResult = z.infer<typeof commandExecutionResultSchema>;

/**
 * Idempotent Command Receipt stored in domain_command_receipts
 */
export const domainCommandReceiptSchema = z.object({
  commandId: z.string().uuid(),
  principalId: z.string().min(1),
  campaignId: z.string().uuid(),
  payloadHash: z.string().min(1),
  committedAt: z.string().datetime(),
  result: commandExecutionResultSchema,
});
export type DomainCommandReceipt = z.infer<typeof domainCommandReceiptSchema>;
