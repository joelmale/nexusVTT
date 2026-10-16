import { beforeEach, describe, expect, it, vi } from 'vitest';

const metrics = vi.hoisted(() => ({
  shadowTotal: { inc: vi.fn() },
  shadowOverlap: { observe: vi.fn() },
}));

vi.mock('../../../observability/metrics', () => ({
  searchShadowTotal: metrics.shadowTotal,
  searchShadowOverlap: metrics.shadowOverlap,
}));
vi.mock('../../elastic.service', () => ({ elasticService: { deleteDocument: vi.fn() } }));

import { SearchFacade } from '../facade';
import type { SearchProvider, SearchResult } from '../types';

const result = (...ids: string[]): SearchResult => ({
  total: ids.length,
  hits: ids.map((documentId) => ({ documentId, score: 1, source: {} })),
});

function stub(ids: string[] | Error): SearchProvider {
  const run = async () => {
    if (ids instanceof Error) throw ids;
    return result(...ids);
  };
  return {
    search: vi.fn(run),
    advancedSearch: vi.fn(run),
    searchWithinDocument: vi.fn(run),
    documentExists: vi.fn(async () => true),
  };
}

describe('SearchFacade', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses only Elasticsearch in elastic mode and only Postgres in postgres mode', async () => {
    const elastic = stub(['a']);
    const postgres = stub(['b']);

    expect((await new SearchFacade('elastic', elastic, postgres).search({ query: 'x' })).hits[0].documentId).toBe('a');
    expect((await new SearchFacade('postgres', elastic, postgres).search({ query: 'x' })).hits[0].documentId).toBe('b');
    expect(postgres.search).toHaveBeenCalledTimes(1);
    expect(elastic.search).toHaveBeenCalledTimes(1);
  });

  it('answers from Elasticsearch in both mode and records the overlap', async () => {
    const facade = new SearchFacade('both', stub(['a', 'b']), stub(['a', 'c']));
    const answer = await facade.search({ query: 'x' });

    expect(answer.hits.map((h) => h.documentId)).toEqual(['a', 'b']);
    expect(metrics.shadowTotal.inc).toHaveBeenCalledWith({ operation: 'search', result: 'diff' });
    expect(metrics.shadowOverlap.observe).toHaveBeenCalledWith({ operation: 'search' }, 0.5);
  });

  it('counts a perfect match', async () => {
    await new SearchFacade('both', stub(['a']), stub(['a'])).advancedSearch({ query: 'x' });
    expect(metrics.shadowTotal.inc).toHaveBeenCalledWith({ operation: 'advancedSearch', result: 'match' });
  });

  it('survives a failing Postgres shadow but not a failing Elasticsearch', async () => {
    const shadowFails = new SearchFacade('both', stub(['a']), stub(new Error('boom')));
    await expect(shadowFails.search({ query: 'x' })).resolves.toBeDefined();
    expect(metrics.shadowTotal.inc).toHaveBeenCalledWith({ operation: 'search', result: 'error' });

    const primaryFails = new SearchFacade('both', stub(new Error('es down')), stub(['a']));
    await expect(primaryFails.search({ query: 'x' })).rejects.toThrow('es down');
  });

  it('lets a request pick the engine only in both mode', async () => {
    const elastic = stub(['a']);
    const postgres = stub(['b']);

    const both = new SearchFacade('both', elastic, postgres);
    expect(both.forRequest('postgres')).toBe(postgres);
    expect(both.forRequest(['elastic'])).toBe(elastic);
    expect(both.forRequest('nonsense')).toBe(both);
    expect(both.forRequest(undefined)).toBe(both);

    const postgresOnly = new SearchFacade('postgres', elastic, postgres);
    expect(postgresOnly.forRequest('elastic')).toBe(postgresOnly);
  });

  it('writes to Elasticsearch unless running on Postgres alone', () => {
    expect(new SearchFacade('elastic', stub([]), stub([])).writesToElastic).toBe(true);
    expect(new SearchFacade('both', stub([]), stub([])).writesToElastic).toBe(true);
    expect(new SearchFacade('postgres', stub([]), stub([])).writesToElastic).toBe(false);
  });
});
