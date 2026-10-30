import type { Edition } from './types';

/**
 * Edition a host should open the creator in when no saved draft decides it.
 * 2024 is the only forward-facing edition; 2014 stays reachable for testing
 * through `?edition=2014`. Anything else falls back to 2024.
 */
export function resolveRequestedEdition(search: string): Edition {
  return new URLSearchParams(search).get('edition') === '2014'
    ? '2014'
    : '2024';
}
