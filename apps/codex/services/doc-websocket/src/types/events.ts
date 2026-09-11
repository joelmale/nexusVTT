import { z } from 'zod';

// Incoming event types (Client → Server)
export enum IncomingEventType {
  // Session Management
  SESSION_CREATE = 'doc:session:create',
  SESSION_JOIN = 'doc:session:join',
  SESSION_LEAVE = 'doc:session:leave',
  SESSION_UPDATE_SETTINGS = 'doc:session:update-settings',

  // Navigation Sync
  PAGE_CHANGE = 'doc:page:change',
  SCROLL_SYNC = 'doc:scroll:sync',

  // DM Push Features
  PUSH_PAGE = 'doc:push:page',
  PUSH_REFERENCE = 'doc:push:reference',

  // VTT integration
  VTT_REGISTER = 'vtt:register',
  VTT_ENTITY_PUSH = 'vtt:entity:push',
  VTT_STATE_UPDATE = 'vtt:state:update',

  // Annotation Real-time Sync
  ANNOTATION_CREATE = 'doc:annotation:create',
  ANNOTATION_UPDATE = 'doc:annotation:update',
  ANNOTATION_DELETE = 'doc:annotation:delete',
}

// Outgoing event types (Server → Client)
export enum OutgoingEventType {
  // Session Events
  SESSION_CREATED = 'session:created',
  SESSION_JOINED = 'session:joined',
  SESSION_LEFT = 'session:left',
  SESSION_UPDATED = 'session:updated',

  // Navigation Events
  PAGE_CHANGED = 'page:changed',
  SCROLL_SYNCED = 'scroll:synced',

  // Push Events
  PAGE_PUSHED = 'page:pushed',
  REFERENCE_PUSHED = 'reference:pushed',

  // VTT Events
  VTT_REGISTERED = 'vtt:registered',
  VTT_ENTITY_PUSHED = 'vtt:entity:pushed',
  VTT_STATE_UPDATED = 'vtt:state:updated',

  // Annotation Events
  ANNOTATION_CREATED = 'annotation:created',
  ANNOTATION_UPDATED = 'annotation:updated',
  ANNOTATION_DELETED = 'annotation:deleted',

  // Error Events
  ERROR = 'error',
}

// Event payload schemas
export const SessionCreatePayloadSchema = z.object({
  documentId: z.string().uuid(),
  campaignId: z.string(),
  roomCode: z.string(),
  presenter: z.string(),
  syncSettings: z
    .object({
      syncScroll: z.boolean().default(true),
      syncPage: z.boolean().default(true),
      syncHighlight: z.boolean().default(true),
    })
    .optional(),
});

export const SessionJoinPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string(),
});

export const SessionLeavePayloadSchema = z.object({
  sessionId: z.string().uuid(),
});

export const SessionUpdateSettingsPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  syncSettings: z.object({
    syncScroll: z.boolean().optional(),
    syncPage: z.boolean().optional(),
    syncHighlight: z.boolean().optional(),
  }),
});

export const PageChangePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  page: z.number().int().positive(),
});

export const ScrollSyncPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  position: z.number(),
});

export const PushPagePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  page: z.number().int().positive(),
});

export const PushReferencePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  referenceId: z.string().uuid(),
});

export const VttEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  system: z.string(),
  data: z.unknown(),
  source: z.object({
    documentId: z.string().uuid(),
    entityId: z.string().uuid(),
  }),
});

export const VttRegisterPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string(),
  vtt: z.object({
    name: z.string(),
    version: z.string().optional(),
  }),
});

export const VttEntityPushPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string(),
  entity: VttEntitySchema,
});

export const VttStateUpdatePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string(),
  status: z.string(),
});

export const AnnotationCreatePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  annotation: z.object({
    documentId: z.string().uuid(),
    referenceId: z.string().uuid().optional(),
    userId: z.string(),
    campaignId: z.string().optional(),
    pageNumber: z.number().int().positive(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
    type: z.enum(['highlight', 'note', 'drawing']),
    content: z.string(),
    color: z.string().default('#FFFF00'),
    isShared: z.boolean().default(false),
  }),
});

export const AnnotationUpdatePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  annotationId: z.string().uuid(),
  updates: z.object({
    content: z.string().optional(),
    color: z.string().optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
    }).optional(),
    isShared: z.boolean().optional(),
  }),
});

export const AnnotationDeletePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  annotationId: z.string().uuid(),
});

// Generic WebSocket message structure
export const WSMessageSchema = z.object({
  type: z.string(),
  data: z.unknown(),
});

export type WSMessage = z.infer<typeof WSMessageSchema>;

// Type exports
export type SessionCreatePayload = z.infer<typeof SessionCreatePayloadSchema>;
export type SessionJoinPayload = z.infer<typeof SessionJoinPayloadSchema>;
export type SessionLeavePayload = z.infer<typeof SessionLeavePayloadSchema>;
export type SessionUpdateSettingsPayload = z.infer<typeof SessionUpdateSettingsPayloadSchema>;
export type PageChangePayload = z.infer<typeof PageChangePayloadSchema>;
export type ScrollSyncPayload = z.infer<typeof ScrollSyncPayloadSchema>;
export type PushPagePayload = z.infer<typeof PushPagePayloadSchema>;
export type PushReferencePayload = z.infer<typeof PushReferencePayloadSchema>;
export type VttRegisterPayload = z.infer<typeof VttRegisterPayloadSchema>;
export type VttEntityPushPayload = z.infer<typeof VttEntityPushPayloadSchema>;
export type VttStateUpdatePayload = z.infer<typeof VttStateUpdatePayloadSchema>;
export type AnnotationCreatePayload = z.infer<typeof AnnotationCreatePayloadSchema>;
export type AnnotationUpdatePayload = z.infer<typeof AnnotationUpdatePayloadSchema>;
export type AnnotationDeletePayload = z.infer<typeof AnnotationDeletePayloadSchema>;
