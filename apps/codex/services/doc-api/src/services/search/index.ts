import { env } from '../../config/env';
import { ElasticSearchProvider } from './elastic-provider';
import { SearchFacade } from './facade';
import { PostgresSearchProvider } from './postgres-provider';

export { SearchFacade } from './facade';
export type { SearchProvider, SearchProviderName, SearchResult } from './types';

export const searchProvider = new SearchFacade(
  env.SEARCH_PROVIDER,
  new ElasticSearchProvider(),
  new PostgresSearchProvider(),
);
