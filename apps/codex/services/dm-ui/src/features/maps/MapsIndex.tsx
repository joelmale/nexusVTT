import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import { Link } from 'react-router-dom';

import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import { resolvePublicAsset } from '@/features/map-preparation/buildMapPreparationModel';

import styles from './MapsIndex.module.css';

interface MapsIndexProps {
  bundle: CampaignFixtureBundle;
  basePath: string;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function MapsIndex({ bundle, basePath }: MapsIndexProps) {
  return (
    <ul className={styles.grid}>
      {bundle.maps.map((map) => {
        const pinCount = bundle.pins.filter(
          (pin) => pin.mapId === map.id,
        ).length;
        const locationNames = map.locationIds
          .map(
            (id) =>
              bundle.locations.find((location) => location.id === id)?.name,
          )
          .filter((name): name is string => Boolean(name));
        return (
          <li key={map.id}>
            <Link className={styles.card} to={`${basePath}/maps/${map.id}`}>
              <div className={styles.thumb}>
                {map.imagePath ? (
                  <img alt="" src={resolvePublicAsset(map.imagePath)} />
                ) : (
                  <span data-testid="map-card-placeholder" aria-hidden="true">
                    <MapPin size={32} />
                  </span>
                )}
              </div>
              <div className={styles.body}>
                <h2>{map.title}</h2>
                <p className={styles.description}>{map.description}</p>
                <span className={styles.meta}>
                  {plural(pinCount, 'pinned location')} ·{' '}
                  {plural(map.layers.length, 'layer')}
                </span>
                {locationNames.length > 0 ? (
                  <span className={styles.meta}>
                    {locationNames.join(', ')}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
