import { PostgresSearchProvider } from './postgres-provider';

export type { SearchProvider, SearchResult } from './types';

/** Document search runs on Postgres full-text search. */
export const searchProvider = new PostgresSearchProvider();
