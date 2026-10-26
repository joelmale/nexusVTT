import { createHash } from 'node:crypto';

// Server reconciliation may replace these fields after a successful save.
const SERVER_METADATA = new Set([
  'id',
  'legacyId',
  'createdAt',
  'updatedAt',
  'playerId',
  'version',
]);

function stableCharacterInput(
  value: unknown,
  omitServerMetadata = false,
): unknown {
  if (Array.isArray(value))
    return value.map((field) => stableCharacterInput(field));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key, field]) =>
          !(omitServerMetadata && SERVER_METADATA.has(key)) &&
          field !== undefined,
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, field]) => [key, stableCharacterInput(field)]),
  );
}

export function characterCreationPayloadHash(
  name: string,
  data: unknown,
  draftRevision: number,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        name: name.trim(),
        data: stableCharacterInput(data, true),
        draftRevision,
      }),
    )
    .digest('hex');
}

export class CharacterCreationConflictError extends Error {
  constructor(
    message = 'This creation attempt was already used for a different character revision.',
  ) {
    super(message);
    this.name = 'CharacterCreationConflictError';
  }
}
