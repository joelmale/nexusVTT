import { describe, expect, test, vi } from 'vitest';

import {
  blockedProtectedUpdates,
  parsePushUpdates,
  runProtectedPushCheck,
} from './protected-push.mjs';

const SHA = '1'.repeat(40);
const REMOTE_SHA = '2'.repeat(40);

describe('protected push guard', () => {
  test('parses Git pre-push updates and allows feature branches', () => {
    const updates = parsePushUpdates(
      `refs/heads/feature ${SHA} refs/heads/feature ${REMOTE_SHA}\n`,
    );
    expect(blockedProtectedUpdates(updates)).toEqual([]);
    expect(
      runProtectedPushCheck(
        `refs/heads/feature ${SHA} refs/heads/feature ${REMOTE_SHA}\n`,
      ),
    ).toBe(0);
  });

  test('blocks main updates but permits branch deletion', () => {
    const error = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    expect(
      runProtectedPushCheck(
        `refs/heads/main ${SHA} refs/heads/main ${REMOTE_SHA}\n`,
      ),
    ).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('pull request'));
    expect(
      runProtectedPushCheck(
        `(delete) ${'0'.repeat(40)} refs/heads/main ${REMOTE_SHA}\n`,
      ),
    ).toBe(0);
    error.mockRestore();
  });

  test('requires an explicit emergency override', () => {
    const error = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    expect(
      runProtectedPushCheck(
        `refs/heads/main ${SHA} refs/heads/main ${REMOTE_SHA}\n`,
        { ALLOW_PROTECTED_BRANCH_PUSH: '1' },
      ),
    ).toBe(0);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Emergency'));
    error.mockRestore();
  });

  test('rejects malformed hook input', () => {
    expect(() => parsePushUpdates('not enough fields')).toThrow(
      'invalid pre-push update',
    );
  });
});
