import { describe, expect, it } from 'vitest';
import { DocumentSessionSchema, SyncSettingsSchema } from './session';
import { SessionJoinPayloadSchema } from './events';

// Behaviors that differ between zod 3 and 4 and that the socket layer relies on.
describe('zod 4 compatibility', () => {
  it('applies defaults for omitted sync settings', () => {
    expect(SyncSettingsSchema.parse({})).toEqual({
      syncScroll: true,
      syncPage: true,
      syncHighlight: true,
    });
  });

  it('applies defaults for omitted session fields and accepts non-RFC-4122 ids', () => {
    const parsed = DocumentSessionSchema.parse({
      sessionId: '00000000-0000-0000-0000-000000000001',
      documentId: '00000000-0000-0000-0000-000000000002',
      campaignId: 'c',
      roomCode: 'ABCD',
      presenter: 'dm',
      syncSettings: {},
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    });
    expect(parsed.currentPage).toBe(1);
    expect(parsed.viewers).toEqual([]);
  });

  it('rejects malformed ids', () => {
    expect(
      SessionJoinPayloadSchema.safeParse({ sessionId: 'nope' }).success,
    ).toBe(false);
  });
});
