/**
 * Validates that the database connection URL targets a safe test database.
 * This prevents accidental execution of integration tests (which truncate/drop tables)
 * against production or local development databases.
 */
export function assertTestDatabase(): void {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    // If there's no DB URL, the connection will fail anyway, but we log a warning.
    console.warn('assertTestDatabase: No DATABASE_URL defined.');
    return;
  }

  // Parse the connection string to check the database name.
  //
  // The parse and the safety check are deliberately separate: wrapping both in
  // one try/catch meant a perfectly well-formed URL pointing at a PRODUCTION
  // database was reported as "Invalid DATABASE_URL format", hiding the actual
  // reason the run was refused.
  let url: URL;
  try {
    url = new URL(dbUrl);
  } catch {
    throw new Error(`assertTestDatabase: Invalid DATABASE_URL format: ${dbUrl}`);
  }

  const dbName = url.pathname.replace(/^\//, '');
  const isTestDb = /(^|[_-])test(db)?$/i.test(dbName);
  if (!isTestDb) {
    throw new Error(
      `assertTestDatabase: DATABASE_URL "${dbUrl}" (database: "${dbName}") ` +
      `does not appear to be a test database. Refusing to run tests to prevent data loss. ` +
      `The database name must be exactly 'test'/'testdb', or end with a ` +
      `'_'- or '-'-separated 'test'/'testdb' suffix (e.g. 'nexus_test', ` +
      `'nexus-testdb'). A run-together name such as 'nexustestdb' is rejected.`
    );
  }
}
