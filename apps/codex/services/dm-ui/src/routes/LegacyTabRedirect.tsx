import { Navigate, useLocation } from 'react-router-dom';

/**
 * `/notes/:id` and `/handouts/:id` (under either campaign prefix) redirect into
 * the matching Lore tab: `/lore/notes/:id`, `/lore/handouts/:id`.
 */
export function LegacyTabRedirect({ tab }: { tab: 'notes' | 'handouts' }) {
  const { pathname, search } = useLocation();
  const target = pathname.replace(new RegExp(`/${tab}(?=/|$)`), `/lore/${tab}`);
  return <Navigate replace to={`${target}${search}`} />;
}
