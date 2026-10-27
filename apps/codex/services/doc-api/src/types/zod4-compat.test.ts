import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AdminListDocumentsQuerySchema } from './admin';
import { CreateAnnotationSchema } from './annotation';
import { StructuredDataSchema } from './structured-data';

// Behaviors that changed between zod 3 and 4 and that the API relies on.
describe('zod 4 compatibility', () => {
  const annotation = {
    documentId: '00000000-0000-0000-0000-000000000001',
    userId: 'u1',
    pageNumber: 1,
    position: { x: 0, y: 0, width: 1, height: 1 },
    type: 'note',
    content: 'hi',
  };

  it('keeps accepting non-RFC-4122 ids that zod 3 accepted', () => {
    const result = CreateAnnotationSchema.safeParse(annotation);
    expect(result.success).toBe(true);
  });

  it('applies defaults for omitted fields', () => {
    const parsed = CreateAnnotationSchema.parse(annotation);
    expect(parsed.color).toBe('#FFFF00');
    expect(parsed.isShared).toBe(false);
  });

  it('exposes validation failures through issues (ZodError.errors was removed)', () => {
    const result = CreateAnnotationSchema.safeParse({
      ...annotation,
      documentId: 'nope',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.name).toBe('ZodError');
      expect(result.error.issues[0].path).toEqual(['documentId']);
      expect(
        (result.error as unknown as { errors?: unknown }).errors,
      ).toBeUndefined();
    }
  });

  it('coerces default-then-transform query values', () => {
    const parsed = AdminListDocumentsQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(50);
  });

  it('accepts a free-form JSON object for structured data', () => {
    const now = new Date();
    const parsed = StructuredDataSchema.parse({
      id: '11111111-1111-1111-1111-111111111111',
      documentId: '22222222-2222-2222-2222-222222222222',
      type: 'spell',
      pageNumber: 3,
      section: null,
      name: 'Fireball',
      data: { level: 3, nested: { a: 1 } },
      searchText: 'fireball',
      searchIndex: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.data).toEqual({ level: 3, nested: { a: 1 } });
    expect(z.record(z.string(), z.unknown()).safeParse([]).success).toBe(false);
  });
});
