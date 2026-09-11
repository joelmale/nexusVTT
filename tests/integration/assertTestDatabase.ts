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

  // Parse the connection string to check the database name
  let dbName = '';
  try {
    const url = new URL(dbUrl);
    dbName = url.pathname.replace(/^\//, '');
  } catch (error) {
    throw new Error(`assertTestDatabase: Invalid DATABASE_URL format: ${dbUrl}`);
  }

  // Require the database name to end with test or testdb
  const isTestDb = /(^|[_-])test(db)?$/i.test(dbName);
  
  if (!isTestDb) {
    throw new Error(
      `assertTestDatabase: DATABASE_URL "${dbUrl}" (database: "${dbName}") ` +
      `does not appear to be a test database. Refusing to run tests to prevent data loss. ` +
      `Database name must end with 'test' or 'testdb'.`
    );
  }
}
