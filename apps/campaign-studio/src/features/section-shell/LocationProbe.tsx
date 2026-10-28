import { useLocation } from 'react-router-dom';

/** Test helper: exposes the router location as `data-testid="location"`. */
export function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
}
