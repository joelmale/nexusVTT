import { Navigate, useLocation } from 'react-router-dom';

/**
 * Old Lore/Handouts URLs (under either campaign prefix) redirect to Notes:
 * `/lore`, `/lore/notes/:id`, `/lore/handouts/:id`, `/lore/:id` and
 * `/handouts/:id` all become `/notes[/:id]`.
 */
export function LegacyLoreRedirect() {
  const { pathname, search } = useLocation();
  const match = /^(.*?)\/(?:lore|handouts)(?:\/(.*))?$/.exec(pathname);
  const base = match?.[1] ?? '';
  const rest = (match?.[2] ?? '').split('/').filter(Boolean);
  if (rest[0] === 'notes' || rest[0] === 'handouts') rest.shift();
  const id = rest[0];
  return (
    <Navigate
      replace
      to={`${base}/notes${id ? `/${id}` : ''}${search}`}
    />
  );
}
