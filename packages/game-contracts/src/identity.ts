import { z } from 'zod';

/**
 * Supported definition kinds that can be authored and revisioned.
 */
export const definitionKindSchema = z.enum([
  'character',
  'monster',
  'encounter',
  'spell',
  'spell_collection',
  'item',
]);
export type DefinitionKind = z.infer<typeof definitionKindSchema>;

/**
 * Typed reference to an immutable revision of an authored definition.
 */
export const definitionRefSchema = z.object({
  kind: definitionKindSchema,
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
});
export type DefinitionRef<K extends DefinitionKind = DefinitionKind> = {
  kind: K;
  id: string;
  revision: number;
};

/**
 * Ruleset specification including system, edition, content pack, and revisions.
 */
export const rulesetRefSchema = z.object({
  system: z.literal('dnd5e'),
  edition: z.enum(['2014', '2024']),
  contentPackId: z.string().min(1),
  contentRevision: z.string().min(1),
  rulesRevision: z.string().min(1),
});
export type RulesetRef = z.infer<typeof rulesetRefSchema>;

/**
 * Standard metadata attached to all versioned authored records.
 */
export const authoredMetadataSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  ownerId: z.string().min(1),
  campaignId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  tags: z.array(z.string()).default([]),
  archived: z.boolean().default(false),
  provenance: z.string().optional(),
  portraitAssetRef: z.string().nullable().optional(),
  tokenAssetRef: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AuthoredMetadata = z.infer<typeof authoredMetadataSchema>;

/**
 * Explicit permissions for library visibility and campaign play.
 */
export const permissionRoleSchema = z.enum([
  'viewer',
  'controller',
  'editor',
  'owner',
]);
export type PermissionRole = z.infer<typeof permissionRoleSchema>;

export const permissionGrantSchema = z.object({
  principalId: z.string().min(1),
  role: permissionRoleSchema,
  grantedAt: z.string().datetime(),
});
export type PermissionGrant = z.infer<typeof permissionGrantSchema>;
