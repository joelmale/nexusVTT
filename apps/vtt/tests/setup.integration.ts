/**
 * @file tests/setup.integration.ts
 * @description Extra setup applied ONLY to tests/integration.
 *
 * Integration suites truncate and drop tables, so they must never be pointed
 * at a development or production database. This guard is scoped to them rather
 * than to the global setup: unit tests never open a connection, so asserting
 * there produced noise without protection.
 */

import { beforeAll } from 'vitest';
import { assertTestDatabase } from './integration/assertTestDatabase';

beforeAll(() => {
  assertTestDatabase();
});
