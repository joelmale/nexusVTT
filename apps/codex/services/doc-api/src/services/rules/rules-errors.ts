import type { RulesErrorResponse, RulesRevision, RulesValidationIssue } from '@nexus/rules-contracts';

/** A rules-registry failure that maps directly onto an HTTP response. */
export class RulesError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: RulesErrorResponse['code'],
    message: string,
    readonly extra: { issues?: RulesValidationIssue[]; current?: RulesRevision } = {},
  ) {
    super(message);
    this.name = 'RulesError';
  }

  toResponse(): RulesErrorResponse {
    return { error: this.message, code: this.code, ...this.extra };
  }
}

export const notFound = (what: string) => new RulesError(404, 'not_found', `${what} not found`);

export const revisionConflict = (current: RulesRevision, expected: number) =>
  new RulesError(
    409,
    'revision_conflict',
    `expected revision ${expected} but the entity head is revision ${current.revisionNumber}`,
    { current },
  );
