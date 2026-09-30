import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Query-string state for filters, sort, tabs and tree expansion. */
export function useSectionQuery() {
  const [params, setParams] = useSearchParams();

  const get = useCallback(
    (key: string): string => params.get(key) ?? '',
    [params],
  );

  const set = useCallback(
    (key: string, value: string | undefined) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { params, get, set, search: params.toString() };
}
